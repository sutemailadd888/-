'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Users, Calendar, LogOut, Briefcase, ExternalLink, 
  Menu, X, CheckCircle2 
} from 'lucide-react';

// ★既存のコンポーネントを正しくインポート
import MeetingCard from './components/MeetingCard';
import RuleList from './components/RuleList';
import CalendarView from './components/CalendarView';
import TokenSyncer from './components/TokenSyncer';
import RequestInbox from './components/RequestInbox';
import ScheduleSettings from './components/ScheduleSettings'; // OrgSettingsではなくこれを使う
import WorkspaceSwitcher from './components/WorkspaceSwitcher';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // UI状態管理
  const [currentOrg, setCurrentOrg] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'meeting' | 'recruitment'>('meeting');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // ★モバイルメニュー開閉用

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
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'https://www.googleapis.com/auth/calendar',
        queryParams: { access_type: 'offline', prompt: 'consent select_account' },
      },
    });
  };

  // app/page.tsx の中にある handleLogout をこれに書き換え

  const handleLogout = async () => {
    if (!confirm('ログアウトしますか？')) return;
    
    // 1. ローディング状態にする（ボタン連打防止）
    setLoading(true);

    try {
        // 2. Supabaseからログアウト
        await supabase.auth.signOut();
        
        // 3. ローカルストレージ（開いていたタブの記憶など）を消す
        localStorage.clear();

        // 4. セッションを空にして、画面をログインモードに切り替える
        setSession(null);
    } catch (error) {
        console.error("Logout error:", error);
    } finally {
        // 5. 最後にローディングを解除（これでログイン画面が表示されます）
        setLoading(false);
    }
  };

  // モバイルメニューを閉じる処理（タブ切り替え時など）
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">Loading...</div>;

  // --- ログイン画面 (セッションがない場合) ---
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col font-sans">
        <h1 className="text-3xl font-bold mb-8 text-gray-800 tracking-tight">GAKU-HUB OS</h1>
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full border border-gray-100">
           <p className="text-gray-500 mb-6 text-sm">Workspace & Booking Manager</p>
           <button onClick={handleLogin} className="w-full flex items-center justify-center space-x-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-3 px-4 rounded-xl transition shadow-sm">
             <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
             <span>Googleでログイン</span>
           </button>
        </div>
      </div>
    );
  }

  // --- メイン画面 ---
  return (
    <div className="flex h-screen bg-white text-gray-800 font-sans overflow-hidden relative">
      
      {/* ===========================================
        1. モバイル用ヘッダー (Slack風)
        md:hidden なのでPCでは消えます
        ===========================================
      */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-gray-900 text-white flex items-center justify-between px-4 z-40 shadow-md">
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 hover:bg-gray-700 rounded-lg">
           <Menu size={24} />
        </button>
        <span className="font-bold truncate max-w-[200px]">
            {currentOrg ? currentOrg.name : 'GAKU-HUB OS'}
        </span>
        <div className="w-8"></div> {/* レイアウト調整用ダミー */}
      </div>

      {/* ===========================================
        2. サイドバーエリア (Switcher + Navigation)
        モバイル: 左からスライドイン
        PC: 常時表示
        ===========================================
      */}
      
      {/* モバイル用背景オーバーレイ */}
      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in"
            onClick={closeMobileMenu}
        />
      )}

      {/* サイドバー本体コンテナ */}
      <div className={`
        fixed inset-y-0 left-0 z-50 flex h-full transition-transform duration-300 ease-in-out bg-gray-50
        md:relative md:translate-x-0 
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
         
         {/* A. ワークスペース切替 (左端の細い列) */}
         <WorkspaceSwitcher
           session={session}
           currentOrgId={currentOrg?.id}
           onSwitch={(org) => {
             setCurrentOrg(org);
             closeMobileMenu(); // 切り替えたらメニューを閉じる
           }}
         />

         {/* B. メニューナビゲーション (その隣) */}
         <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col relative">
           {/* モバイル用閉じるボタン */}
           <button onClick={closeMobileMenu} className="absolute top-3 right-3 p-2 text-gray-400 md:hidden">
              <X size={20} />
           </button>

           {/* 組織名ヘッダー */}
           <div className="p-4 border-b border-gray-200 h-16 flex items-center mt-10 md:mt-0">
               {currentOrg ? (
                   <div className="font-bold text-gray-800 truncate text-lg">{currentOrg.name}</div>
               ) : (
                   <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
               )}
           </div>
          
           {/* メニューリスト */}
           <div className="flex-1 overflow-y-auto py-4">
             <div className="px-4 py-1 text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Menu</div>
             <nav className="space-y-1 px-2">
               <SidebarItem
                   icon={<Calendar size={18} />}
                   label="日程調整 & カレンダー"
                   active={activeTab === 'meeting'}
                   onClick={() => { setActiveTab('meeting'); closeMobileMenu(); }}
               />
               <SidebarItem
                   icon={<Briefcase size={18} />}
                   label="採用面談リスト"
                   active={activeTab === 'recruitment'}
                   onClick={() => { setActiveTab('recruitment'); closeMobileMenu(); }}
               />
             </nav>
           </div>

           {/* ユーザー情報 & ログアウト */}
           <div className="p-4 border-t border-gray-200 bg-gray-100/50">
             <div className="flex items-center space-x-3 mb-3">
               {session.user.user_metadata.avatar_url ? (
                   <img src={session.user.user_metadata.avatar_url} className="w-8 h-8 rounded-full border border-gray-200"/>
               ) : (
                   <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                       {session.user.email?.slice(0,2).toUpperCase()}
                   </div>
               )}
               <div className="text-xs truncate w-32">
                   <div className="font-bold text-gray-700">{session.user.user_metadata.full_name || 'User'}</div>
                   <div className="text-gray-500 text-[10px]">{session.user.email}</div>
               </div>
             </div>
             <button onClick={handleLogout} className="flex items-center justify-center space-x-2 text-xs text-red-500 font-bold hover:bg-red-50 w-full py-2 rounded-lg transition border border-transparent hover:border-red-100">
               <LogOut size={14}/><span>ログアウト</span>
             </button>
           </div>
         </aside>
      </div>

      {/* ===========================================
        3. メインコンテンツエリア
        ===========================================
      */}
      <main className="flex-1 overflow-y-auto relative bg-white w-full">
        
        {/* モバイルヘッダー分の余白 (pt-14) */}
        <div className="pt-14 md:pt-0 min-h-full">

           {/* PC用ヘッダー画像 (モバイルでは少し高さを減らす) */}
           <div className="h-32 md:h-48 bg-gradient-to-r from-gray-100 to-gray-200 relative">
             <div className="absolute bottom-4 left-6 md:left-12">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
                   {currentOrg ? currentOrg.name : 'Loading...'}
                   {currentOrg && <CheckCircle2 size={20} className="text-blue-500" />}
                </h1>
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                   <Users size={12}/> Dashboard Overview
                </p>
             </div>
           </div>

           {/* コンテンツ本体 */}
           <div className="max-w-4xl mx-auto px-4 md:px-12 py-8 pb-32">
               <TokenSyncer session={session} />

               {!currentOrg && (
                   <div className="text-center py-20 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                       <p>ワークスペースを選択または作成してください</p>
                   </div>
               )}

               {currentOrg && activeTab === 'meeting' && (
                   <div key={currentOrg.id} className="animate-in fade-in space-y-8">
                      
                       {/* 1. リクエスト受信箱 */}
                       <RequestInbox session={session} orgId={currentOrg.id} />

                       {/* 2. カレンダー */}
                       <CalendarView session={session} />
                      
                       {/* 3. 設定と予約リンク */}
                       <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                           <div className="flex-1">
                               <ScheduleSettings session={session} orgId={currentOrg.id} />
                           </div>
                           <a
                               href={`/book/${session.user.id}?orgId=${currentOrg.id}`}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="flex items-center justify-center gap-2 text-sm text-purple-700 hover:text-white font-bold bg-purple-50 hover:bg-purple-600 border border-purple-200 px-6 py-3 rounded-xl transition shadow-sm h-full"
                           >
                               <ExternalLink size={16}/> <span>予約ページを開く</span>
                           </a>
                       </div>

                       {/* 4. 自動調整設定 */}
                       <MeetingCard session={session} orgId={currentOrg.id} />
                      
                       {/* 5. ルールリスト */}
                       <RuleList session={session} orgId={currentOrg.id} />

                   </div>
               )}

               {currentOrg && activeTab === 'recruitment' && (
                   <div className="text-center py-24 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 animate-in fade-in">
                       <Briefcase className="mx-auto text-gray-300 mb-4" size={48} />
                       <h3 className="text-xl font-bold text-gray-400">採用面談リスト</h3>
                       <p className="text-gray-400 text-sm mt-2">
                           {currentOrg.name} の採用情報をここに表示します。<br/>
                           (Coming Soon)
                       </p>
                   </div>
               )}
              
           </div>
        </div>
      </main>
    </div>
  );
}

// サイドバー項目の部品
function SidebarItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <div
        onClick={onClick}
        className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-all duration-200 ${
            active 
            ? 'bg-purple-100 text-purple-900 font-bold' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
    >
      <span className={active ? "text-purple-600" : "text-gray-400"}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}