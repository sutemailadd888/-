'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Calendar, Clock, CheckCircle, ChevronLeft, Loader2, User, Mail, MessageSquare } from 'lucide-react';
import { useSearchParams } from 'next/navigation'; // ★追加

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function BookingPage({ params }: { params: { userId: string } }) {
  const hostUserId = params.userId;
  const searchParams = useSearchParams(); // ★追加
  const orgId = searchParams.get('orgId'); // ★URLから組織IDを取得

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [step, setStep] = useState<'date' | 'form' | 'done'>('date');
  
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [note, setNote] = useState('');

  // 日付が選ばれたら、その日と組織IDを使って空き枠を取ってくる
  useEffect(() => {
    if (selectedDate && orgId) {
      fetchSlots(selectedDate);
    }
  }, [selectedDate, orgId]);

  const fetchSlots = async (date: string) => {
    setLoadingSlots(true);
    setSlots([]);
    try {
      // ★API呼び出しに orgId を追加
      const res = await fetch(`/api/book/slots?hostId=${hostUserId}&date=${date}&orgId=${orgId}`);
      const data = await res.json();
      if (data.slots) {
        setSlots(data.slots);
      }
    } catch (e) {
      console.error(e);
      alert('空き状況の取得に失敗しました');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return alert("組織IDが見つかりません。URLを確認してください。");
    
    setLoadingSubmit(true);

    try {
      // 日本時間 (+09:00) を明示的に付けて保存する
      const startHour = parseInt(selectedTime.split(':')[0]);
      const endHour = startHour + 1;

      const startTimeStr = selectedTime.padStart(5, '0');
      const endTimeStr = endHour.toString().padStart(2, '0') + ':00';

      const startDateTime = `${selectedDate}T${startTimeStr}:00+09:00`;
      const endDateTime = `${selectedDate}T${endTimeStr}:00+09:00`;

      // ★保存時に organization_id を含める
      const { error } = await supabase
        .from('booking_requests')
        .insert([
          {
            host_user_id: hostUserId,
            organization_id: orgId, // ここ！
            guest_name: guestName,
            guest_email: guestEmail,
            start_time: startDateTime,
            end_time: endDateTime,
            note: note,
            status: 'pending'
          }
        ]);

      if (error) throw error;
      setStep('done');

    } catch (error) {
      console.error(error);
      alert('予約リクエストの送信に失敗しました。');
    } finally {
      setLoadingSubmit(false);
    }
  };

  // ---------------- UI ----------------

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center space-y-4 animate-in zoom-in-95">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">リクエスト送信完了</h2>
          <p className="text-gray-600">
            日程調整のリクエストを受け付けました。<br/>
            主催者からの確認をお待ちください。
          </p>
          <div className="bg-gray-50 p-4 rounded-lg text-sm text-left border border-gray-100 mt-6">
            <div className="flex justify-between mb-2">
              <span className="text-gray-500">日時</span>
              <span className="font-bold">{selectedDate} {selectedTime}〜</span>
            </div>
            <div className="flex justify-between">
               <span className="text-gray-500">メール</span>
               <span className="font-bold">{guestEmail}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white md:bg-gray-50 flex items-center justify-center p-0 md:p-4 font-sans">
      <div className="bg-white w-full max-w-4xl md:rounded-2xl md:shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        
        {/* 左側: プロフィールエリア */}
        <div className="w-full md:w-1/3 bg-gray-900 text-white p-8 flex flex-col justify-between relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-900 to-blue-900 opacity-50"></div>
           <div className="relative z-10">
              <div className="text-gray-400 text-sm font-bold tracking-widest mb-2">SCHEDULE</div>
              <h1 className="text-3xl font-bold mb-4 leading-tight">面談予約<br/>リクエスト</h1>
              <p className="text-gray-300 text-sm leading-relaxed">
                以下のカレンダーから、ご希望の日程を選択してください。<br/>
                自動で空き状況を確認しています。
              </p>
           </div>
           
           <div className="relative z-10 mt-8 pt-8 border-t border-gray-700">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center font-bold">Host</div>
                 <div>
                    <div className="text-sm font-bold">GAKU-HUB Member</div>
                    <div className="text-xs text-gray-400">60分 / Google Meet</div>
                 </div>
              </div>
           </div>
        </div>

        {/* 右側: 操作エリア */}
        <div className="w-full md:w-2/3 p-6 md:p-10 bg-white relative">
          
          {step === 'form' && (
            <button 
                onClick={() => setStep('date')}
                className="absolute top-6 left-6 flex items-center gap-1 text-sm text-gray-500 hover:text-black transition"
            >
                <ChevronLeft size={16}/> 日程選びに戻る
            </button>
          )}

          <div className="max-w-md mx-auto h-full flex flex-col justify-center">
            
            {step === 'date' && (
              <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                 <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Calendar className="text-purple-600"/> 日程を選択
                 </h2>
                 
                 <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Date</label>
                    <input 
                      type="date" 
                      onChange={(e) => setSelectedDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full p-3 border-2 border-gray-100 rounded-xl focus:border-purple-500 focus:outline-none transition font-bold text-gray-700"
                    />
                 </div>

                 {selectedDate && (
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Time</label>
                        {loadingSlots ? (
                            <div className="flex justify-center py-8 text-purple-600">
                                <Loader2 className="animate-spin" size={24}/>
                            </div>
                        ) : slots.length > 0 ? (
                            <div className="grid grid-cols-3 gap-3">
                                {slots.map(time => (
                                    <button
                                        key={time}
                                        onClick={() => { setSelectedTime(time); setStep('form'); }}
                                        className="py-3 px-2 rounded-lg border border-purple-100 bg-purple-50 text-purple-700 font-bold hover:bg-purple-600 hover:text-white hover:shadow-md transition text-sm"
                                    >
                                        {time}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-gray-50 rounded-xl text-gray-400 text-sm">
                                空き枠がありません
                            </div>
                        )}
                    </div>
                 )}
              </div>
            )}

            {step === 'form' && (
              <form onSubmit={handleSubmit} className="animate-in slide-in-from-right-4 fade-in duration-300 space-y-5">
                 <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <User className="text-purple-600"/> 情報を入力
                 </h2>
                 
                 <div className="bg-purple-50 p-3 rounded-lg flex items-center gap-3 text-purple-900 text-sm font-bold mb-6">
                    <Clock size={16}/>
                    {selectedDate} {selectedTime} 〜 {parseInt(selectedTime.split(':')[0]) + 1}:00
                 </div>

                 <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">お名前</label>
                        <div className="relative">
                            <User className="absolute top-3.5 left-3 text-gray-400" size={18}/>
                            <input 
                                required
                                type="text" 
                                value={guestName}
                                onChange={e => setGuestName(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                placeholder="山田 太郎"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">メールアドレス</label>
                        <div className="relative">
                            <Mail className="absolute top-3.5 left-3 text-gray-400" size={18}/>
                            <input 
                                required
                                type="email" 
                                value={guestEmail}
                                onChange={e => setGuestEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                placeholder="taro@example.com"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">メモ (任意)</label>
                        <div className="relative">
                            <MessageSquare className="absolute top-3.5 left-3 text-gray-400" size={18}/>
                            <textarea 
                                rows={3}
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                placeholder="当日の相談内容など"
                            />
                        </div>
                    </div>
                 </div>

                 <button 
                    type="submit" 
                    disabled={loadingSubmit}
                    className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black transition shadow-lg mt-4 flex items-center justify-center gap-2"
                 >
                    {loadingSubmit ? <Loader2 className="animate-spin"/> : '予約を確定する'}
                 </button>
              </form>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}