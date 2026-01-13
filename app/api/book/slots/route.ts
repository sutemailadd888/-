// app/api/book/slots/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hostId = searchParams.get('hostId');
  const date = searchParams.get('date');

  console.log(`\n🔍 [DEBUG] 日程チェック開始: ${date}`);

  if (!hostId || !date) return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 });

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

  try {
    // 1. 金庫からトークン取得
    const { data: secrets } = await supabaseAdmin
      .from('user_secrets')
      .select('access_token')
      .eq('user_id', hostId)
      .single();

    if (!secrets?.access_token) return NextResponse.json({ error: 'Token not found' }, { status: 404 });

    // 2. Googleに問い合わせ
    const timeMin = `${date}T00:00:00+09:00`;
    const timeMax = `${date}T23:59:59+09:00`;

    console.log(`📡 Google問い合わせ範囲: ${timeMin} 〜 ${timeMax}`);

    // ★修正箇所: freebusy → freeBusy (Bを大文字に修正)
    const googleRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${secrets.access_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            timeMin, timeMax, timeZone: 'Asia/Tokyo', items: [{ id: 'primary' }]
        })
    });

    if (!googleRes.ok) throw new Error(await googleRes.text());
    
    const googleData = await googleRes.json();
    const busyRanges = googleData.calendars.primary.busy;

    console.log("⚠️ Googleが認識している『忙しい時間』一覧:");
    busyRanges.forEach((range: any, i: number) => {
        const start = new Date(range.start).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        const end = new Date(range.end).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        console.log(`   [${i}] ${start} 〜 ${end}`);
    });

    // 3. 空き枠計算
    const candidates = [10, 11, 13, 14, 15, 16, 17];
    const availableSlots = [];

    for (const hour of candidates) {
        const hourStr = hour.toString().padStart(2, '0');
        const slotStart = new Date(`${date}T${hourStr}:00:00+09:00`);
        const slotEnd = new Date(`${date}T${hour + 1}:00:00+09:00`);

        const conflict = busyRanges.find((range: any) => {
            const rangeStart = new Date(range.start);
            const rangeEnd = new Date(range.end);
            return slotStart < rangeEnd && slotEnd > rangeStart;
        });

        if (!conflict) {
            availableSlots.push(`${hourStr}:00`);
        }
    }

    return NextResponse.json({ slots: availableSlots });

  } catch (error: any) {
    console.error("🚨 Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}