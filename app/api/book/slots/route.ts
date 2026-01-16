import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hostId = searchParams.get('hostId');
  const date = searchParams.get('date'); // YYYY-MM-DD
  const orgId = searchParams.get('orgId'); // ★追加: どのワークスペースの設定を見るか

  console.log(`\n🔍 [DEBUG] 日程チェック開始: ${date} (Org: ${orgId})`);

  if (!hostId || !date) return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 });

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

  try {
    // 1. Googleトークン(User Secrets)を取得
    const { data: secrets } = await supabaseAdmin
      .from('user_secrets')
      .select('access_token')
      .eq('user_id', hostId)
      .single();

    if (!secrets?.access_token) return NextResponse.json({ error: 'Token not found' }, { status: 404 });

    // 2. ★修正: 指定されたワークスペースの「設定(Settings)」を取得する
    let settingsQuery = supabaseAdmin
      .from('schedule_settings')
      .select('weekly_config')
      .eq('user_id', hostId);

    // orgIdがある場合は、その組織の設定に絞る
    if (orgId) {
        settingsQuery = settingsQuery.eq('organization_id', orgId);
    }

    // maybeSingle() を使うと、データがなくてもエラーにならず null を返してくれる
    const { data: settingsData } = await settingsQuery.maybeSingle();
    
    // 設定が見つからない場合はデフォルト設定を使う (全日 10:00-18:00)
    const settings = settingsData?.weekly_config;

    // 3. 「今日は何曜日？」を判定して、営業時間を決定する
    const dayIndex = new Date(date).getDay(); 
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayKey = dayKeys[dayIndex];
    
    // 設定があればそれに従う。なければデフォルト(10-18)
    const dayConfig = settings ? settings[todayKey] : { active: true, start: '10:00', end: '18:00' };

    console.log(`📅 判定: ${date} (${todayKey}) 営業設定: ${dayConfig?.active ? 'OPEN' : 'CLOSED'}`);

    // 定休日ならスキップ
    if (!dayConfig || !dayConfig.active) {
        return NextResponse.json({ slots: [] });
    }

    // 4. Googleカレンダーに問い合わせ
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

    if (!googleRes.ok) {
        // トークン切れ等のエラーハンドリング
        console.error("Google API Error:", await googleRes.text());
        return NextResponse.json({ error: 'Google Calendar Error' }, { status: 500 });
    }
    
    const googleData = await googleRes.json();
    const busyRanges = googleData.calendars.primary.busy;

    // 5. 空き枠計算
    const startHour = parseInt(dayConfig.start.split(':')[0]);
    const endHour = parseInt(dayConfig.end.split(':')[0]);
    
    const availableSlots = [];

    for (let h = startHour; h < endHour; h++) {
        const hourStr = h.toString().padStart(2, '0');
        
        // お昼休み(12:00-13:00)を除外したい場合はここを有効化
        // if (h === 12) continue; 

        const slotStart = new Date(`${date}T${hourStr}:00:00+09:00`);
        const slotEnd = new Date(`${date}T${h + 1}:00:00+09:00`);

        // Googleの予定と被ってるかチェック
        const conflict = busyRanges.find((range: any) => {
            const rangeStart = new Date(range.start);
            const rangeEnd = new Date(range.end);
            return slotStart < rangeEnd && slotEnd > rangeStart;
        });

        if (!conflict) {
            availableSlots.push(`${hourStr}:00`);
        }
    }

    console.log(`✅ 計算完了。空き枠: ${availableSlots.length}件`);
    return NextResponse.json({ slots: availableSlots });

  } catch (error: any) {
    console.error("🚨 Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}