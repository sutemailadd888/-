// app/components/RuleList.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { CalendarClock, Plus, Loader2, Play, Check, Users, BellRing, Trash2, Pencil, Save, X } from 'lucide-react';

interface Props {
  session: any;
}

export default function RuleList({ session }: Props) {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 新規作成用
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDay, setNewDay] = useState('25'); 
  const [newPrompt, setNewPrompt] = useState('翌月の1日〜10日の平日で。前後の予定と30分あけて。');
  const [newAttendees, setNewAttendees] = useState('');

  // 編集モード用
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDay, setEditDay] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [editAttendees, setEditAttendees] = useState('');

  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any>({});

  const todayDate = new Date().getDate();

  useEffect(() => {
    fetchRules();
  }, [session]);

  // ★修正: トークン取得を確実にする
  const getToken = () => {
    // 優先順位: Supabaseのアクセストークン > Googleのプロバイダートークン
    return session?.access_token || session?.provider_token;
  };

  const fetchRules = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/rules', {
          headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.rules) setRules(data.rules);
    } catch (e) { console.error(e); }
  };

  const handleAddRule = async () => {
    const token = getToken();
    if (!token) {
        alert("認証トークンが見つかりません。一度ログアウトして再ログインしてください。");
        return;
    }
    
    // ★追加: 入力チェック
    if (!newDay) {
        alert("「リマインド日」を入力してください");
        return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTitle,
          targetDay: parseInt(newDay), // 数値に変換
          prompt: newPrompt,
          attendees: newAttendees
        }),
      });

      // ★追加: エラーハンドリング
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "保存に失敗しました");
      }
      
      // 成功時
      setIsAdding(false);
      setNewTitle('');
      setNewAttendees('');
      fetchRules();

    } catch (e: any) {
      console.error(e);
      alert(`エラーが発生しました: ${e.message}`);
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このルールを削除してもよろしいですか？')) return;
    const token = getToken();
    await fetch(`/api/rules?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    });
    fetchRules();
  };

  const startEdit = (rule: any) => {
      setEditingId(rule.id);
      setEditTitle(rule.title);
      setEditDay(rule.target_day.toString());
      setEditPrompt(rule.prompt_custom);
      setEditAttendees(rule.attendees || '');
  };

  const handleUpdate = async () => {
    const token = getToken();
    try {
        const res = await fetch('/api/rules', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                id: editingId,
                title: editTitle,
                targetDay: parseInt(editDay),
                prompt: editPrompt,
                attendees: editAttendees
            }),
        });

        if (!res.ok) throw new Error("更新に失敗しました");

        setEditingId(null);
        fetchRules();
    } catch(e: any) {
        alert(e.message);
    }
  };

  const runRule = async (rule: any) => {
    const token = session?.provider_token;
    if (!token) {
        alert("カレンダー連携のトークンがありません。再ログインしてください。");
        return;
    }

    setRunningRuleId(rule.id);
    setSuggestions({ ...suggestions, [rule.id]: null });
    
    try {
        const now = new Date().toISOString();
        const calRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&maxResults=20&singleEvents=true&orderBy=startTime`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const calData = await calRes.json();
        
        const today = new Date();
        let targetMonth = today.getMonth();
        if (today.getDate() >= 20) {
            targetMonth = targetMonth + 1;
        }

        const targetDate = new Date(today.getFullYear(), targetMonth, 1);
        const dateString = `${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月`;
        const aiPrompt = `【自動実行モード】会議名: ${rule.title}。ターゲット時期: ${dateString}。詳細条件: ${rule.prompt_custom}。`;

        const aiRes = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: calData.items, userPrompt: aiPrompt }),
        });
        const aiData = await aiRes.json();
        
        if (aiData.suggestions) {
            setSuggestions({ ...suggestions, [rule.id]: aiData.suggestions });
        } else {
            alert("AIからの応答がありませんでした。");
        }

    } catch (error) {
        console.error(error);
        alert("実行中にエラーが発生しました");
    } finally {
        setRunningRuleId(null);
    }
  };

  const confirmEvent = async (suggestion: any, attendees: string) => {
      if(!confirm(`${suggestion.date} ${suggestion.time} で確定し、招待を送りますか？`)) return;
      
      try {
        const res = await fetch('/api/calendar/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session: session,
                eventDetails: suggestion,
                attendees: attendees
            }),
        });
        const data = await res.json();
        if (data.success) {
            alert("🎉 予定を作成し、招待状を送りました！");
            setSuggestions({});
        } else {
            alert("作成に失敗しました: " + data.error);
        }
      } catch (e) {
          alert("作成失敗");
      }
  };

  return (
    <div className="max-w-2xl mt-8 mb-20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <CalendarClock className="text-purple-600"/>
            自動調整ルール
        </h3>
        {!isAdding && !editingId && (
            <button 
                onClick={() => setIsAdding(true)}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full flex items-center gap-1 transition"
            >
                <Plus size={14}/> 新規ルール
            </button>
        )}
      </div>

      {isAdding && (
          <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm mb-4 animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">会議名</label>
                      <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full text-sm border border-gray-300 rounded p-2"/>
                  </div>
                  <div>
                      <label className="text-xs font-bold text-purple-600 block mb-1">毎月の実行リマインド日</label>
                      <input type="number" value={newDay} onChange={e => setNewDay(e.target.value)} className="w-full text-sm border border-purple-300 bg-purple-50 rounded p-2 font-bold"/>
                  </div>
              </div>
              <div className="mb-3">
                  <label className="text-xs font-bold text-gray-500 block mb-1">参加者 (カンマ区切り)</label>
                  <input type="text" value={newAttendees} onChange={e => setNewAttendees(e.target.value)} placeholder="a@test.com, b@test.com" className="w-full text-sm border border-gray-300 rounded p-2"/>
              </div>
              <div className="mb-3">
                  <label className="text-xs font-bold text-gray-500 block mb-1">AIへの指示</label>
                  <input type="text" value={newPrompt} onChange={e => setNewPrompt(e.target.value)} className="w-full text-sm border border-gray-300 rounded p-2"/>
              </div>
              <div className="flex justify-end gap-2">
                  <button onClick={() => setIsAdding(false)} className="text-xs text-gray-500 px-3 py-2">キャンセル</button>
                  <button onClick={handleAddRule} disabled={loading} className="text-xs bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">保存</button>
              </div>
          </div>
      )}

      <div className="space-y-4">
          {rules.length === 0 && !isAdding && (
              <p className="text-sm text-gray-400 text-center py-4 border border-dashed rounded-lg">ルールがありません</p>
          )}

          {rules.map((rule) => {
              const isDueToday = todayDate === rule.target_day;
              
              if (editingId === rule.id) {
                  return (
                    <div key={rule.id} className="bg-white p-4 rounded-lg border-2 border-purple-400 shadow-md">
                        <div className="text-xs font-bold text-purple-600 mb-2 flex items-center gap-1"><Pencil size={12}/> ルールを編集中</div>
                        <div className="grid grid-cols-2 gap-4 mb-3">
                            <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="text-sm border rounded p-2" placeholder="会議名"/>
                            <input type="number" value={editDay} onChange={e => setEditDay(e.target.value)} className="text-sm border rounded p-2" placeholder="リマインド日"/>
                        </div>
                        <input type="text" value={editAttendees} onChange={e => setEditAttendees(e.target.value)} className="w-full text-sm border rounded p-2 mb-3" placeholder="参加者"/>
                        <textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} className="w-full text-sm border rounded p-2 mb-3" rows={2} placeholder="AIへの指示"/>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 px-3 py-2">キャンセル</button>
                            <button onClick={handleUpdate} className="text-xs bg-purple-600 text-white px-4 py-2 rounded flex items-center gap-1"><Save size={14}/> 更新</button>
                        </div>
                    </div>
                  );
              }

              return (
                <div key={rule.id} className={`rounded-lg border overflow-hidden shadow-sm transition ${isDueToday ? 'border-yellow-400 bg-yellow-50 ring-2 ring-yellow-200' : 'border-gray-200 bg-white'}`}>
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex-1">
                            <div className="font-bold text-gray-800 flex items-center gap-2">
                                {rule.title}
                                {isDueToday ? (
                                    <span className="text-[10px] bg-yellow-400 text-white px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"><BellRing size={10}/> 今日が実行日</span>
                                ) : (
                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">毎月{rule.target_day}日リマインド</span>
                                )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2 items-center">
                                <span className="truncate max-w-[200px]">{rule.prompt_custom}</span>
                                {rule.attendees && (
                                    <span className="flex items-center gap-1 bg-white border border-gray-200 px-1.5 rounded text-gray-600">
                                        <Users size={10}/> {rule.attendees.split(',').length}名
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button onClick={() => startEdit(rule)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-gray-100 rounded transition"><Pencil size={16}/></button>
                            <button onClick={() => handleDelete(rule.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 size={16}/></button>
                            
                            <button 
                                onClick={() => runRule(rule)}
                                disabled={runningRuleId === rule.id}
                                className={`ml-2 flex items-center gap-1 border px-3 py-1.5 rounded-full text-xs font-bold transition shadow-sm ${isDueToday ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700' : 'bg-white text-purple-600 border-purple-200 hover:bg-purple-50'}`}
                            >
                                {runningRuleId === rule.id ? <Loader2 size={14} className="animate-spin"/> : <Play size={14} fill="currentColor" />}
                                <span className="hidden sm:inline">実行</span>
                            </button>
                        </div>
                    </div>
                    
                    {suggestions[rule.id] && (
                        <div className="p-4 bg-white border-t border-purple-100 animation-fade-in">
                            <div className="text-xs font-bold text-purple-800 mb-2">⚡️ AIが見つけた候補:</div>
                            <div className="space-y-2">
                                {suggestions[rule.id].map((s: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between bg-purple-50 p-2 rounded border border-purple-100">
                                        <div className="text-xs">
                                            <span className="font-bold text-gray-700">{s.date} {s.time}</span>
                                            <span className="text-gray-400 ml-2">({s.reason})</span>
                                        </div>
                                        <button onClick={() => confirmEvent(s, rule.attendees)} className="text-green-600 hover:bg-green-100 p-1.5 rounded-full bg-white border border-green-200"><Check size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
              );
          })}
      </div>
    </div>
  );
}