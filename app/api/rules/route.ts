// app/api/rules/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// サーバー側でSupabaseを使う準備
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 1. ルールを取得する (GET)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ユーザーの特定
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

  // DBからルールを取得
  const { data, error } = await supabase
    .from('meeting_rules')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rules: data });
}

// 2. 新しいルールを保存する (POST)
export async function POST(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

  const body = await request.json();

  // DBに保存
  const { data, error } = await supabase
    .from('meeting_rules')
    .insert([
      {
        user_id: user.id,
        title: body.title,        // 会議名
        target_day: body.targetDay, // 毎月何日か
        prompt_custom: body.prompt, // AIへの要望
        duration_minutes: 60,     // とりあえず60分固定
      },
    ])
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, rule: data[0] });
}