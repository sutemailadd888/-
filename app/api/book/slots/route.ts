// app/api/book/slots/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hostId = searchParams.get('hostId');
  const date = searchParams.get('date');

  console.log(`🔍 [API] 開始: Host=${hostId}, Date=${date}`);

  if (!hostId || !date) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 });
  }

  // 1. 環境変数のチェック
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
      console.error("🚨 [API] エラー: SUPABASE_SERVICE_ROLE_KEY が設定されていません！");
      return NextResponse.json({ error: 'サーバー設定エラー: キー不足' }, { status: 500 });
  }

  // 2. 特権クライアントの作成
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  try {
    // 3. 金庫からトークンを取り出す
    const { data: secrets, error: dbError } = await supabaseAdmin
      .from('user_secrets')
      .select('access_token')
      .eq('user_id', hostId)
      .single();

    if (dbError || !secrets) {
        console.error("🚨 [API] トークンが見つかりません。DBエラー:", dbError);
        return NextResponse.json({ error: 'ホストの連携情報が見つかりません。ダッシュボードを開いて再連携してください。' }, { status: 404 });
    }

    console.log("✅ [API] トークン取得成功。Googleに問い合わせます...");

    // 4. Google Calendar API (FreeBusy)
    const timeMin = `${date}T00:00:00+09:00`;
    const timeMax = `${date}T23:59:59+09:00`;

    const googleRes = await fetch(
      `https://www.googleapis.com/calendar/v3/freebusy`,
      {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${secrets.access_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            timeMin,
            timeMax,
            timeZone: 'Asia/Tokyo',
            items: [{ id: 'primary' }]
        })
      }
    );

    if (!googleRes.ok) {
        const errText = await googleRes.text();
        console.error("🚨 [API] Google API エラー:", errText);
        return NextResponse.json({ error: 'Googleカレンダーの読み込みに失敗しました' }, { status: 500 });
    }

    const googleData = await googleRes.json();
    console.log("✅ [API] Google応答あり。空き枠計算中...");

    // 5. 空き枠計算
    const busyRanges = googleData.calendars.primary.busy;
    const candidates = [10, 11, 13, 14, 15, 16, 17]; // 候補の時間帯
    const availableSlots = [];

    for (const hour of candidates) {
        const slotStart = new Date(`${date}T${hour}:00:00+09:00`);
        const slotEnd = new Date(`${date}T${hour + 1}:00:00+09:00`);

        const isBusy = busyRanges.some((range: any) => {
            const rangeStart = new Date(range.start);
            const rangeEnd = new Date(range.end);
            return slotStart < rangeEnd && slotEnd > rangeStart;
        });

        if (!isBusy) availableSlots.push(`${hour}:00`);
    }

    console.log(`✅ [API] 計算完了。空き枠: ${availableSlots.length}件`);
    return NextResponse.json({ slots: availableSlots });

  } catch (error: any) {
    console.error("🚨 [API] 予期せぬエラー:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}