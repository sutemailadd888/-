// app/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Users, Calendar, LogOut, AlertTriangle, RefreshCw, Briefcase, ExternalLink } from 'lucide-react'; // ExternalLinkを追加
import MeetingCard from './components/MeetingCard';
import RuleList from './components/RuleList';
import CalendarView from './components/CalendarView';
import TokenSyncer from './components/TokenSyncer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'meeting' | 'recruitment'>('meeting');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: 'https://www.googleapis.com/auth/calendar',
        queryParams: { access_type: 'offline', prompt: 'consent select_account' },
      },
    });
  };

  const handleLogout = async () => {
    if (!confirm('ログアウトしますか？')) return;
    localStorage.clear();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">Loading...</div>;

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">GAKU-HUB Workspace</h1>
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full border border-gray-100">
          <p className="mb-6 text-gray-600">運営チームのための統合プラットフォーム。<br/>Googleアカウントで開始してください。</p>
          <button onClick={handleLogin} className="w-full flex items-center justify-center space-x-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-md transition shadow-sm">
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            <span>Googleでログイン</span>
          </button>
        </div>
      </div>
    );
  }

  const hasToken = session.provider_token;
  if (!hasToken) {
    return (
        <div className="flex h-screen items-center justify-center bg-gray-50 flex-col px-4">
            <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full border border-yellow-200">
                <AlertTriangle className="mx-auto text-yellow-500 mb-4" size={48} />
                <h2 className="text-xl font-bold text-gray-800 mb-2">再接続が必要です</h2>
                <button onClick={handleLogin} className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-md transition">
                    <RefreshCw size={18} /><span>Googleに再接続する</span>
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="flex h-screen bg-white text-gray-800 font-sans">
      <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col hidden md:flex">
        <div className="p-4 flex items-center space-x-2 text-gray-600 font-medium cursor-pointer hover:bg-gray-100 rounded-md m-2">
          <div className="w-6 h-6 bg-purple-600 rounded text-white flex items-center justify-center text-xs">G</div>
          <span>GAKU-HUB Admin</span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-4 py-1 text-xs text-gray-500 font-semibold mt-4">チームツール</div>
          <nav className="space-y-1 px-2">
            <SidebarItem 
                icon={<Calendar size={18} />} 
                label="定例ミーティング" 
                active={activeTab === 'meeting'} 
                onClick={() => setActiveTab('meeting')}
            />
            <SidebarItem 
                icon={<Briefcase size={18} />} 
                label="採用面談リスト" 
                active={activeTab === 'recruitment'} 
                onClick={() => setActiveTab('recruitment')}
            />
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
            <LogOut size={14}/><span>ログアウト</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="h-32 md:h-48 bg-gradient-to-r from-blue-100 to-purple-100 relative group">
          <button className="absolute bottom-4 right-4 bg-white/80 px-3 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition hidden md:block">カバー画像を変更</button>
        </div>

        <div className="max-w-4xl mx-auto px-4 md:px-12 py-8">
          <div className="mb-8 group">
            <div className="flex justify-between items-start">
               <div>
                  <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">{session.user.user_metadata.full_name}さんの<br className="md:hidden"/>ワークスペース</h1>
                  <div className="flex items-center space-x-2 text-gray-500 text-xs md:text-sm">
                    <Users size={14} /><span>参加者: {session.user.email}</span>
                  </div>
               </div>
               
               <button onClick={handleLogout} className="md:hidden flex flex-col items-center text-gray-400 hover:text-red-500 p-2 relative z-50 cursor-pointer">
                 <LogOut size={20}/><span className="text-[10px] mt-1">Exit</span>
               </button>
            </div>
            
            <div className="md:hidden flex gap-2 mt-6 overflow-x-auto pb-2">
                <button onClick={() => setActiveTab('meeting')} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap ${activeTab === 'meeting' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>定例ミーティング</button>
                <button onClick={() => setActiveTab('recruitment')} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap ${activeTab === 'recruitment' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>採用面談リスト</button>
            </div>

            <div className="border-b pb-4 mb-8 mt-4"></div>
          </div>

          <div className="space-y-6">
            
            {activeTab === 'meeting' ? (
                <div className="animation-fade-in">
                    <p className="text-gray-700 leading-relaxed text-sm md:text-base mb-6">
                        Google連携完了。ここから日程調整を開始できます。
                    </p>
                    
                    <CalendarView session={session} />
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <MeetingCard session={session} />
                    </div>
                    
                    <TokenSyncer session={session} />

                    <RuleList session={session} />

                    {/* ★ここに追加しました：予約ページへのリンクボタン */}
                    <div className="mt-12 bg-purple-50 p-6 rounded-xl border border-purple-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <h3 className="font-bold text-purple-900 text-base flex items-center gap-2">
                                <ExternalLink size={18}/> あなたの公開予約ページ
                            </h3>
                            <p className="text-sm text-purple-700 mt-1 opacity-80">
                                このURLを社外の人に送ると、面談の予約リクエストを受け付けられます。<br/>
                                (まだ空き状況とは連動していません)
                            </p>
                        </div>
                        <a 
                            href={`/book/${session.user.id}`} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full md:w-auto text-center bg-purple-600 text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-purple-700 transition shadow-sm hover:shadow-md"
                        >
                            ページを開く
                        </a>
                    </div>
                </div>
            ) : (
                <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 animation-fade-in">
                    <Briefcase className="mx-auto text-gray-300 mb-4" size={48} />
                    <h3 className="text-xl font-bold text-gray-400">採用面談リスト</h3>
                    <p className="text-gray-400 text-sm mt-2">この機能は現在開発中です。<br/>次のアップデートをお待ちください。</p>
                </div>
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <div 
        onClick={onClick}
        className={`flex items-center space-x-3 px-3 py-1.5 rounded-md cursor-pointer text-sm transition ${active ? 'bg-gray-200 text-gray-900 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      <span className={active ? "text-purple-600" : "text-gray-500"}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}