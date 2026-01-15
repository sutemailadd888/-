// app/components/MeetingCard.tsx
'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Bot, Calendar, Loader2, ArrowRight } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ★変更: orgId を受け取る
interface Props {
  session: any;
  orgId: string;
}

export default function MeetingCard({ session, orgId }: Props) {
  const [loading, setLoading] = useState(false);
  const [dayType, setDayType] = useState('weekday'); // weekday or specific
  const [weekNum, setWeekNum] = useState('1'); // 第1
  const [weekday, setWeekday] = useState('monday'); // 月曜日
  const [startTime, setStartTime] = useState('10:00');
  const [duration, setDuration] = useState('60');

  const handleCreateRule = async () => {
    if (!orgId) return alert("ワークスペースが読み込まれていません");
    setLoading(true);

    try {
      // 1. ルールを保存 (★organization_id を追加！)
      const { error } = await supabase
        .from('meeting_rules')
        .insert([
          {
            user_id: session.user.id,
            organization_id: orgId, // ここが必須！
            rule_name: `毎月 第${weekNum} ${weekday}の定期調整`,
            rule_type: 'monthly_weekday',
            config: {
                week_number: parseInt(weekNum),
                weekday: weekday,
                start_time: startTime,
                duration_minutes: parseInt(duration)
            },
            is_active: true
          }
        ]);

      if (error) throw error;

      alert('✅ 自動調整ルールを作成しました！\n(次のバッチ処理でスケジュールが仮押さえされます)');

    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
          <Bot size={24} />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">AI 定期調整エージェント</h3>
          <p className="text-xs text-gray-500">毎月の定例予定を自動で確保します</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-3 border border-gray-100">
            <div className="flex items-center gap-2">
                <span className="text-gray-500 font-bold shrink-0">頻度:</span>
                <select className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-700 w-full">
                    <option>毎月</option>
                </select>
            </div>
            
            <div className="flex items-center gap-2">
                <span className="text-gray-500 font-bold shrink-0">日時:</span>
                <div className="flex gap-1 w-full">
                    <select value={weekNum} onChange={(e)=>setWeekNum(e.target.value)} className="bg-white border border-gray-300 rounded px-1 py-1 text-gray-700">
                        <option value="1">第1</option>
                        <option value="2">第2</option>
                        <option value="3">第3</option>
                        <option value="4">第4</option>
                    </select>
                    <select value={weekday} onChange={(e)=>setWeekday(e.target.value)} className="bg-white border border-gray-300 rounded px-1 py-1 text-gray-700 flex-1">
                        <option value="monday">月曜日</option>
                        <option value="tuesday">火曜日</option>
                        <option value="wednesday">水曜日</option>
                        <option value="thursday">木曜日</option>
                        <option value="friday">金曜日</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-2">
                 <span className="text-gray-500 font-bold shrink-0">開始:</span>
                 <input type="time" value={startTime} onChange={(e)=>setStartTime(e.target.value)} className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-700 w-full"/>
            </div>
        </div>

        <button 
            onClick={handleCreateRule} 
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
        >
            {loading ? <Loader2 className="animate-spin" size={16}/> : <ArrowRight size={16}/>}
            エージェントを起動
        </button>
      </div>
    </div>
  );
}