// app/api/book/request/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// 管理者権限でDB操作（ゲストは書き込み権限がない場合があるため）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, guest_name, guest_email, note, date, time } = body;

    // 1. Slugから予約メニュー情報を取得
    const { data: meetingType } = await supabaseAdmin
      .from('meeting_types')
      .select('*, meeting_hosts(user_id)')
      .eq('slug', slug)
      .single();

    if (!meetingType) throw new Error('Meeting type not found');

    const { workspace_id, duration_minutes, meeting_hosts } = meetingType;

    // 2. 日時計算
    const startDateTime = `${date}T${time}:00+09:00`; // JST
    // 終了時間は duration_minutes から計算
    const startDateObj = new Date(startDateTime);
    const endDateObj = new Date(startDateObj.getTime() + duration_minutes * 60000);
    const endDateTime = endDateObj.toISOString();

    // 3. ホスト（担当者）の決定
    // "OR"条件の場合、空いている人を計算すべきですが、
    // いったん簡易的に「リストの最初のメンバー」をメイン担当として登録します
    // (実運用ではここで空き状況チェックを再実行して割り当てるのがベスト)
    const primaryHostId = meeting_hosts[0]?.user_id;

    if (!primaryHostId) throw new Error('No host assigned to this meeting type');

    // 4. DBに保存
    const { error: insertError } = await supabaseAdmin
        .from('booking_requests')
        .insert([
          {
            host_user_id: primaryHostId, // メイン担当者
            workspace_id: workspace_id,
            guest_name,
            guest_email,
            start_time: startDateTime, // ISOStringだとUTCになるので注意が必要ですが、Supabaseはtimestamptzで扱います
            end_time: endDateTime,
            note,
            status: 'pending'
          }
        ]);

    if (insertError) throw insertError;

    // 5. 仮押さえメール送信
    await resend.emails.send({
        from: 'GAKU-HUB OS <noreply@gaku-hub.com>',
        to: guest_email, 
        subject: `【予約リクエスト受領】${meetingType.title}`,
        html: `
            <h3>リクエストを受け付けました</h3>
            <p>以下の内容で予約の仮押さえを行いました。主催者からの承認をお待ちください。</p>
            <p><strong>メニュー:</strong> ${meetingType.title}</p>
            <p><strong>日時:</strong> ${date} ${time} (所要時間: ${duration_minutes}分)</p>
            <p><strong>場所:</strong> Google Meet</p>
        `
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Booking Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}