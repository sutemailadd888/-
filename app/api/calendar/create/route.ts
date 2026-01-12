// app/api/calendar/create/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { session, eventDetails, attendees } = await request.json(); // attendeesを受け取る
    const token = session?.provider_token;

    if (!token) return NextResponse.json({ error: "No token found" }, { status: 401 });

    const cleanDate = eventDetails.date.replace(/\(.\)/, '').trim().replace(/\//g, '-');
    const [startTimeStr, endTimeStr] = eventDetails.time.split(' - ');
    const startDateTime = `${cleanDate}T${startTimeStr.trim()}:00`;
    const endDateTime = `${cleanDate}T${endTimeStr.trim()}:00`;

    // ★参加者リストの整形
    // カンマ区切りの文字列を、Google API用の形式 [{email: 'a@a.com'}, {email: 'b@b.com'}] に変換
    let attendeeList: any[] = [];
    if (attendees && attendees.length > 0) {
        attendeeList = attendees.split(',').map((email: string) => ({ email: email.trim() }));
    }

    // ★ここが「配慮のあるメッセージ」の肝です
    const politeDescription = `
【AI自動調整 (仮押さえ)】
この日程は、Smart Schedulerが候補日として自動的に仮押さえしました。

もしご都合が悪い場合（移動中、作業集中など）は、遠慮なく「辞退 (No)」を押してください。
辞退があった場合、主催者が再度別の日程で調整します。

---
Created by Smart Scheduler
    `;

    const eventBody = {
      summary: `定例MTG (${eventDetails.reason})`,
      description: politeDescription, // 優しいメッセージを設定
      start: { 
        dateTime: startDateTime, 
        timeZone: 'Asia/Tokyo' 
      },
      end: { 
        dateTime: endDateTime, 
        timeZone: 'Asia/Tokyo' 
      },
      attendees: attendeeList, // ★招待リストを追加
    };

    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', // ★メール通知を送るオプション
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    const data = await response.json();

    if (data.error) throw new Error(data.error.message);

    return NextResponse.json({ success: true, link: data.htmlLink });

  } catch (error: any) {
    console.error("Calendar Create Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}