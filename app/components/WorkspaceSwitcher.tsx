'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Building2, User, X, Check } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
  session: any;
  currentOrgId: string | null;
  onSwitch: (org: any) => void;
}

export default function WorkspaceSwitcher({ session, currentOrgId, onSwitch }: Props) {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  
  // モーダル用の状態管理
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsType, setNewWsType] = useState<'personal' | 'team'>('team'); // デフォルトはチーム
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, [session]);

  const fetchWorkspaces = async () => {
    if (!session?.user?.id) return;
    
    const { data: members, error } = await supabase
        .from('workspace_members')
        .select(`
            workspace_id,
            workspaces ( id, name, type )
        `)
        .eq('user_id', session.user.id);

    if (error) {
        console.error('Fetch error:', error);
        return;
    }
    
    if (members) {
        const loadedWorkspaces = members
            .map((m: any) => m.workspaces)
            .filter((ws: any) => ws !== null);

        // 並び順: 個人用を先に、次にチーム用
        loadedWorkspaces.sort((a: any, b: any) => {
            if (a.type === b.type) return 0;
            return a.type === 'personal' ? -1 : 1;
        });

        setWorkspaces(loadedWorkspaces);
        
        // 選択中のものがなく、リストがあれば自動選択
        if (!currentOrgId && loadedWorkspaces.length > 0) {
            onSwitch(loadedWorkspaces[0]);
        }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    setIsCreating(true);

    try {
        // 1. ワークスペース作成 (選択されたタイプを使用)
        const { data: newWs, error: wsError } = await supabase
            .from('workspaces')
            .insert([{ 
                name: newWsName, 
                type: newWsType 
            }])
            .select()
            .single();

        if (wsError) throw wsError;

        // 2. メンバー追加 (自分をオーナーに)
        const { error: memberError } = await supabase
            .from('workspace_members')
            .insert([{ 
                workspace_id: newWs.id, 
                user_id: session.user.id, 
                role: 'owner' 
            }]);

        if (memberError) throw memberError;

        // 完了処理
        await fetchWorkspaces();
        onSwitch(newWs); // 作ったものに切り替え
        closeModal();

    } catch (error: any) {
        alert(`作成エラー: ${error.message}`);
    } finally {
        setIsCreating(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setNewWsName('');
    setNewWsType('team');
  };

  return (
    <>
        <div className="w-[70px] bg-gray-900 flex flex-col items-center py-6 gap-4 text-white shrink-0 h-full border-r border-gray-800">
            {/* ロゴ */}
            <div className="mb-2 font-black text-xl tracking-tighter bg-gradient-to-br from-purple-400 to-blue-400 bg-clip-text text-transparent cursor-default">
                GH
            </div>

            {/* ワークスペース一覧 */}
            <div className="flex flex-col gap-3 w-full items-center overflow-y-auto px-2 no-scrollbar">
                {workspaces.map((ws) => {
                    const isActive = currentOrgId === ws.id;
                    const initial = ws.name.charAt(0).toUpperCase();
                    const isPersonal = ws.type === 'personal';

                    return (
                        <div key={ws.id} className="relative group w-full flex justify-center">
                            {isActive && (
                                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-white rounded-r-full" />
                            )}
                            
                            <button
                                onClick={() => onSwitch(ws)}
                                className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-lg font-bold transition-all duration-200 overflow-hidden shadow-sm
                                    ${isActive 
                                        ? 'bg-purple-600 text-white shadow-purple-900/50 ring-2 ring-purple-400 ring-offset-2 ring-offset-gray-900' 
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white hover:rounded-lg'
                                    }`}
                            >
                                {isPersonal ? <User size={20} /> : initial}
                            </button>
                            
                            {/* ツールチップ */}
                            <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity shadow-xl border border-gray-700 font-medium">
                                {ws.name}
                                <div className="text-[10px] text-gray-400 font-normal">{isPersonal ? 'Personal' : 'Team'}</div>
                            </div>
                        </div>
                    );
                })}

                <div className="w-8 h-[1px] bg-gray-800 my-1"></div>

                {/* 新規作成ボタン (モーダルを開く) */}
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-dashed border-gray-600 text-gray-500 hover:text-white hover:border-white hover:bg-gray-800 flex items-center justify-center transition group relative"
                >
                    <Plus size={20} />
                </button>
            </div>
        </div>

        {/* ========================================== */}
        {/* 新規作成モーダル */}
        {/* ========================================== */}
        {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl scale-100 animate-in zoom-in-95 relative mx-4">
                    <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>

                    <h2 className="text-xl font-bold text-gray-900 mb-1">ワークスペースを作成</h2>
                    <p className="text-sm text-gray-500 mb-6">利用目的に合わせてタイプを選択してください</p>

                    <form onSubmit={handleCreate}>
                        {/* タイプ選択 */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <label className={`
                                cursor-pointer border rounded-xl p-3 flex flex-col items-center gap-2 transition-all
                                ${newWsType === 'personal' ? 'border-purple-600 bg-purple-50 text-purple-700 ring-1 ring-purple-600' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                            `}>
                                <input type="radio" name="type" className="hidden" 
                                    checked={newWsType === 'personal'} onChange={() => setNewWsType('personal')} />
                                <User size={24} />
                                <span className="text-sm font-bold">個人用</span>
                                <span className="text-[10px] text-gray-400">自分だけの作業場</span>
                            </label>

                            <label className={`
                                cursor-pointer border rounded-xl p-3 flex flex-col items-center gap-2 transition-all
                                ${newWsType === 'team' ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                            `}>
                                <input type="radio" name="type" className="hidden" 
                                    checked={newWsType === 'team'} onChange={() => setNewWsType('team')} />
                                <Building2 size={24} />
                                <span className="text-sm font-bold">チーム用</span>
                                <span className="text-[10px] text-gray-400">メンバーを招待可能</span>
                            </label>
                        </div>

                        {/* 名前入力 */}
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                ワークスペース名
                            </label>
                            <input 
                                type="text" 
                                value={newWsName}
                                onChange={(e) => setNewWsName(e.target.value)}
                                placeholder={newWsType === 'personal' ? "例: 趣味のプロジェクト" : "例: 株式会社GAKU-HUB"}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3">
                            <button type="button" onClick={closeModal} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">
                                キャンセル
                            </button>
                            <button 
                                type="submit" 
                                disabled={isCreating || !newWsName.trim()}
                                className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isCreating ? '作成中...' : '作成する'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </>
  );
}