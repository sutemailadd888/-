// app/api/book/slots/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hostId = searchParams.get('hostId');
  const date = searchParams.get('date');
  const orgId = searchParams.get('orgId'); // ★追加

  console.log(`\n🔍 [DEBUG] 日程チェック開始: ${date} (Org: ${orgId})`);

  if (!hostId || !date || !orgId) return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 });

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

  try {
    // 1. 金庫(Token) と 設定(Settings) を取得
    const [secretsResult, settingsResult] = await Promise.all([
      supabaseAdmin.from('user_secrets').select('access_token').eq('user_id', hostId).single(),
      // ★変更: organization_id も条件に加えて、正しい設定を引く
      supabaseAdmin.from('schedule_settings').select('weekly_config')
        .eq('user_id', hostId)
        .eq('organization_id', orgId) 
        .single()
    ]);

    const secrets = secretsResult.data;
    const settings = settingsResult.data?.weekly_config;

    if (!secrets?.access_token) return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    // 設定が見つからない場合はデフォルト設定を使う
    const defaultConfig = { active: true, start: '10:00', end: '18:00' };

    // 2. 曜日判定
    const dayIndex = new Date(date).getDay(); 
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayKey = dayKeys[dayIndex];
    
    // 設定があればそれを使う、なければデフォルト
    const dayConfig = settings ? settings[todayKey] : defaultConfig;

    if (!dayConfig.active) {
        return NextResponse.json({ slots: [] });
    }

    // 3. Googleカレンダー確認
    const timeMin = `${date}T00:00:00+09:00`;
    const timeMax = `${date}T23:59:59+09:00`;

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

    // 4. 空き枠計算
    const startHour = parseInt(dayConfig.start.split(':')[0]);
    const endHour = parseInt(dayConfig.end.split(':')[0]);
    
    const availableSlots = [];

    for (let h = startHour; h < endHour; h++) {
        const hourStr = h.toString().padStart(2, '0');
        const slotStart = new Date(`${date}T${hourStr}:00:00+09:00`);
        const slotEnd = new Date(`${date}T${h + 1}:00:00+09:00`);

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