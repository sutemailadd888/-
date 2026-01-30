'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalIcon } from 'lucide-react';

interface Props {
  session: any;
}

// イベントの型定義をAPIに合わせる
interface CalendarEvent {
  id: string;
  title: string;
  start: string; // "2026-01-31T10:00:00"
  end: string;
  allDay: boolean;
  backgroundColor?: string;
  borderColor?: string;
}

export default function CalendarView({ session }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // カレンダーの日付計算
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11
  
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(new Date(year, month, i));
  }

  useEffect(() => {
    fetchEvents();
  }, [currentDate, session]);

  const fetchEvents = async () => {
    // セッションのトークン取得ロジック（環境に合わせて調整）
    // sessionオブジェクトの構造によっては session.access_token の場合もあります
    const token = session?.provider_token || session?.access_token;
    
    // トークンがない場合のエラー回避
    if (!token && !session?.user) return; 

    setLoading(true);
    
    // タイムゾーンを考慮して月初の00:00〜月末の23:59を取得
    // ※簡易的にISO文字列で送ります
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

    try {
      // API呼び出し
      const res = await fetch(
        `/api/calendar/list?timeMin=${startOfMonth.toISOString()}&timeMax=${endOfMonth.toISOString()}`,
        { 
            headers: token ? { Authorization: `Bearer ${token}` } : {} 
        }
      );
      const data = await res.json();
      if (data.events) setEvents(data.events);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (diff: number) => {
    setCurrentDate(new Date(year, month + diff, 1));
  };

  // ★修正: 新しいデータ形式に合わせて日付フィルタリング
  const getEventsForDay = (date: Date) => {
    // dateオブジェクトから "YYYY-MM-DD" を作る
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    return events.filter(e => {
        if (!e.start) return false;
        // APIが返してくる e.start は "2026-01-31T..." のような文字列
        return e.start.startsWith(dateStr);
    });
  };

  // ★追加: 時刻表示用のヘルパー関数
  const formatTime = (isoString: string) => {
    if (!isoString || !isoString.includes('T')) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
      {/* ヘッダー */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
            <CalIcon className="text-purple-600" size={20}/>
            {year}年 {month + 1}月
        </h3>
        <div className="flex gap-2">
            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-200 rounded transition"><ChevronLeft/></button>
            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-200 rounded transition"><ChevronRight/></button>
        </div>
      </div>

      {/* グリッド */}
      <div className="p-4">
        <div className="grid grid-cols-7 mb-2 text-center">
            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                <div key={i} className={`text-xs font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>
                    {d}
                </div>
            ))}
        </div>

        {loading && events.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 gap-2"><Loader2 className="animate-spin"/> 読み込み中...</div>
        ) : (
            <div className="grid grid-cols-7 gap-1 md:gap-2">
                {calendarDays.map((date, i) => {
                    if (!date) return <div key={i} className="h-24 md:h-32 bg-gray-50/50 rounded-lg"></div>; 
                    
                    const dayEvents = getEventsForDay(date);
                    const isToday = new Date().toDateString() === date.toDateString();

                    return (
                        <div key={i} className={`h-24 md:h-32 border rounded-lg p-1 md:p-2 overflow-hidden flex flex-col relative ${isToday ? 'bg-purple-50 border-purple-200' : 'border-gray-100 bg-white'}`}>
                            <div className={`text-xs font-bold mb-1 ${isToday ? 'text-purple-700' : 'text-gray-700'}`}>
                                {date.getDate()}
                            </div>
                            
                            <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
                                {dayEvents.map((ev) => (
                                    <div 
                                      key={ev.id} 
                                      className="text-[10px] px-1 py-0.5 rounded truncate border-l-2 cursor-pointer hover:opacity-80 transition"
                                      // 色情報の適用 (APIから受け取った色、またはデフォルト)
                                      style={{
                                        backgroundColor: ev.backgroundColor || '#EFF6FF',
                                        borderColor: ev.borderColor || '#3B82F6',
                                        color: ev.allDay ? '#fff' : '#1E40AF'
                                      }}
                                      title={ev.title}
                                    >
                                        {/* ★修正: データの読み方を変更 */}
                                        {ev.allDay ? '終日' : formatTime(ev.start)} {ev.title}
                                    </div>
                                ))}
                                {dayEvents.length === 0 && (
                                    <div className="h-full flex items-center justify-center">
                                        <div className="w-1 h-1 rounded-full bg-gray-200"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>
    </div>
  );
}