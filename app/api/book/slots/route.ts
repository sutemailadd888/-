import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 曜日を英語キーに変換するヘルパー
const getDayKey = (date: Date) => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date'); // YYYY-MM-DD
  const orgId = searchParams.get('orgId');

  if (!dateStr || !orgId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  try {
    // ==========================================
    // 1. 稼働設定 (Schedule Settings) を取得
    // ==========================================
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('schedule_settings')
      .select('weekly_config')
      .eq('workspace_id', orgId)
      .single();

    // 設定がない、または取得エラーの場合は、安全のため「空きなし」を返す
    if (settingsError || !settings?.weekly_config) {
      console.log('Settings not found, returning empty slots');
      return NextResponse.json({ slots: [] });
    }

    const targetDate = new Date(dateStr);
    const dayKey = getDayKey(targetDate);
    const dayConfig = settings.weekly_config[dayKey];

    // その曜日が「休み (active: false)」なら、即座に空きなしを返す
    if (!dayConfig || !dayConfig.active) {
      return NextResponse.json({ slots: [] });
    }

    // ==========================================
    // 2. メンバー全員のカレンダー「予定あり」を取得
    // ==========================================
    const { data: members } = await supabaseAdmin
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', orgId);

    let allBusySlots: { start: string; end: string }[] = [];

    if (members && members.length > 0) {
        await Promise.all(members.map(async (member) => {
            // トークン取得 (user_tokensテーブル)
            const { data: userToken } = await supabaseAdmin
                .from('user_tokens')
                .select('access_token, refresh_token, expires_at')
                .eq('user_id', member.user_id)
                .single();

            if (!userToken) return; // 連携していない人は無視

            // Google Client設定
            const oauth2Client = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET
            );
            oauth2Client.setCredentials({
                access_token: userToken.access_token,
                refresh_token: userToken.refresh_token,
                expiry_date: userToken.expires_at ? Number(userToken.expires_at) : undefined,
            });

            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            
            // 指定日の一日の範囲 (JST)
            const timeMin = `${dateStr}T00:00:00+09:00`;
            const timeMax = `${dateStr}T23:59:59+09:00`;

            try {
                const res = await calendar.freebusy.query({
                    requestBody: {
                        timeMin,
                        timeMax,
                        timeZone: 'Asia/Tokyo',
                        items: [{ id: 'primary' }],
                    },
                });
                
                const busy = res.data.calendars?.primary?.busy || [];
                // 型安全に変換して追加
                const cleanBusy = busy
                    .filter(b => b.start && b.end)
                    .map(b => ({ start: b.start as string, end: b.end as string }));
                
                allBusySlots.push(...cleanBusy);

            } catch (e) {
                console.error(`Cal Error (${member.user_id}):`, e);
            }
        }));
    }

    // ==========================================
    // 3. スロット生成 & 重複チェック
    // ==========================================
    const slots = [];
    
    // 設定から開始・終了時間を取得 (例: "10:00", "18:00")
    const [startH, startM] = dayConfig.start.split(':').map(Number);
    const [endH, endM] = dayConfig.end.split(':').map(Number);

    // Dateオブジェクトとして開始・終了を作成
    let currentSlot = new Date(`${dateStr}T${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')}:00+09:00`);
    const dayEndTime = new Date(`${dateStr}T${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}:00+09:00`);

    // 60分単位でループ
    const slotDurationMinutes = 60; 

    while (currentSlot < dayEndTime) {
        // この枠の終了時間
        const slotEnd = new Date(currentSlot.getTime() + slotDurationMinutes * 60000);

        // 終了時間が営業時間を超えるならループ終了
        if (slotEnd > dayEndTime) break;

        // 重複チェック: 誰かの予定と被っているか？
        const isConflict = allBusySlots.some(busy => {
            const busyStart = new Date(busy.start);
            const busyEnd = new Date(busy.end);
            // 被り判定 (SlotStart < BusyEnd && SlotEnd > BusyStart)
            return currentSlot < busyEnd && slotEnd > busyStart;
        });

        if (!isConflict) {
            // HH:mm 形式で追加
            const timeStr = currentSlot.toLocaleTimeString('ja-JP', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo'
            });
            slots.push(timeStr);
        }

        // 次の枠へ (60分後)
        currentSlot = new Date(currentSlot.getTime() + slotDurationMinutes * 60000);
    }

    return NextResponse.json({ slots });

  } catch (error: any) {
    console.error('Slots Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}