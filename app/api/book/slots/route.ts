// app/api/book/slots/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const getDayKey = (date: Date) => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date');
  const slug = searchParams.get('slug'); // ★変更: orgIdではなくslugで検索

  if (!dateStr || !slug) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  try {
    // 1. 予約メニューの情報を取得 (担当者リスト、所要時間、AND/OR設定など)
    const { data: meetingType, error: mtError } = await supabaseAdmin
      .from('meeting_types')
      .select(`
        *,
        meeting_hosts ( user_id )
      `)
      .eq('slug', slug)
      .single();

    if (mtError || !meetingType) {
      console.error("Meeting Type Not Found:", slug);
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 });
    }

    const { workspace_id, duration_minutes, booking_method, meeting_hosts } = meetingType;
    const hostIds = meeting_hosts.map((h: any) => h.user_id);

    // 2. 稼働設定 (営業時間) を取得
    const { data: settings } = await supabaseAdmin
      .from('schedule_settings')
      .select('weekly_config')
      .eq('workspace_id', workspace_id)
      .single();

    const targetDate = new Date(dateStr);
    const dayKey = getDayKey(targetDate);
    const dayConfig = settings?.weekly_config?.[dayKey];

    // 休みなら即終了
    if (!dayConfig || !dayConfig.active) {
      return NextResponse.json({ slots: [] });
    }

    // 3. 担当者全員のGoogleカレンダー「予定あり(Busy)」を取得
    let hostsBusyMap: Record<string, { start: Date; end: Date }[]> = {}; // { userId: [予定...] }

    await Promise.all(hostIds.map(async (userId: string) => {
        hostsBusyMap[userId] = []; // 初期化

        const { data: userToken } = await supabaseAdmin
            .from('user_tokens')
            .select('access_token, refresh_token, expires_at')
            .eq('user_id', userId)
            .single();

        if (!userToken) return; // 連携していない人は無視

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({
            access_token: userToken.access_token,
            refresh_token: userToken.refresh_token,
            expiry_date: Number(userToken.expires_at),
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const timeMin = `${dateStr}T00:00:00+09:00`;
        const timeMax = `${dateStr}T23:59:59+09:00`;

        try {
            const res = await calendar.freebusy.query({
                requestBody: {
                    timeMin, timeMax, timeZone: 'Asia/Tokyo', items: [{ id: 'primary' }],
                },
            });
            const busy = res.data.calendars?.primary?.busy || [];
            hostsBusyMap[userId] = busy.map(b => ({
                start: new Date(b.start!),
                end: new Date(b.end!)
            }));
        } catch (e) {
            console.error(`Cal Error (${userId}):`, e);
        }
    }));

    // 4. スロット計算 (AND / OR ロジック)
    const slots = [];
    const [startH, startM] = dayConfig.start.split(':').map(Number);
    const [endH, endM] = dayConfig.end.split(':').map(Number);
    
    let currentSlot = new Date(`${dateStr}T${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')}:00+09:00`);
    const dayEndTime = new Date(`${dateStr}T${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}:00+09:00`);

    while (currentSlot < dayEndTime) {
        const slotEnd = new Date(currentSlot.getTime() + duration_minutes * 60000);
        if (slotEnd > dayEndTime) break;

        // 判定ロジック
        let isSlotAvailable = false;

        if (booking_method === 'and') {
            // 【AND条件】: 全員の予定が空いていること
            // 「誰か一人でも忙しい人がいるか？」をチェックし、いなければOK
            const isAnyHostBusy = hostIds.some((uid: string) => {
                const busyList = hostsBusyMap[uid] || [];
                return busyList.some(busy => currentSlot < busy.end && slotEnd > busy.start);
            });
            isSlotAvailable = !isAnyHostBusy;

        } else {
            // 【OR条件】: 誰か一人が空いていること
            // 「誰か一人でも空いている人がいるか？」をチェック
            const isAnyHostFree = hostIds.some((uid: string) => {
                const busyList = hostsBusyMap[uid] || [];
                // この人がこの時間に「予定が入っているか」
                const isBusy = busyList.some(busy => currentSlot < busy.end && slotEnd > busy.start);
                return !isBusy; // 予定がなければFree
            });
            isSlotAvailable = isAnyHostFree;
        }

        if (isSlotAvailable) {
            slots.push(currentSlot.toLocaleTimeString('ja-JP', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo'
            }));
        }

        // 次の枠へ (30分刻みや60分刻みなど。現在は所要時間間隔で進める簡易実装)
        // ※より柔軟にするならここは固定値(30分など)でも良いですが、一旦durationで進めます
        currentSlot = new Date(currentSlot.getTime() + duration_minutes * 60000);
    }

    return NextResponse.json({ slots });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}