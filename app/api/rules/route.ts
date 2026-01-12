// app/api/rules/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 共通のクライアント作成関数
const createSupabase = (req: Request) => {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
};

export async function GET(request: Request) {
  const supabase = createSupabase(request);
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('meeting_rules')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data });
}

export async function POST(request: Request) {
  const supabase = createSupabase(request);
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

  const body = await request.json();

  const { data, error } = await supabase
    .from('meeting_rules')
    .insert([{
        user_id: user.id,
        title: body.title,
        target_day: body.targetDay,
        prompt_custom: body.prompt,
        attendees: body.attendees,
        duration_minutes: 60,
    }])
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, rule: data[0] });
}

// ★追加: ルールの削除
export async function DELETE(request: Request) {
  const supabase = createSupabase(request);
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const { error } = await supabase
    .from('meeting_rules')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ★追加: ルールの更新 (編集)
export async function PUT(request: Request) {
  const supabase = createSupabase(request);
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, title, targetDay, prompt, attendees } = body;

  const { data, error } = await supabase
    .from('meeting_rules')
    .update({
        title: title,
        target_day: targetDay,
        prompt_custom: prompt,
        attendees: attendees
    })
    .eq('id', id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, rule: data[0] });
}