// app/components/RuleList.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { CalendarClock, Plus, Loader2, Play, Check, CalendarCheck } from 'lucide-react';

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
  const [newPrompt, setNewPrompt] = useState('午後で調整して');

  // ★追加: 実行結果を表示するための状態
  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any>({}); // ルールIDごとの提案結果
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchRules();
  }, [session]);

  const fetchRules = async () => {
    const token = session?.access_token || session?.provider_token; 
    if (!token) return;
    try {
      const res = await fetch('/api/rules', {
          headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.rules) setRules(data.rules);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddRule = async () => {
    const token = session?.access_token || session?.provider_token;
    if (!token) return;
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
          targetDay: parseInt(newDay),
          prompt: newPrompt
        }),
      });
      if (res.ok) {
        setIsAdding(false);
        setNewTitle('');
        fetchRules();
      }
    } catch (e) {
      console.error(e);
    } finally {
        setLoading(false);
    }
  };

  // ★追加: ルールを実行する魔法の関数
  const runRule = async (rule: any) => {
    const token = session?.provider_token;
    if (!token) {
        alert("カレンダー連携のトークンがありません。再ログインしてください。");
        return;
    }

    setRunningRuleId(rule.id);
    setSuggestions({ ...suggestions, [rule.id]: null }); // リセット
    
    try {
        // 1. カレンダー取得
        const now = new Date().toISOString();
        const calRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&maxResults=10&singleEvents=true&orderBy=startTime`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const calData = await calRes.json();
        
        // 2. AIにルールを渡して依頼
        // ルールの「日付(target_day)」を考慮したプロンプトを作る
        const today = new Date();
        const targetDate = new Date(today.getFullYear(), today.getMonth(), rule.target_day);
        // もし今日より過去なら来月にする
        if (targetDate < today) {
            targetDate.setMonth(targetDate.getMonth() + 1);
        }
        
        const dateString = targetDate.toLocaleDateString();
        const aiPrompt = `【自動実行モード】会議名: ${rule.title}。希望日: ${dateString}付近。条件: ${rule.prompt_custom}。`;

        const aiRes = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: calData.items, userPrompt: aiPrompt }),
        });
        const aiData = await aiRes.json();
        
        if (aiData.suggestions) {
            setSuggestions({ ...suggestions, [rule.id]: aiData.suggestions });
        }

    } catch (error) {
        console.error(error);
        alert("実行中にエラーが発生しました");
    } finally {
        setRunningRuleId(null);
    }
  };

  // ★追加: 提案された予定を確定する関数
  const confirmEvent = async (suggestion: any) => {
      if(!confirm(`${suggestion.date} ${suggestion.time} で確定しますか？`)) return;
      
      try {
        const res = await fetch('/api/calendar/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            session: session,
            eventDetails: suggestion
            }),
        });
        const data = await res.json();
        if (data.success) {
            alert("🎉 予定を作成しました！");
            setSuccessMsg(data.link);
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
        <button 
            onClick={() => setIsAdding(!isAdding)}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full flex items-center gap-1 transition"
        >
            <Plus size={14}/> 新規ルール
        </button>
      </div>

      {isAdding && (
          <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm mb-4">
              <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">会議名</label>
                      <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full text-sm border border-gray-300 rounded p-2"/>
                  </div>
                  <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">毎月の日付</label>
                      <input type="number" value={newDay} onChange={e => setNewDay(e.target.value)} className="w-full text-sm border border-gray-300 rounded p-2"/>
                  </div>
              </div>
              <div className="mb-3">
                  <label className="text-xs font-bold text-gray-500 block mb-1">AIへの指示</label>
                  <input type="text" value={newPrompt} onChange={e => setNewPrompt(e.target.value)} className="w-full text-sm border border-gray-300 rounded p-2"/>
              </div>
              <div className="flex justify-end gap-2">
                  <button onClick={handleAddRule} disabled={loading} className="text-xs bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">保存</button>
              </div>
          </div>
      )}

      <div className="space-y-4">
          {rules.length === 0 && !isAdding && (
              <p className="text-sm text-gray-400 text-center py-4 border border-dashed rounded-lg">ルールがありません</p>
          )}

          {rules.map((rule) => (
              <div key={rule.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                  <div className="p-4 flex items-center justify-between bg-gray-50">
                      <div>
                          <div className="font-bold text-gray-800 flex items-center gap-2">
                              {rule.title}
                              <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">毎月{rule.target_day}日</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{rule.prompt_custom}</div>
                      </div>
                      
                      {/* 実行ボタン */}
                      <button 
                        onClick={() => runRule(rule)}
                        disabled={runningRuleId === rule.id}
                        className="flex items-center gap-1 bg-white border border-purple-200 text-purple-600 hover:bg-purple-600 hover:text-white px-3 py-1.5 rounded-full text-xs font-bold transition shadow-sm"
                      >
                          {runningRuleId === rule.id ? <Loader2 size={14} className="animate-spin"/> : <Play size={14} fill="currentColor" />}
                          <span>実行</span>
                      </button>
                  </div>

                  {/* 実行結果の表示エリア */}
                  {suggestions[rule.id] && (
                      <div className="p-4 bg-purple-50 border-t border-purple-100 animation-fade-in">
                          <div className="text-xs font-bold text-purple-800 mb-2">⚡️ AIが見つけた候補:</div>
                          <div className="space-y-2">
                            {suggestions[rule.id].map((s: any, i: number) => (
                                <div key={i} className="flex items-center justify-between bg-white p-2 rounded border border-purple-100">
                                    <div className="text-xs">
                                        <span className="font-bold text-gray-700">{s.date} {s.time}</span>
                                        <span className="text-gray-400 ml-2">({s.reason})</span>
                                    </div>
                                    <button onClick={() => confirmEvent(s)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                                        <Check size={16}/>
                                    </button>
                                </div>
                            ))}
                          </div>
                      </div>
                  )}
              </div>
          ))}
      </div>
    </div>
  );
}