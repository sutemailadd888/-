import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeMin = searchParams.get('timeMin');
  const timeMax = searchParams.get('timeMax');
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!timeMin || !timeMax) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  try {
    const params = new URLSearchParams({
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      timeZone: 'Asia/Tokyo'
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const data = await response.json();
    
    if (data.error) throw new Error(data.error.message);

    // ★修正: ここでデータを加工して「終日フラグ」を明示的につける
    // これをしないと、FullCalendar等のライブラリで日付がズレて表示されることがあります
    const formattedEvents = (data.items || []).map((event: any) => {
        // dateTimeがない(=dateのみ)場合は終日イベント
        const isAllDay = !event.start.dateTime; 
        
        return {
            id: event.id,
            title: event.summary || '(No Title)',
            // 終日の場合は date、時間指定の場合は dateTime を使う
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            allDay: isAllDay, // ★重要: これを追加！
            
            // 色などの見た目調整 (終日は濃い色にするなど)
            backgroundColor: isAllDay ? '#8B5CF6' : '#3B82F6', 
            borderColor: isAllDay ? '#7C3AED' : '#2563EB',
            textColor: '#ffffff'
        };
    });

    // フロントエンドが { events: [...] } の形を期待しているためそれに合わせる
    return NextResponse.json({ events: formattedEvents });

  } catch (error: any) {
    console.error('Calendar Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}