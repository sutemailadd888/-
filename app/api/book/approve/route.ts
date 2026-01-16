// app/api/book/approve/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// ★修正: 後ろに ! をつけて「必ず値がある」と明示する (Typeエラー回避)
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { request: bookingReq } = body; 

    if (!bookingReq) return NextResponse.json({ error: 'Missing request data' }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: secret } = await supabase
      .from('user_secrets')
      .select('access_token')
      .eq('user_id', bookingReq.host_user_id)
      .single();

    if (!secret?.access_token) {
        return NextResponse.json({ error: 'Host token not found' }, { status: 401 });
    }

    const calendarEvent = {
        summary: `面談: ${bookingReq.guest_name} 様`,
        description: `GAKU-HUB予約\nEmail: ${bookingReq.guest_email}\nNote: ${bookingReq.note || 'なし'}`,
        start: { dateTime: bookingReq.start_time },
        end: { dateTime: bookingReq.end_time },
        attendees: [{ email: bookingReq.guest_email }],
        conferenceData: {
            createRequest: { requestId: Math.random().toString(36).substring(7), conferenceSolutionKey: { type: 'hangoutsMeet' } }
        },
    };

    const gRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${secret.access_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(calendarEvent)
    });

    if (!gRes.ok) {
        const err = await gRes.text();
        console.error("Google Calendar Error:", err);
        throw new Error('Googleカレンダーへの登録に失敗しました');
    }

    try {
        await resend.emails.send({
            from: 'GAKU-HUB OS <onboarding@resend.dev>',
            // ★注意: Resend無料版は、ここで指定できるのは「自分の登録メアド」だけです。
            // テスト時は bookingReq.guest_email ではなく、あなたのメールアドレスに固定することをお勧めします。
            to: bookingReq.guest_email, 
            subject: '【予約確定】面談の日程が決まりました',
            html: `
                <p>${bookingReq.guest_name} 様</p>
                <p>ご予約ありがとうございます。以下の日程で確定いたしました。</p>
                <div style="padding: 12px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
                    <p><strong>📅 日時:</strong> ${new Date(bookingReq.start_time).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
                    <p><strong>💻 場所:</strong> Google Meet (カレンダーをご確認ください)</p>
                </div>
                <p>当日はよろしくお願いいたします。</p>
            `
        });
    } catch (emailError) {
        console.error("Mail Error:", emailError);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}