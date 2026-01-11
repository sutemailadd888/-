// app/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Menu, Plus, Clock, Users, Calendar, LogOut } from 'lucide-react';
import MeetingCard from './components/MeetingCard';
import RuleList from './components/RuleList'; // ★追加済み

// --- Supabaseの初期化 ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const [session, setSession] = useState<any>(null);

  // アプリを開いた時に「ログインしてる？」を確認する
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ログイン処理
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: 'https://www.googleapis.com/auth/calendar',
      },
    });
  };

  // ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- ログインしていない時の画面 ---
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Smart Scheduler</h1>
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full border border-gray-100">
          <p className="mb-6 text-gray-600">チームのためのAI日程調整ツールへようこそ。<br/>Googleアカウントで開始してください。</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center space-x-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-md transition shadow-sm"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            <span>Googleでログイン</span>
          </button>
        </div>
      </div>
    );
  }

  // --- ログイン後の画面 ---
  return (
    <div className="flex h-screen bg-white text-gray-800 font-sans">
      {/* 左サイドバー */}
      <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col hidden md:flex">
        <div className="p-4 flex items-center space-x-2 text-gray-600 font-medium cursor-pointer hover:bg-gray-100 rounded-md m-2">
          <div className="w-6 h-6 bg-purple-600 rounded text-white flex items-center justify-center text-xs">S</div>
          <span>Smart Workspace</span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-4 py-1 text-xs text-gray-500 font-semibold mt-4">チーム開発部</div>
          <nav className="space-y-1 px-2">
            <SidebarItem icon={<Calendar size={18} />} label="定例ミーティング" active />
            <SidebarItem icon={<Users size={18} />} label="採用面談リスト" />
          </nav>
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3 mb-3">
            <img src={session.user.user_metadata.avatar_url} className="w-8 h-8 rounded-full border border-gray-200"/>
            <div className="text-xs truncate w-32">
                <div className="font-semibold text-gray-700">{session.user.user_metadata.full_name}</div>
                <div className="text-gray-400">Online</div>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center space-x-2 text-xs text-gray-500 hover:text-red-600 w-full px-1">
            <LogOut size={14}/>
            <span>ログアウト</span>
          </button>
        </div>
      </aside>

      {/* メインキャンバス */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="h-48 bg-gradient-to-r from-blue-100 to-purple-100 relative group">
          <button className="absolute bottom-4 right-4 bg-white/80 px-3 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition">カバー画像を変更</button>
        </div>

        <div className="max-w-4xl mx-auto px-12 py-8">
          <div className="mb-8 group">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{session.user.user_metadata.full_name}さんのワークスペース</h1>
            
            <div className="flex items-center space-x-6 text-gray-500 text-sm border-b pb-4 mb-8">
              <div className="flex items-center space-x-2">
                <Users size={16} />
                <span>参加者: {session.user.email} (あなた)</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <p className="text-gray-700 leading-relaxed">
              Google連携が完了しました！ここから日程調整を開始できます。
            </p>

            {/* AI手動調整カード */}
            <MeetingCard session={session} />
            
            {/* ★自動調整ルールリスト★ */}
            <RuleList session={session} />
            
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={`flex items-center space-x-3 px-3 py-1.5 rounded-md cursor-pointer text-sm ${active ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}>
      <span className="text-gray-500">{icon}</span>
      <span>{label}</span>
    </div>
  );
}