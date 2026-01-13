// app/components/TokenSyncer.tsx
'use client';

import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- Supabaseの初期化 ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Props {
  session: any;
}

export default function TokenSyncer({ session }: Props) {
  useEffect(() => {
    const syncToken = async () => {
      if (!session?.provider_token) return;

      // ユーザーのトークンをテーブルに保存(Upsert)
      const { error } = await supabase
        .from('user_secrets')
        .upsert({
          user_id: session.user.id,
          access_token: session.provider_token,
          refresh_token: session.provider_refresh_token || null, // あれば保存
          updated_at: new Date().toISOString()
        });
      
      if (error) console.error("Token Sync Error:", error);
    };

    syncToken();
  }, [session]);

  return null; // 画面には何も表示しない「黒子」コンポーネント
}