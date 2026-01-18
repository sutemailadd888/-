import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const date = searchParams.get('date'); // YYYY-MM-DD

  if (!userId || !date) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // 1. Supabaseからユーザーのトークンを取得
  const supabase = await createClient();
  const { data: userToken, error: tokenError } = await supabase
    .from('user_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single();

  if (tokenError || !userToken) {
    return NextResponse.json({ error: 'User token not found' }, { status: 401 });
  }

  // 2. Google OAuthクライアントの設定
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

  // 3. 検索範囲の設定（指定された日の 09:00 〜 22:00）
  // ※ここで時間を変えれば、受付可能時間を変更できます
  const timeMin = new Date(`${date}T09:00:00+09:00`).toISOString();
  const timeMax = new Date(`${date}T22:00:00+09:00`).toISOString();

  try {
    // ★ここがポイント：編集権限を持つ全カレンダーリストを取得
    // (仕事用カレンダー + 共有された個人用カレンダーなど)
    const calendarListRes = await calendar.calendarList.list({
      minAccessRole: 'writer', // 編集権限があるものだけ（祝日カレンダーなどを除外）
    });

    const calendarItems = calendarListRes.data.items || [];
    const calendarIds = calendarItems.map(cal => ({ id: cal.id }));

    // 4. 全カレンダーの空き状況（FreeBusy）を一括取得
    const freeBusyRes = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: 'Asia/Tokyo',
        items: calendarIds, // 取得した全IDを対象にする
      },
    });

    const calendars = freeBusyRes.data.calendars || {};
    let busySlots: { start: string; end: string }[] = [];

    // すべてのカレンダーの「予定あり(busy)」情報をひとまとめにする
    Object.values(calendars).forEach((cal: any) => {
      if (cal.busy) {
        busySlots = [...busySlots, ...cal.busy];
      }
    });

    // 5. 30分ごとのスロットを生成し、Busyと比較して空き枠を作る
    const slots = [];
    const startHour = 9; // 開始時間
    const endHour = 22;  // 終了時間
    const slotDuration = 60; // 1枠60分（必要に応じて30や90に変更可）

    // 指定日の開始時刻をセット
    let current = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00+09:00`);
    const endTime = new Date(`${date}T${String(endHour).padStart(2, '0')}:00:00+09:00`);

    while (current < endTime) {
      // スロットの終了時刻
      const slotEnd = new Date(current.getTime() + slotDuration * 60000);
      
      // このスロットが、取得した「予定あり」と被っていないかチェック
      const isBusy = busySlots.some(busy => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        
        // 重なり判定（スロットの一部でも予定と被ればNG）
        return (current < busyEnd && slotEnd > busyStart);
      });

      if (!isBusy) {
        // 時間を "HH:mm" 形式に整形
        const timeString = current.toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Tokyo'
        });
        slots.push(timeString);
      }

      // 次の枠へ（30分刻みで開始時間をずらす）
      // ※60分枠を、30分間隔で提示したい場合はここを30にする
      current = new Date(current.getTime() + 30 * 60000);
    }

    return NextResponse.json({ slots });

  } catch (error) {
    console.error('Calendar API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 });
  }
}