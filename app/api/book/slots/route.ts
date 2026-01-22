import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// 管理者権限でSupabaseを操作（他人のトークンを読み取るため）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const orgId = searchParams.get('orgId'); // ワークスペースID

  if (!date || !orgId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  try {
    // 1. ワークスペースのメンバーIDを全員取得
    const { data: members, error: memberError } = await supabaseAdmin
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', orgId);

    if (memberError || !members || members.length === 0) {
      throw new Error("メンバーが見つかりません");
    }

    // 2. 全員の「忙しい時間」を格納する配列
    let allBusySlots: { start: string; end: string }[] = [];

    // メンバーごとにGoogleカレンダーを確認
    await Promise.all(members.map(async (member) => {
        // A. user_tokens テーブルからトークンを取得 (元のコードのロジックを踏襲)
        const { data: userToken } = await supabaseAdmin
            .from('user_tokens')
            .select('access_token, refresh_token, expires_at')
            .eq('user_id', member.user_id)
            .single();

        // トークンがない人（未連携の人）はスキップ（＝この人はずっと暇扱い）
        if (!userToken) return;

        // B. Google OAuthクライアント設定
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

        // C. FreeBusyを取得 (その人のメインカレンダーのみ確認)
        const timeMin = new Date(`${date}T00:00:00+09:00`).toISOString();
        const timeMax = new Date(`${date}T23:59:59+09:00`).toISOString();

        try {
            const freeBusyRes = await calendar.freebusy.query({
                requestBody: {
                    timeMin,
                    timeMax,
                    timeZone: 'Asia/Tokyo',
                    items: [{ id: 'primary' }], // メインカレンダーを確認
                },
            });
            
            const busy = freeBusyRes.data.calendars?.primary?.busy || [];

            // 型エラー対策: startとendが確実に存在するデータだけを抽出して整形する
            const cleanBusy = busy
              .filter(b => b.start && b.end) // nullを除外
              .map(b => ({ 
                start: b.start as string, 
                end: b.end as string 
              }));

            allBusySlots.push(...cleanBusy);

        } catch (e) {
            console.error(`Error fetching calendar for user ${member.user_id}`, e);
        }
    }));

    // 3. 空き時間のスロットを生成
    // (元のコードの良いロジックを再利用)
    const slots = [];
    const startHour = 10; // 営業開始
    const endHour = 18;   // 営業終了
    const slotDuration = 60; // 60分枠

    let current = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00+09:00`);
    const endTime = new Date(`${date}T${String(endHour).padStart(2, '0')}:00:00+09:00`);

    while (current < endTime) {
      // 枠の終了時刻
      const slotEnd = new Date(current.getTime() + slotDuration * 60000);
      
      // 4. 「誰かの予定」と被っていないかチェック
      const isConflict = allBusySlots.some(busy => {
        if (!busy.start || !busy.end) return false;
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        
        // 重なり判定
        return (current < busyEnd && slotEnd > busyStart);
      });

      if (!isConflict) {
        // 時間を "HH:mm" に整形
        const timeString = current.toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Tokyo'
        });
        slots.push(timeString);
      }

      // 60分枠を30分間隔などで提示したい場合はここを調整
      // 今回はシンプルに60分刻みにします
      current = new Date(current.getTime() + 60 * 60000);
    }

    return NextResponse.json({ slots });

  } catch (error: any) {
    console.error('Slots API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}