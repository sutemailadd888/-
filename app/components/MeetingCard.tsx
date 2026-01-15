// app/components/MeetingCard.tsx
import React, { useState } from 'react';
import { RefreshCw, Sparkles, Loader2, ArrowRight, Bot, Check, CalendarCheck } from 'lucide-react';

interface Props {
  session: any;
}

export default function MeetingCard({ session }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [message, setMessage] = useState('');
  
  // ★追加: 予定作成の状態管理
  const [creatingEventId, setCreatingEventId] = useState<number | null>(null);
  const [successLink, setSuccessLink] = useState<string | null>(null);

  // 1. カレンダー取得
  const fetchCalendar = async () => {
    if (!session?.provider_token) return;
    setLoadingCalendar(true);
    try {
      const now = new Date().toISOString();
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&maxResults=10&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${session.provider_token}` } }
      );
      const data = await response.json();
      if (data.items) {
        setEvents(data.items);
        setMessage('✅ カレンダーを取得しました。AIに入力してください。');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingCalendar(false);
    }
  };

  // 2. AI提案
  const askGemini = async () => {
    if (!prompt) return;
    if (events.length === 0) {
      alert('先に「カレンダー同期」ボタンを押してください！');
      return;
    }
    setLoadingAI(true);
    setAiSuggestions([]);
    setSuccessLink(null); // リセット

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

  // 3. ★追加: 予定を確定する関数
  const handleCreateEvent = async (suggestion: any, index: number) => {
    if(!confirm(`${suggestion.date} ${suggestion.time} で予定を作成しますか？`)) return;

    setCreatingEventId(index); // ローディング開始

    try {
      const res = await fetch('/api/calendar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: session, // 鍵を渡す
          eventDetails: suggestion
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessLink(data.link);
        alert('🎉 予定を作成しました！');
        setAiSuggestions([]); // 提案リストをクリア
        setPrompt(''); // 入力欄をクリア
        fetchCalendar(); // 最新のカレンダーを再取得
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
        {/* 成功時のメッセージ */}
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
                {events.slice(0, 3).map((e: any, i) => (
                    <span key={i} className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500 truncate max-w-[150px]">
                        📅 {e.summary}
                    </span>
                ))}
            </div>
        </div>

        {/* AI提案エリア */}
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
                        
                        {/* 決定ボタン */}
                        <button 
                            onClick={() => handleCreateEvent(suggestion, index)}
                            disabled={creatingEventId !== null}
                            className="bg-white border border-purple-200 text-purple-600 hover:bg-purple-600 hover:text-white p-2 rounded-full transition shadow-sm"
                            title="この日時で確定する"
                        >
                            {creatingEventId === index ? (
                                <Loader2 size={18} className="animate-spin text-purple-600"/>
                            ) : (
                                <Check size={18} />
                            )}
                        </button>
                    </div>
                ))}
            </div>
        )}

        {/* 入力エリア */}
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