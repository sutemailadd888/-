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
  const dateStr = searchParams.get('date'); // 例: "2026-01-31"
  const slug = searchParams.get('slug');

  if (!dateStr || !slug) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  try {
    // 1. 予約メニュー取得
    const { data: meetingType } = await supabaseAdmin
      .from('meeting_types')
      .select('*, meeting_hosts(user_id)')
      .eq('slug', slug)
      .single();

    if (!meetingType) return NextResponse.json({ error: 'Menu not found' }, { status: 404 });

    const { workspace_id, duration_minutes, booking_method, meeting_hosts } = meetingType;
    const hostIds = meeting_hosts.map((h: any) => h.user_id);

    // 2. 稼働設定取得
    const { data: settings } = await supabaseAdmin
      .from('schedule_settings')
      .select('weekly_config')
      .eq('workspace_id', workspace_id)
      .single();

    // ★修正: 日本時間(JST)として日付オブジェクトを生成
    // 単に new Date(dateStr) するとUTC扱いになり9時間ズレるため、タイムゾーン付き文字列にする
    const targetDateJST = new Date(`${dateStr}T00:00:00+09:00`);
    const dayKey = getDayKey(targetDateJST);
    const dayConfig = settings?.weekly_config?.[dayKey];

    if (!dayConfig || !dayConfig.active) {
      return NextResponse.json({ slots: [] });
    }

    // 3. Googleカレンダー確認 (JST範囲指定)
    let hostsBusyMap: Record<string, { start: number; end: number }[]> = {};
    
    const timeMin = `${dateStr}T00:00:00+09:00`;
    const timeMax = `${dateStr}T23:59:59+09:00`;

    await Promise.all(hostIds.map(async (userId: string) => {
        hostsBusyMap[userId] = [];
        
        const { data: userToken } = await supabaseAdmin
            .from('user_tokens')
            .select('access_token, refresh_token, expires_at')
            .eq('user_id', userId)
            .single();

        if (!userToken) return;

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

        try {
            // Googleに「JSTでの予定」を問い合わせる
            const res = await calendar.freebusy.query({
                requestBody: {
                    timeMin,
                    timeMax,
                    timeZone: 'Asia/Tokyo',
                    items: [{ id: 'primary' }],
                },
            });
            
            const busyList = res.data.calendars?.primary?.busy || [];
            
            // 比較用に数値(UNIX Time)に変換して保持
            hostsBusyMap[userId] = busyList.map(b => ({
                start: new Date(b.start!).getTime(),
                end: new Date(b.end!).getTime()
            }));

        } catch (e: any) {
            console.error(`Google API Error (${userId}):`, e.message);
        }
    }));

    // 4. スロット計算
    const slots = [];
    const [startH, startM] = dayConfig.start.split(':').map(Number);
    const [endH, endM] = dayConfig.end.split(':').map(Number);
    
    // 開始・終了時間をUNIX Timeで計算 (JST基準)
    let currentSlotTime = new Date(`${dateStr}T${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')}:00+09:00`).getTime();
    const dayEndTime = new Date(`${dateStr}T${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}:00+09:00`).getTime();
    
    const durationMs = duration_minutes * 60 * 1000;

    while (currentSlotTime + durationMs <= dayEndTime) {
        const slotStart = currentSlotTime;
        const slotEnd = currentSlotTime + durationMs;

        let isSlotAvailable = false;

        if (booking_method === 'and') {
            // AND条件: 全員空いているか？ (誰か一人でも被ったらNG)
            const isAnyHostBusy = hostIds.some((uid: string) => {
                const busyList = hostsBusyMap[uid] || [];
                return busyList.some(busy => slotStart < busy.end && slotEnd > busy.start);
            });
            isSlotAvailable = !isAnyHostBusy;
        } else {
            // OR条件: 誰か一人空いているか？
            const isAnyHostFree = hostIds.some((uid: string) => {
                const busyList = hostsBusyMap[uid] || [];
                // 被っているか？
                const isBusy = busyList.some(busy => slotStart < busy.end && slotEnd > busy.start);
                return !isBusy; // 被っていなければOK
            });
            isSlotAvailable = isAnyHostFree;
        }

        if (isSlotAvailable) {
            // 結果をJSTの文字列に戻して配列に追加
            const timeString = new Date(currentSlotTime).toLocaleTimeString('ja-JP', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo'
            });
            slots.push(timeString);
        }

        currentSlotTime += durationMs; 
    }

    return NextResponse.json({ slots });

  } catch (error: any) {
    console.error('API Critical Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}