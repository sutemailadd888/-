// app/page.tsx (Slack風レイアウト + Classic機能)
'use client';


import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Users, Calendar, LogOut, Briefcase, ExternalLink, CheckCircle2 } from 'lucide-react';
import MeetingCard from './components/MeetingCard';
import RuleList from './components/RuleList';
import CalendarView from './components/CalendarView';
import TokenSyncer from './components/TokenSyncer';
import RequestInbox from './components/RequestInbox';
import ScheduleSettings from './components/ScheduleSettings';
import WorkspaceSwitcher from './components/WorkspaceSwitcher';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);


export default function Home() {
 const [session, setSession] = useState<any>(null);
 const [loading, setLoading] = useState(true);
  // ワークスペース管理
 const [currentOrg, setCurrentOrg] = useState<any>(null);
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
   <div className="flex h-screen bg-white text-gray-800 font-sans overflow-hidden">
    
     {/* 1. 左端: ワークスペース切替 (Slack風) */}
     <WorkspaceSwitcher
       session={session}
       currentOrgId={currentOrg?.id}
       onSwitch={(org) => setCurrentOrg(org)}
     />


     {/* 2. 左: メニューサイドバー (Slack風) */}
     <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col hidden md:flex">
       <div className="p-4 border-b border-gray-200 h-16 flex items-center">
           {currentOrg ? (
               <div className="font-bold text-gray-800 truncate">{currentOrg.name}</div>
           ) : (
               <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
           )}
       </div>
      
       <div className="flex-1 overflow-y-auto py-2">
         <div className="px-4 py-1 text-xs text-gray-500 font-semibold mt-4">Apps</div>
         <nav className="space-y-1 px-2">
           <SidebarItem
               icon={<Calendar size={18} />}
               label="日程調整 & カレンダー"
               active={activeTab === 'meeting'}
               onClick={() => setActiveTab('meeting')}
           />
           {/* 将来の拡張用 */}
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


     {/* 3. 右: メインコンテンツ */}
     <main className="flex-1 overflow-y-auto relative bg-white">
       {/* ヘッダー画像エリア */}
       <div className="h-32 md:h-48 bg-gradient-to-r from-gray-100 to-gray-200 relative group">
         <div className="absolute bottom-4 left-4 md:left-12">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
               {currentOrg ? currentOrg.name : 'Loading...'}
            </h1>
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
               <Users size={12}/> {session.user.email}
            </p>
         </div>
       </div>


       {/* コンテンツエリア */}
       <div className="max-w-4xl mx-auto px-4 md:px-12 py-8 pb-24">
           <TokenSyncer session={session} />


           {!currentOrg && (
               <div className="text-center py-20 text-gray-400">
                   ワークスペースを選択または作成してください...
               </div>
           )}


           {/* ★ここから中身は「使い慣れたClassicデザイン」そのものです */}
           {currentOrg && activeTab === 'meeting' && (
               <div key={currentOrg.id} className="animation-fade-in space-y-8">
                  
                   {/* リクエスト受信箱 */}
                   <RequestInbox session={session} orgId={currentOrg.id} />


                   {/* Active Calendar */}
                   <CalendarView session={session} />
                  
                   {/* 設定と予約リンク (orgIdを渡す) */}
                   <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                       <ScheduleSettings session={session} orgId={currentOrg.id} />
                      
                       <a
                           href={`/book/${session.user.id}?orgId=${currentOrg.id}`}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 font-bold bg-purple-50 px-4 py-2 rounded-full transition"
                       >
                           <ExternalLink size={16}/> 自分の予約ページを確認する
                       </a>
                   </div>


                   {/* 自動調整 & AIチャット (orgIdを渡す) */}
                   <div className="grid md:grid-cols-1 gap-6">
                     <MeetingCard session={session} orgId={currentOrg.id} />
                   </div>
                  
                   <RuleList session={session} orgId={currentOrg.id} />


               </div>
           )}


           {currentOrg && activeTab === 'recruitment' && (
               <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 animation-fade-in">
                   <Briefcase className="mx-auto text-gray-300 mb-4" size={48} />
                   <h3 className="text-xl font-bold text-gray-400">採用面談リスト</h3>
                   <p className="text-gray-400 text-sm mt-2">
                       {currentOrg.name} の採用情報をここに表示します。<br/>
                       (現在開発中)
                   </p>
               </div>
           )}
          
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
