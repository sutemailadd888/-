// app/api/rules/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 共通: Supabaseクライアントを作成する関数
// (トークンがある場合は、そのユーザーとして振る舞うように設定します)
const createSupabaseClient = (token?: string) => {
  const options: any = {};
  if (token) {
    options.global = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    options
  );
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId');

  // ヘッダーからトークンを取得
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');

  // ★修正: トークンを渡してクライアント作成
  const supabase = createSupabaseClient(token);

  // ユーザー確認
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let query = supabase
    .from('meeting_rules')
    .select('*')
    .eq('user_id', user.id) // 念のため自分のデータに絞る
    .order('created_at', { ascending: false });

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

  // ★修正: トークンを渡してクライアント作成
  // これで insert 時も「このユーザー」としてDBにアクセスします
  const supabase = createSupabaseClient(token);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  if (!body.organization_id) {
    return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('meeting_rules')
    .insert([
      {
        user_id: user.id,
        organization_id: body.organization_id,
        title: body.title,
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

  // ★修正: トークンを渡してクライアント作成
  const supabase = createSupabaseClient(token);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('meeting_rules')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // ★修正: トークンを渡してクライアント作成
    const supabase = createSupabaseClient(token);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    const { error } = await supabase
        .from('meeting_rules')
        .update({
            title: body.title,
            target_day: body.targetDay,
            prompt_custom: body.prompt,
            attendees: body.attendees
        })
        .eq('id', body.id)
        .eq('user_id', user.id);
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}