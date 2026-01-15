// app/api/rules/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId'); // ★URLから組織IDを受け取る

  // セキュリティ: ヘッダーからトークンを取得してユーザー特定
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ユーザー確認
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let query = supabase
    .from('meeting_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // ★重要: orgIdがある場合は、その組織のルールだけを返す
  if (orgId) {
    query = query.eq('organization_id', orgId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rules: data });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  // ★重要: organization_id が必須
  if (!body.organization_id) {
    return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('meeting_rules')
    .insert([
      {
        user_id: user.id,
        organization_id: body.organization_id, // ★ここを受け取って保存！
        rule_name: body.title, // カラム名のマッピングに注意
        rule_type: 'monthly_date', // 一旦固定
        target_day: body.targetDay,
        prompt_custom: body.prompt,
        attendees: body.attendees,
        is_active: true
      }
    ])
    .select();

  if (error) {
    console.error("DB Save Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, rule: data[0] });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!id || !token) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('meeting_rules')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id); // 他人のルールを消さないように

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// 編集用 (PUT)
export async function PUT(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser(token!);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    const { error } = await supabase
        .from('meeting_rules')
        .update({
            rule_name: body.title,
            target_day: body.targetDay,
            prompt_custom: body.prompt,
            attendees: body.attendees
        })
        .eq('id', body.id)
        .eq('user_id', user.id);
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}