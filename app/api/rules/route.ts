// app/api/rules/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ★修正: リクエストのたびに、そのトークンを使ってSupabaseに接続する
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`, // ここで身分証を渡す！
        },
      },
    }
  );

  // DBからルールを取得
  const { data, error } = await supabase
    .from('meeting_rules')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rules: data });
}

export async function POST(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ★修正: ここでもトークンを使って接続
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`, // 身分証提示！
        },
      },
    }
  );

  // ユーザー情報を確認 (user_idを取得するため)
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

  const body = await request.json();

  // DBに保存
  const { data, error } = await supabase
    .from('meeting_rules')
    .insert([
      {
        user_id: user.id,
        title: body.title,
        target_day: body.targetDay,
        prompt_custom: body.prompt,
        duration_minutes: 60,
      },
    ])
    .select();

  if (error) {
      console.error("DB Insert Error:", error); // エラーをコンソールに出す
      return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, rule: data[0] });
}