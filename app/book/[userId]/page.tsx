'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Mail, MessageSquare, CheckCircle, Loader2, ChevronLeft } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useParams, useSearchParams } from 'next/navigation';

// 匿名ユーザーとして書き込むためのクライアント
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function BookingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hostUserId = params.userId as string;
  const orgId = searchParams.get('orgId');

  // 画面遷移の状態管理
  const [step, setStep] = useState<'date' | 'form' | 'done'>('date');

  // 入力データ
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [note, setNote] = useState('');

  // ローディング状態
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  // 日付が選ばれたら、空き時間をAPIから取得する
  useEffect(() => {
    if (selectedDate && step === 'date') {
        fetchSlots();
    }
  }, [selectedDate]);

  const fetchSlots = async () => {
    setLoadingSlots(true);
    setAvailableSlots([]);
    setSelectedTime('');

    try {
        const res = await fetch(`/api/book/slots?hostId=${hostUserId}&date=${selectedDate}&orgId=${orgId}`);
        const data = await res.json();
        
        if (data.slots) {
            setAvailableSlots(data.slots);
        } else {
            console.error("No slots data", data);
        }
    } catch (e) {
        console.error("Fetch slots error:", e);
        alert("空き状況の取得に失敗しました。");
    } finally {
        setLoadingSlots(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) {
        alert("予約エラー: ワークスペース情報が見つかりません。URLを確認してください。");
        return;
    }
    
    setLoadingSubmit(true);

    try {
      const startHour = parseInt(selectedTime.split(':')[0]);
      const endHour = startHour + 1;

      const startTimeStr = selectedTime.padStart(5, '0');
      const endTimeStr = endHour.toString().padStart(2, '0') + ':00';

      const startDateTime = `${selectedDate}T${startTimeStr}:00+09:00`;
      const endDateTime = `${selectedDate}T${endTimeStr}:00+09:00`;

      // 1. データベースに保存
      const { error } = await supabase
        .from('booking_requests')
        .insert([
          {
            host_user_id: hostUserId,
            organization_id: orgId,
            guest_name: guestName,
            guest_email: guestEmail,
            start_time: startDateTime,
            end_time: endDateTime,
            note: note,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      // ★追加: 2. メール通知を送信 (Resend API)
      // ★修正: 送信元(from) をあなたのドメインに変更
      await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            // 送信元: onboarding@resend.dev ではなく、あなたのドメインにする
            // (例: noreply@gaku-hub.com, system@gaku-hub.com など、@の前は自由です)
            from: 'GAKU-HUB OS <noreply@gaku-hub.com>', 
            to: 'your-email@example.com', // 受信はあなたのままでOK
            subject: `【予約リクエスト】${guestName}様より`,
            html: `
                <h3>新しい予約リクエストが届きました</h3>
                <p><strong>お名前:</strong> ${guestName}</p>
                <p><strong>メール:</strong> ${guestEmail}</p>
                <p><strong>日時:</strong> ${selectedDate} ${selectedTime}</p>
                <p><strong>メモ:</strong> ${note || 'なし'}</p>
                <hr/>
                <p>GAKU-HUB OSのダッシュボードから承認・却下を行ってください。</p>
            `
        })
      });

      setStep('done');

    } catch (error: any) {
      console.error(error);
      alert('予約リクエストの送信に失敗しました: ' + error.message);
    } finally {
      setLoadingSubmit(false);
    }
  };

  // --- 画面表示 (ここは変更なし) ---
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-xl shadow-lg text-center animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">リクエスト完了</h2>
          <p className="text-gray-600 mb-6 text-sm leading-relaxed">
            日程の仮押さえを受け付けました。<br/>
            主催者が確認後、入力されたメールアドレス宛に<br/>
            確定連絡をお送りします。
          </p>
          <button onClick={() => window.location.reload()} className="text-purple-600 font-bold hover:bg-purple-50 px-4 py-2 rounded transition">
            最初の画面に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white max-w-4xl w-full rounded-xl shadow-lg overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        
        {/* 左側: ホスト情報エリア */}
        <div className="md:w-1/3 bg-purple-600 p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-[-50px] left-[-50px] w-32 h-32 bg-white opacity-10 rounded-full"></div>
          <div className="absolute bottom-[-20px] right-[-20px] w-48 h-48 bg-white opacity-10 rounded-full"></div>

          <div className="relative z-10">
            <h4 className="text-purple-200 text-xs font-bold uppercase tracking-wider mb-2">GAKU-HUB Booking</h4>
            <h1 className="text-2xl font-bold mb-4">面談予約</h1>
            <p className="text-purple-100 text-sm opacity-90 leading-relaxed">
              ご希望の日時を選択してください。<br/>
              カレンダーの空き状況から、予約可能な枠を表示しています。
            </p>
          </div>
          <div className="mt-8 pt-8 border-t border-purple-500 relative z-10">
            <div className="flex items-center gap-2 text-sm opacity-80">
              <Clock size={16}/>
              <span>所要時間: 60分</span>
            </div>
            <div className="flex items-center gap-2 text-sm opacity-80 mt-2">
              <Calendar size={16}/>
              <span>オンライン (Google Meet)</span>
            </div>
          </div>
        </div>

        {/* 右側: 入力エリア */}
        <div className="md:w-2/3 p-6 md:p-8 overflow-y-auto max-h-[80vh] md:max-h-none">
            
          {/* Step 1: 日時選択 */}
          {step === 'date' && (
             <div className="animate-in fade-in slide-in-from-right-4">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <span className="bg-purple-100 text-purple-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    日時を選択
                </h2>
                
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-600 mb-2">日付</label>
                        <input 
                            type="date" 
                            value={selectedDate} 
                            min={new Date().toISOString().split('T')[0]}
                            onChange={e => { setSelectedDate(e.target.value); setSelectedTime(''); }} 
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-purple-200 outline-none transition"
                        />
                    </div>

                    {selectedDate && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="block text-sm font-bold text-gray-600 mb-2">開始時間</label>
                            
                            {loadingSlots ? (
                                <div className="flex items-center justify-center gap-2 text-purple-600 text-sm py-8 bg-purple-50 rounded-lg border border-purple-100 border-dashed">
                                    <Loader2 className="animate-spin" size={18}/> ホストの予定を確認中...
                                </div>
                            ) : availableSlots.length > 0 ? (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {availableSlots.map(time => (
                                        <button
                                            key={time}
                                            onClick={() => setSelectedTime(time)}
                                            className={`py-3 px-1 rounded-lg border text-sm font-bold transition duration-200 ${
                                                selectedTime === time 
                                                ? 'bg-purple-600 text-white border-purple-600 shadow-md transform scale-105' 
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                                            }`}
                                        >
                                            {time}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-red-500 text-sm bg-red-50 p-4 rounded-lg border border-red-100 flex items-center gap-2">
                                    <Calendar size={16}/>
                                    申し訳ありません、この日は予約枠がありません。
                                </div>
                            )}
                        </div>
                    )}

                    <button 
                        disabled={!selectedDate || !selectedTime}
                        onClick={() => setStep('form')}
                        className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed mt-4 transition shadow-sm"
                    >
                        次へ進む
                    </button>
                </div>
             </div>
          )}

          {/* Step 2: お客様情報入力 */}
          {step === 'form' && (
              <form onSubmit={handleSubmit} className="animate-in slide-in-from-right-4 fade-in">
                  <button 
                    type="button" 
                    onClick={() => setStep('date')} 
                    className="text-sm text-gray-400 mb-4 hover:text-gray-600 flex items-center gap-1 transition"
                  >
                    <ChevronLeft size={16}/> 日時選択に戻る
                  </button>
                  
                  <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <span className="bg-purple-100 text-purple-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    お客様情報を入力
                  </h2>

                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 mb-6 flex items-center gap-2 text-purple-800 text-sm font-bold">
                    <Calendar size={16}/> {selectedDate}
                    <Clock size={16} className="ml-2"/> {selectedTime} 〜
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">お名前 <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 text-gray-400" size={18}/>
                            <input required type="text" value={guestName} onChange={e => setGuestName(e.target.value)} className="pl-10 w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-purple-200 outline-none transition" placeholder="山田 太郎"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">メールアドレス <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 text-gray-400" size={18}/>
                            <input required type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="pl-10 w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-purple-200 outline-none transition" placeholder="taro@example.com"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">メッセージ (任意)</label>
                        <div className="relative">
                            <MessageSquare className="absolute left-3 top-2.5 text-gray-400" size={18}/>
                            <textarea value={note} onChange={e => setNote(e.target.value)} className="pl-10 w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-purple-200 outline-none transition" rows={3} placeholder="相談内容など"/>
                        </div>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loadingSubmit}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 mt-8 shadow-md transition flex items-center justify-center gap-2"
                  >
                    {loadingSubmit ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle size={20}/>}
                    <span>予約リクエストを送信する</span>
                  </button>
              </form>
          )}

        </div>
      </div>
    </div>
  );
}