// app/components/MeetingCard.tsx
'use client';

import React, { useState } from 'react';
import { RefreshCw, Sparkles, Loader2, ArrowRight, Bot, Check, CalendarCheck } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

interface Props {
  session: any;
  orgId?: string;
}

export default function MeetingCard({ session, orgId }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [message, setMessage] = useState('');
  const [creatingEventId, setCreatingEventId] = useState<number | null>(null);
  const [successLink, setSuccessLink] = useState<string | null>(null);

  // カレンダー取得 (トークン切れ対策強化版)
  const fetchCalendar = async () => {
    setLoadingCalendar(true);
    setMessage('');

    try {
      // 1. まずセッションのトークンを試す
      let token = session?.provider_token;

      // 2. なければDB (user_tokens) からの取得を試みる
      if (!token) {
        console.log("Session token missing. Fetching from DB...");
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data } = await supabase
            .from('user_tokens')
            .select('access_token')
            .eq('user_id', session?.user?.id)
            .single();
        
        if (data?.access_token) {
            token = data.access_token;
        }
      }

      // 3. それでもなければエラー
      if (!token) {
        alert("Googleカレンダーの連携トークンが見つかりません。\n一度ログアウトし、再度Googleでログインしてください。");
        setLoadingCalendar(false);
        return;
      }

      const now = new Date().toISOString();
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&maxResults=10&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        throw new Error("Google API Error: " + response.status);
      }

      const data = await response.json();
      if (data.items) {
        setEvents(data.items);
        setMessage('✅ カレンダーを取得しました。AIに入力してください。');
      } else {
        setMessage('予定が見つかりませんでした。');
      }

    } catch (error: any) {
      console.error(error);
      alert(`カレンダー取得エラー: ${error.message}\n(再ログインを試してください)`);
    } finally {
      setLoadingCalendar(false);
    }
  };

  const askGemini = async () => {
    if (!prompt) return;
    if (events.length === 0) {
      alert('先に「カレンダー同期」ボタンを押してください！');
      return;
    }
    setLoadingAI(true);
    setAiSuggestions([]);
    setSuccessLink(null);

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events, userPrompt: prompt }),
      });
      const data = await res.json();
      if (data.suggestions) setAiSuggestions(data.suggestions);
    } catch (error) {
      console.error(error);
      alert('AI呼び出しエラー');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleCreateEvent = async (suggestion: any, index: number) => {
    if(!confirm(`${suggestion.date} ${suggestion.time} で予定を作成しますか？`)) return;

    setCreatingEventId(index);

    try {
      const res = await fetch('/api/calendar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: session,
          eventDetails: suggestion,
          workspace_id: orgId // 将来のために送信
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessLink(data.link);
        alert('🎉 予定を作成しました！');
        setAiSuggestions([]);
        setPrompt('');
        fetchCalendar();
      } else {
        alert('作成失敗: ' + data.error);
      }
    } catch (error) {
      console.error(error);
      alert('通信エラーが発生しました');
    } finally {
      setCreatingEventId(null);
    }
  };

  return (
    <div className="border rounded-lg shadow-sm bg-white overflow-hidden my-6 max-w-2xl border-gray-200 hover:border-purple-300 transition-colors">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="text-purple-600" size={18} />
          <span className="font-semibold text-gray-700 text-sm">Active Scheduler</span>
        </div>
        <button 
          onClick={fetchCalendar}
          disabled={loadingCalendar}
          className="text-xs bg-white border border-gray-300 hover:bg-gray-100 px-3 py-1 rounded-full font-medium flex items-center space-x-1 transition"
        >
          {loadingCalendar ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12} />}
          <span>カレンダー同期</span>
        </button>
      </div>

      <div className="p-5">
        {successLink && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center justify-between text-green-800 text-sm">
                <div className="flex items-center gap-2">
                    <CalendarCheck size={18}/>
                    <span>予定をカレンダーに追加しました！</span>
                </div>
                <a href={successLink} target="_blank" rel="noreferrer" className="underline font-bold hover:text-green-600">
                    Googleカレンダーで見る &rarr;
                </a>
            </div>
        )}

        <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">{message || 'まずはカレンダー同期を押してください'}</p>
            <div className="flex flex-wrap gap-2">
                {events.length > 0 && events.slice(0, 3).map((e: any, i) => (
                    <span key={i} className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500 truncate max-w-[150px]">
                        📅 {e.summary}
                    </span>
                ))}
            </div>
        </div>

        {aiSuggestions.length > 0 && (
            <div className="mb-6 space-y-3 animation-fade-in">
                <div className="text-sm font-bold text-purple-700 flex items-center gap-2">
                    <Bot size={16}/> Geminiの提案:
                </div>
                {aiSuggestions.map((suggestion: any, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-md border border-purple-100 bg-purple-50 group hover:bg-purple-100 transition">
                        <div>
                            <div className="text-purple-900 font-bold">{suggestion.date}</div>
                            <div className="text-purple-700 text-sm">{suggestion.time}</div>
                            <div className="text-xs text-purple-500 mt-1">{suggestion.reason}</div>
                        </div>
                        <button 
                            onClick={() => handleCreateEvent(suggestion, index)}
                            disabled={creatingEventId !== null}
                            className="bg-white border border-purple-200 text-purple-600 hover:bg-purple-600 hover:text-white p-2 rounded-full transition shadow-sm"
                        >
                            {creatingEventId === index ? <Loader2 size={18} className="animate-spin text-purple-600"/> : <Check size={18} />}
                        </button>
                    </div>
                ))}
            </div>
        )}

        <div className="mt-2 pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded-md border focus-within:border-purple-400 transition">
                <input 
                    type="text" 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="例: 明日の午後で60分のMTGを入れたい..." 
                    className="bg-transparent text-sm w-full outline-none text-gray-700 placeholder-gray-400"
                />
                <button 
                    onClick={askGemini}
                    disabled={loadingAI || !prompt}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs px-4 py-2 rounded-md transition disabled:opacity-50 flex items-center gap-2"
                >
                    {loadingAI && <Loader2 size={12} className="animate-spin"/>}
                    AIに依頼
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}