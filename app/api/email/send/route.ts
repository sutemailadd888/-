// app/api/email/send/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { to, subject, html } = await request.json();

    if (!to || !subject || !html) {
        return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    // メール送信実行
    const data = await resend.emails.send({
      from: 'GAKU-HUB OS <onboarding@resend.dev>', // テスト用のアドレス
      to: [to], // 送信先
      subject: subject,
      html: html,
    });

    if (data.error) {
        console.error("Resend Error:", data.error);
        return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}