import { createClient } from '@supabase/supabase-js';

// ブラウザ側でSupabaseクライアントを作成
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 自分のワークスペース一覧を取得する
export async function getMyWorkspaces() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select(`
      id,
      name,
      type,
      role: workspace_members ( role )
    `)
    .eq('workspace_members.user_id', user.id);

  if (error) {
    console.error('Error fetching workspaces:', error);
    return [];
  }

  return workspaces;
}

// 個人用ワークスペースが存在するか確認し、なければ作成する（初期化用）
export async function ensurePersonalWorkspace() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // 1. すでに個人用ワークスペースを持っているかチェック
  const { data: existingMembers } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(type)')
    .eq('user_id', user.id);
  
  // ネストされたデータを安全に取得
  const personalSpace = existingMembers?.find((m: any) => m.workspaces?.type === 'personal');

  if (personalSpace) {
    return personalSpace.workspace_id; // すでにあるなら何もしない
  }

  // 2. なければ作成する
  // 2-1. ワークスペースを作成
  const { data: newWorkspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      name: 'Personal Workspace', // デフォルト名
      type: 'personal'
    })
    .select()
    .single();

  if (wsError || !newWorkspace) {
    console.error('Failed to create workspace:', wsError);
    return null;
  }

  // 2-2. 自分をオーナーとしてメンバーに追加
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: newWorkspace.id,
      user_id: user.id,
      role: 'owner'
    });

  if (memberError) {
    console.error('Failed to add member:', memberError);
    return null;
  }

  return newWorkspace.id;
}