// app/api/book/slots/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 管理者権限でSupabaseを操作するクライアント
// ※注意: 本来は Service Role Key を使うべきですが、
// 簡易的にAnon Key + RLS回避(または自身のトークン)で実装します。
// 今回は「user_secrets」を読み取るために、簡易的な手法として
// 「クライアント側から渡されたID」を信用してDB検索します。
// (商用環境ではService Role Keyを環境変数に入れて使ってください)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hostId = searchParams.get('hostId');
  const date = searchParams.get('date'); // YYYY-MM-DD

  if (!hostId || !date) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  try {
    // 1. 金庫からホストのトークンを取得 (Service Roleが必要だが、ここではRLSポリシーに頼る)
    // ★重要: ここで本来は process.env.SUPABASE_SERVICE_ROLE_KEY を使うべきですが、
    // セキュリティ設定(RLS)で "Select" が許可されていないと他人のトークンは見れません。
    // 今回のSQLでは「自分しか見れない」設定にしました。
    // そのため、このAPIは「Server側で管理者権限」で動かす必要があります。
    
    // 【簡易対応】
    // 今回はデモのため、user_secrets の Select ポリシーを一時的に開放するか、
    // もしくは Service Role Key を env に追加する必要があります。
    // ここでは、ユーザーの手間を減らすため、直前に作ったテーブルのポリシーを
    // 「APIからは読める」ように変更するSQLを後で案内します。
    
    // 一旦、Service Role Key がある前提のコードを書きます（後述の設定が必要）
    const adminAuthClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // フォールバック
    );

    const { data: secrets } = await adminAuthClient
      .from('user_secrets')
      .select('access_token')
      .eq('user_id', hostId)
      .single();

    if (!secrets?.access_token) {
        return NextResponse.json({ error: 'Host is offline (Token not found)' }, { status: 404 });
    }

    // 2. Google Calendar API (FreeBusy) を叩く
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
    const googleData = await googleRes.json();
    
    // 3. 忙しい時間を解析して、空き枠(Slots)を作る
    const busyRanges = googleData.calendars.primary.busy; // [{start:..., end:...}, ...]
    
    // 提供する枠の候補 (10:00 〜 18:00)
    const candidates = [10, 11, 13, 14, 15, 16, 17];
    const availableSlots = [];

    for (const hour of candidates) {
        const slotStart = new Date(`${date}T${hour}:00:00+09:00`);
        const slotEnd = new Date(`${date}T${hour + 1}:00:00+09:00`);

        // この枠が「忙しい時間」と被っていないかチェック
        const isBusy = busyRanges.some((range: any) => {
            const rangeStart = new Date(range.start);
            const rangeEnd = new Date(range.end);
            // 被り判定 (Slotの開始がRangeの終了より前、かつ、Slotの終了がRangeの開始より後)
            return slotStart < rangeEnd && slotEnd > rangeStart;
        });

        if (!isBusy) {
            availableSlots.push(`${hour}:00`);
        }
    }

    return NextResponse.json({ slots: availableSlots });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}