'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Users, Calendar, LogOut, Briefcase, ExternalLink, 
  Menu, X, CheckCircle2, Loader2 
} from 'lucide-react';

// コンポーネント群
import MeetingCard from './components/MeetingCard';
import RuleList from './components/RuleList';
import CalendarView from './components/CalendarView';
import TokenSyncer from './components/TokenSyncer';
import RequestInbox from './components/RequestInbox';
import ScheduleSettings from './components/ScheduleSettings';
import WorkspaceSwitcher from './components/WorkspaceSwitcher';
// ★インポートはOKです
import { ensurePersonalWorkspace, getMyWorkspaces } from '@/utils/workspace';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // UI状態管理
  const [currentOrg, setCurrentOrg] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'meeting' | 'recruitment'>('meeting');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // セッションのチェック
    const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        
        // ★追加: セッションがあれば、個人用ワークスペースを確保(作成)し、初期表示する
        if (session) {
          try {
            // 1. なければ作る（あればそのIDが返る）
            await ensurePersonalWorkspace();
            
            // 2. ワークスペース一覧を取得
            const workspaces = await getMyWorkspaces();
            
            // 3. 最初の一つ（通常はPersonal）を選択状態にする
            if (workspaces && workspaces.length > 0) {
              setCurrentOrg(workspaces[0]);
            }
          } catch (error) {
            console.error('Workspace init error:', error);
          }
        }

        setLoading(false);
    };
    checkSession();

    // ログイン状態の監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      
      // ★追加: ログイン直後のイベントでも同様にワークスペースをロード
      if (session) {
          await ensurePersonalWorkspace();
          const workspaces = await getMyWorkspaces();
          if (workspaces && workspaces.length > 0) {
            setCurrentOrg(workspaces[0]);
          }
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    // ★修正: 404を防ぐため、コールバックを使わず直接トップページに戻す設定に変更
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin, // 現在のURL(トップページ)に戻る
        scopes: 'https://www.googleapis.com/auth/calendar',
        queryParams: { access_type: 'offline', prompt: 'consent select_account' },
      },
    });
  };

  const handleLogout = async () => {
    if (!confirm('ログアウトしますか？')) return;
    setLoading(true);
    await supabase.auth.signOut();
    localStorage.clear();
    setSession(null);
    setLoading(false);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400"><Loader2 className="animate-spin"/></div>;

  // ==========================================
  // 🔐 ログイン画面 (以前のデザインを復旧)
  // ==========================================
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
        <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-sm text-center border border-gray-100 animate-in fade-in zoom-in-95">
            
            {/* ロゴエリア */}
            <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-200">
            <span className="text-white text-2xl font-bold">G</span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">GAKU-HUB OS</h1>
            <p className="text-gray-500 mb-8 text-sm">Workspace & Booking Manager</p>

            {/* Googleログインボタン */}
            <button
            onClick={handleLogin}
            className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3 px-4 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-3 shadow-sm group"
            >
                {/* Google SVG Logo */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Googleでログイン</span>
            </button>
            
            <p className="mt-8 text-xs text-gray-400">© 2026 GAKU-HUB OS</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // 🖥️ メイン画面 (Dashboard)
  // ==========================================
  return (
    <div className="flex h-screen bg-white text-gray-800 font-sans overflow-hidden relative">
      
      {/* モバイル用ヘッダー */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-gray-900 text-white flex items-center justify-between px-4 z-40 shadow-md">
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 hover:bg-gray-700 rounded-lg">
           <Menu size={24} />
        </button>
        <span className="font-bold truncate max-w-[200px]">
            {currentOrg ? currentOrg.name : 'GAKU-HUB OS'}
        </span>
        <div className="w-8"></div>
      </div>

      {/* サイドバー (モバイル: スライド / PC: 固定) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in" onClick={closeMobileMenu}/>
      )}

      <div className={`
        fixed inset-y-0 left-0 z-50 flex h-full transition-transform duration-300 ease-in-out bg-gray-50
        md:relative md:translate-x-0 
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
         <WorkspaceSwitcher
           session={session}
           currentOrgId={currentOrg?.id}
           onSwitch={(org) => { setCurrentOrg(org); closeMobileMenu(); }}
         />

         <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col relative">
           <button onClick={closeMobileMenu} className="absolute top-3 right-3 p-2 text-gray-400 md:hidden"><X size={20} /></button>

           <div className="p-4 border-b border-gray-200 h-16 flex items-center mt-10 md:mt-0">
               {currentOrg ? (
                   <div className="font-bold text-gray-800 truncate text-lg">{currentOrg.name}</div>
               ) : (
                   <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
               )}
           </div>
          
           <div className="flex-1 overflow-y-auto py-4">
             <div className="px-4 py-1 text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Menu</div>
             <nav className="space-y-1 px-2">
               <SidebarItem icon={<Calendar size={18} />} label="日程調整 & カレンダー" active={activeTab === 'meeting'} onClick={() => { setActiveTab('meeting'); closeMobileMenu(); }} />
               <SidebarItem icon={<Briefcase size={18} />} label="採用面談リスト" active={activeTab === 'recruitment'} onClick={() => { setActiveTab('recruitment'); closeMobileMenu(); }} />
             </nav>
           </div>

           <div className="p-4 border-t border-gray-200 bg-gray-100/50">
             <div className="flex items-center space-x-3 mb-3">
               {session.user.user_metadata.avatar_url ? (
                   <img src={session.user.user_metadata.avatar_url} className="w-8 h-8 rounded-full border border-gray-200"/>
               ) : (
                   <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">{session.user.email?.slice(0,2).toUpperCase()}</div>
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

      {/* コンテンツエリア */}
      <main className="flex-1 overflow-y-auto relative bg-white w-full">
        <div className="pt-14 md:pt-0 min-h-full">
           <div className="h-32 md:h-48 bg-gradient-to-r from-gray-100 to-gray-200 relative">
             <div className="absolute bottom-4 left-6 md:left-12">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
                   {currentOrg ? currentOrg.name : 'Loading...'}
                   {currentOrg && <CheckCircle2 size={20} className="text-blue-500" />}
                </h1>
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1"><Users size={12}/> Dashboard Overview</p>
             </div>
           </div>

           <div className="max-w-4xl mx-auto px-4 md:px-12 py-8 pb-32">
               <TokenSyncer session={session} />

               {!currentOrg && (
                   <div className="text-center py-20 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                       <p>ワークスペースを選択または作成してください</p>
                   </div>
               )}

               {currentOrg && activeTab === 'meeting' && (
                   <div key={currentOrg.id} className="animate-in fade-in space-y-8">
                       <RequestInbox session={session} orgId={currentOrg.id} />
                       <CalendarView session={session} />
                       <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                           <div className="flex-1"><ScheduleSettings session={session} orgId={currentOrg.id} /></div>
                           <a href={`/book/${session.user.id}?orgId=${currentOrg.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-sm text-purple-700 hover:text-white font-bold bg-purple-50 hover:bg-purple-600 border border-purple-200 px-6 py-3 rounded-xl transition shadow-sm h-full">
                               <ExternalLink size={16}/> <span>予約ページを開く</span>
                           </a>
                       </div>
                       <MeetingCard session={session} orgId={currentOrg.id} />
                       <RuleList session={session} orgId={currentOrg.id} />
                   </div>
               )}

               {currentOrg && activeTab === 'recruitment' && (
                   <div className="text-center py-24 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 animate-in fade-in">
                       <Briefcase className="mx-auto text-gray-300 mb-4" size={48} />
                       <h3 className="text-xl font-bold text-gray-400">採用面談リスト</h3>
                       <p className="text-gray-400 text-sm mt-2">{currentOrg.name} の採用情報をここに表示します。<br/>(Coming Soon)</p>
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
    <div onClick={onClick} className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-all duration-200 ${active ? 'bg-purple-100 text-purple-900 font-bold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
      <span className={active ? "text-purple-600" : "text-gray-400"}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}