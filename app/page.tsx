// app/page.tsx (Classic Layout)
'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Users, LogOut, ExternalLink, Bot, Calendar as CalendarIcon, Settings } from 'lucide-react';
import MeetingCard from './components/MeetingCard';
import RuleList from './components/RuleList';
import CalendarView from './components/CalendarView';
import TokenSyncer from './components/TokenSyncer';
import RequestInbox from './components/RequestInbox';
import ScheduleSettings from './components/ScheduleSettings';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrg, setCurrentOrg] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchPrimaryOrg(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchPrimaryOrg(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 自動的に「あなたのメインのワークスペース」を読み込みます
  const fetchPrimaryOrg = async (userId: string) => {
    const { data: members } = await supabase
        .from('organization_members')
        .select(`organization_id, organizations ( id, name )`)
        .eq('user_id', userId);
    
    // 見つかった最初の組織を自動セット（これで画面が真っ白になりません）
    if (members && members.length > 0) {
        setCurrentOrg(members[0].organizations);
    }
  };

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
        <h1 className="text-3xl font-bold mb-8 text-gray-800">GAKU-HUB OS</h1>
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full border border-gray-100">
            <button onClick={handleLogin} className="w-full flex items-center justify-center space-x-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-md transition shadow-sm">
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            <span>Googleでログイン</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      {/* シンプルヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800">GAKU-HUB OS</h1>
            <div className="flex items-center gap-4">
                <div className="text-xs text-right hidden sm:block">
                    <div className="font-bold">{session.user.user_metadata.full_name}</div>
                    <div className="text-gray-400">{currentOrg ? currentOrg.name : 'Loading...'}</div>
                </div>
                <button onClick={handleLogout} className="text-gray-400 hover:text-red-600 p-2">
                    <LogOut size={20}/>
                </button>
            </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-10 pb-24">
        <TokenSyncer session={session} />

        {/* ワークスペース読み込み待ち */}
        {!currentOrg && (
            <div className="text-center py-20 text-gray-500 flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4"></div>
                ワークスペースを読み込んでいます...
            </div>
        )}

        {/* メインコンテンツエリア */}
        {currentOrg && (
            <div key={currentOrg.id} className="animate-in fade-in duration-500 space-y-10">
                
                {/* 1. リクエスト受信箱 */}
                <RequestInbox session={session} />

                {/* 2. Active Calendar (カレンダービュー) */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-700 flex items-center gap-2">
                            <CalendarIcon className="text-purple-600"/> Active Calendar
                        </h2>
                    </div>
                    <CalendarView session={session} />
                </section>

                {/* 3. 設定 & 予約リンクエリア */}
                <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex-1 w-full">
                            <h3 className="text-base font-bold text-gray-700 mb-2 flex items-center gap-2">
                                <Settings size={18}/> 予約受付設定
                            </h3>
                            {/* 設定コンポーネント: ここで orgId を渡しているので保存可能です */}
                            <ScheduleSettings session={session} orgId={currentOrg.id} />
                        </div>

                        <div className="hidden md:block w-px h-16 bg-gray-100"></div>

                        <div className="flex-1 w-full flex flex-col items-end">
                            <a 
                                href={`/book/${session.user.id}?orgId=${currentOrg.id}`} 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-purple-600 text-white font-bold px-6 py-3 rounded-full hover:bg-purple-700 transition shadow-md"
                            >
                                <ExternalLink size={18}/> 予約ページを確認
                            </a>
                            <p className="text-xs text-gray-400 mt-2">
                                相手に送るURL: .../book/{session.user.id}
                            </p>
                        </div>
                    </div>
                </section>

                {/* 4. 自動調整ルール (MeetingCard & RuleList) */}
                <section>
                    <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <Bot className="text-blue-600"/> 自動調整ルール
                    </h2>
                    
                    <div className="grid md:grid-cols-2 gap-6 mb-8">
                        {/* 自動調整作成カード: orgId を渡しているのでエラーになりません */}
                        <MeetingCard session={session} orgId={currentOrg.id} />
                        
                        {/* ここに将来、別のカードを追加できます */}
                        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 text-sm p-6">
                            新しい機能を追加予定...
                        </div>
                    </div>

                    {/* 作成済みのルール一覧 */}
                    <RuleList session={session} orgId={currentOrg.id} />
                </section>

            </div>
        )}
      </main>
    </div>
  );
}