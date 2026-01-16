'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { 
  Calendar, Users, Settings, LogOut, Plus, 
  Briefcase, GraduationCap, ChevronRight, 
  Menu, X, Building, Mail 
} from 'lucide-react';

// コンポーネント
import RequestInbox from './components/RequestInbox';
import GoogleCalendarView from './components/GoogleCalendarView';
import OrgSettings from './components/OrgSettings';

// Supabaseクライアント
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ワークスペース関連
  const [orgs, setOrgs] = useState<any[]>([]);
  const [currentOrg, setCurrentOrg] = useState<any>(null);

  // UI状態
  const [activeTab, setActiveTab] = useState('meeting'); // meeting | recruitment | settings
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // モバイルメニューの開閉

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setSession(session);

      // 所属する組織を取得
      const { data: members, error } = await supabase
        .from('organization_members')
        .select('organization:organizations(*)')
        .eq('user_id', session.user.id);

      if (members && members.length > 0) {
        // 型変換: 配列をフラットにする
        const myOrgs = members.map((m: any) => m.organization);
        setOrgs(myOrgs);
        
        // ローカルストレージに前回開いていたIDがあればそれを復元
        const lastOrgId = localStorage.getItem('lastOrgId');
        const targetOrg = myOrgs.find((o: any) => o.id === lastOrgId) || myOrgs[0];
        
        setCurrentOrg(targetOrg);
      } else {
        // まだ組織がない場合は作成画面へ（簡易対応）
        // router.push('/onboarding'); // 必要なら実装
      }
      setLoading(false);
    };
    init();
  }, [router]);

  // ワークスペース切り替え
  const switchOrg = (org: any) => {
    setCurrentOrg(org);
    localStorage.setItem('lastOrgId', org.id);
    setIsMobileMenuOpen(false); // モバイルならメニューを閉じる
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50"><div className="animate-spin text-purple-600">Loading...</div></div>;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-900">
      
      {/* ===========================================
        MOBILE HEADER (Slack風トップバー)
        ===========================================
        md:hidden なのでPCでは消えます
      */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-purple-900 text-white flex items-center justify-between px-4 z-30 shadow-md">
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 hover:bg-white/10 rounded-lg transition">
            <Menu size={24} />
        </button>
        <div className="font-bold text-lg flex items-center gap-2">
            {currentOrg?.name || 'Loading...'}
        </div>
        <div className="w-10"></div> {/* レイアウト調整用のダミー */}
      </div>

      {/* ===========================================
        SIDEBAR (PC: 常時表示 / Mobile: スライドパネル)
        ===========================================
      */}
      {/* モバイル用オーバーレイ（背景を暗くする） */}
      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 text-white flex flex-col transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* サイドバーヘッダー */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
            <div>
                <h1 className="text-xl font-bold tracking-tight">GAKU-HUB OS</h1>
                <p className="text-xs text-gray-400 mt-1">Workspace Manager</p>
            </div>
            {/* モバイル用閉じるボタン */}
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-400">
                <X size={24} />
            </button>
        </div>

        {/* ワークスペースリスト */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">Workspaces</h2>
                <div className="space-y-1">
                    {orgs.map((org) => (
                        <button
                            key={org.id}
                            onClick={() => switchOrg(org)}
                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                                currentOrg?.id === org.id 
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' 
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            }`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                                currentOrg?.id === org.id ? 'bg-white text-purple-600' : 'bg-gray-700'
                            }`}>
                                {org.name.slice(0, 2)}
                            </div>
                            <span className="font-medium truncate">{org.name}</span>
                            {currentOrg?.id === org.id && <div className="ml-auto w-2 h-2 bg-green-400 rounded-full"></div>}
                        </button>
                    ))}
                    
                    {/* 新規作成ボタン (ダミー) */}
                    <button className="w-full flex items-center gap-3 px-3 py-3 text-gray-500 hover:text-gray-300 transition-colors border border-dashed border-gray-700 rounded-xl mt-2 hover:border-gray-500">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-600">
                            <Plus size={16} />
                        </div>
                        <span className="text-sm">新しいチームを作成</span>
                    </button>
                </div>
            </div>
        </div>

        {/* ログアウトエリア */}
        <div className="p-4 border-t border-gray-800">
            <div className="flex items-center gap-3 px-3 py-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-400 to-pink-400"></div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-white">{session.user.email}</p>
                    <p className="text-xs text-gray-500">Login User</p>
                </div>
            </div>
            <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-2 text-gray-400 hover:text-red-400 px-3 py-2 transition-colors text-sm"
            >
                <LogOut size={16} />
                ログアウト
            </button>
        </div>
      </aside>


      {/* ===========================================
        MAIN CONTENT
        ===========================================
      */}
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        
        {/* モバイル時のヘッダー裏の余白 (高さ確保) */}
        <div className="h-16 md:hidden flex-shrink-0"></div>

        {/* コンテンツヘッダー & タブ切り替え */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 hidden md:block">
                        {currentOrg?.name}
                    </h2>
                    <p className="text-sm text-gray-500 hidden md:block">Dashboard Overview</p>
                </div>

                {/* タブメニュー (横スクロール対応) */}
                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                    <button 
                        onClick={() => setActiveTab('meeting')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                            activeTab === 'meeting' 
                            ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' 
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                    >
                        <Calendar size={16}/>
                        日程調整
                    </button>
                    <button 
                        onClick={() => setActiveTab('recruitment')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                            activeTab === 'recruitment' 
                            ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' 
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                    >
                        <Users size={16}/>
                        採用面談リスト
                    </button>
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                            activeTab === 'settings' 
                            ? 'bg-gray-100 text-gray-700 ring-1 ring-gray-300' 
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                    >
                        <Settings size={16}/>
                        設定
                    </button>
                </div>
            </div>
        </header>

        {/* スクロール可能なメインエリア */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto pb-20 md:pb-0">
                
                {/* 1. 日程調整タブ */}
                {activeTab === 'meeting' && currentOrg && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* 予約ページへのリンクカード */}
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Briefcase size={20}/>
                                    あなたの予約ページ
                                </h3>
                                <p className="text-purple-100 text-sm mt-1 opacity-90">
                                    このURLをシェアするだけで、<br className="md:hidden"/>自動で日程調整が完了します。
                                </p>
                            </div>
                            <a 
                                href={`/book/${session.user.id}?orgId=${currentOrg.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-white text-purple-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-purple-50 transition shadow-sm flex items-center gap-2"
                            >
                                予約ページを確認
                                <ChevronRight size={16}/>
                            </a>
                        </div>

                        <RequestInbox session={session} orgId={currentOrg.id} />
                        
                        <GoogleCalendarView session={session} orgId={currentOrg.id} />
                    </div>
                )}

                {/* 2. 採用面談リストタブ */}
                {activeTab === 'recruitment' && (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400 animate-in fade-in">
                        <div className="bg-gray-100 p-4 rounded-full mb-4">
                            <Users size={32} />
                        </div>
                        <p className="font-bold">採用面談リストは準備中です</p>
                        <p className="text-sm">次のアップデートをお楽しみに！</p>
                    </div>
                )}

                {/* 3. 設定タブ */}
                {activeTab === 'settings' && currentOrg && (
                    <div className="animate-in fade-in">
                        <OrgSettings session={session} orgId={currentOrg.id} />
                    </div>
                )}
            </div>
        </div>

      </main>
    </div>
  );
}