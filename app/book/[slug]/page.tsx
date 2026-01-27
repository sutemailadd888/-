'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Mail, MessageSquare, CheckCircle2, Loader2, ChevronLeft, ArrowRight } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useParams } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function BookingPage() {
  const params = useParams();
  const slug = params.slug as string; // ★変更: hostIdではなくslugを使う

  // 画面遷移の状態管理
  const [step, setStep] = useState<'date' | 'form' | 'done'>('date');

  // 入力データ
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [note, setNote] = useState('');

  // データ状態
  const [menuInfo, setMenuInfo] = useState<any>(null); // ★追加: メニュー情報
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  // 1. 初回ロード時にメニュー情報(タイトルや時間)を取得
  useEffect(() => {
    const fetchMenu = async () => {
        const { data, error } = await supabase
            .from('meeting_types')
            .select('*')
            .eq('slug', slug)
            .single();
        
        if (data) {
            setMenuInfo(data);
        } else {
            alert('予約メニューが見つかりません');
        }
        setLoadingMenu(false);
    };
    fetchMenu();
  }, [slug]);

  // 2. 日付が選ばれたら、空き時間をAPIから取得
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
        // ★変更: slugを渡して空き時間を計算させる
        const res = await fetch(`/api/book/slots?slug=${slug}&date=${selectedDate}`);
        const data = await res.json();
        
        if (data.slots) {
            setAvailableSlots(data.slots);
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
    setLoadingSubmit(true);

    try {
      // ★変更: Step 1で作ったAPI経由で送信する
      const res = await fetch('/api/book/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            slug: slug,
            date: selectedDate,
            time: selectedTime,
            guest_name: guestName,
            guest_email: guestEmail,
            note: note
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '予約に失敗しました');

      setStep('done');

    } catch (error: any) {
      console.error(error);
      alert('送信に失敗しました: ' + error.message);
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (loadingMenu) return <div className="min-h-screen flex items-center justify-center text-gray-400"><Loader2 className="animate-spin"/></div>;

  // --- 完了画面 ---
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-10 rounded-3xl shadow-xl text-center animate-in fade-in zoom-in-95 border border-gray-100">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3 tracking-tight">リクエスト送信完了</h2>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed">
            日程の仮押さえを受け付けました。<br/>
            確認後、確定メールをお送りしますので<br/>しばらくお待ちください。
          </p>
          <button onClick={() => window.location.reload()} className="text-purple-600 font-bold hover:bg-purple-50 px-6 py-3 rounded-full transition text-sm">
            トップに戻る
          </button>
        </div>
      </div>
    );
  }

  // --- メイン画面 ---
  return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4 font-sans text-gray-900">
      <div className="bg-white max-w-5xl w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-gray-100">
        
        {/* 左側: ブランドエリア (DBから取得したタイトルを表示) */}
        <div className="md:w-5/12 bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 p-10 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-[-20%] left-[-20%] w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-indigo-500 opacity-20 rounded-full blur-3xl"></div>

          <div className="relative z-10">
            <div className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold tracking-widest uppercase mb-6 border border-white/10">
              GAKU-HUB Booking
            </div>
            <h1 className="text-3xl font-bold mb-4 leading-tight">
              {menuInfo?.title || 'Online Meeting'}
            </h1>
            <p className="text-purple-100 text-sm opacity-90 leading-relaxed font-medium">
              {menuInfo?.description || 'ご都合の良い日時を選択してください。カレンダーと連携して、最適な時間を提案します。'}
            </p>
          </div>

          <div className="mt-8 pt-8 border-t border-white/20 relative z-10 space-y-4">
            <div className="flex items-center gap-3 text-sm font-medium">
              <div className="p-2 bg-white/10 rounded-lg">
                <Clock size={18}/>
              </div>
              <span>所要時間: {menuInfo?.duration_minutes || 60}分</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium">
              <div className="p-2 bg-white/10 rounded-lg">
                <Calendar size={18}/>
              </div>
              <span>Google Meet で実施</span>
            </div>
          </div>
        </div>

        {/* 右側: 入力フォームエリア (変更なし) */}
        <div className="md:w-7/12 p-8 md:p-12 bg-white relative">
            
          {/* Step 1: 日時選択 */}
          {step === 'date' && (
             <div className="animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col">
                <h2 className="text-xl font-bold text-gray-800 mb-8 flex items-center gap-3">
                    <span className="bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-md shadow-purple-200">1</span>
                    日時を選択
                </h2>
                
                <div className="space-y-8 flex-1">
                    <div>
                        <label className="block text-sm font-bold text-gray-600 mb-3">日付を選ぶ</label>
                        <input 
                            type="date" 
                            value={selectedDate} 
                            min={new Date().toISOString().split('T')[0]}
                            onChange={e => { setSelectedDate(e.target.value); setSelectedTime(''); }} 
                            className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl text-gray-800 font-medium focus:ring-2 focus:ring-purple-500 focus:bg-white focus:border-transparent outline-none transition-all cursor-pointer"
                        />
                    </div>

                    {selectedDate && (
                        <div className="animate-in fade-in slide-in-from-bottom-2">
                            <label className="block text-sm font-bold text-gray-600 mb-3">開始時間</label>
                            
                            {loadingSlots ? (
                                <div className="flex flex-col items-center justify-center gap-3 text-purple-600 text-sm py-10 bg-purple-50/50 rounded-xl border border-purple-100 border-dashed">
                                    <Loader2 className="animate-spin" size={24}/>
                                    <span className="font-medium">空き状況を確認中...</span>
                                </div>
                            ) : availableSlots.length > 0 ? (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                    {availableSlots.map(time => (
                                        <button
                                            key={time}
                                            onClick={() => setSelectedTime(time)}
                                            className={`py-3 px-2 rounded-xl text-sm font-bold transition-all duration-200 border ${
                                                selectedTime === time 
                                                ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-200 transform scale-105' 
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:bg-purple-50 hover:shadow-sm'
                                            }`}
                                        >
                                            {time}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-red-500 text-sm bg-red-50 p-6 rounded-xl border border-red-100 flex items-center gap-3 font-medium">
                                    <Calendar size={18}/>
                                    この日は予約可能な枠がありません。
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <button 
                        disabled={!selectedDate || !selectedTime}
                        onClick={() => setStep('form')}
                        className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-2 group"
                    >
                        次へ進む
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
                    </button>
                </div>
             </div>
          )}

          {/* Step 2: お客様情報入力 */}
          {step === 'form' && (
              <form onSubmit={handleSubmit} className="animate-in slide-in-from-right-8 duration-500 fade-in h-full flex flex-col">
                  <button 
                    type="button" 
                    onClick={() => setStep('date')} 
                    className="text-sm text-gray-400 mb-6 hover:text-purple-600 flex items-center gap-1 transition-colors w-fit font-medium"
                  >
                    <ChevronLeft size={16}/> 日時選択に戻る
                  </button>
                  
                  <h2 className="text-xl font-bold text-gray-800 mb-8 flex items-center gap-3">
                    <span className="bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-md shadow-purple-200">2</span>
                    お客様情報を入力
                  </h2>

                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-8 flex items-center gap-3 text-purple-900 text-sm font-bold">
                    <div className="bg-white p-2 rounded-lg shadow-sm text-purple-600">
                        <Calendar size={18}/>
                    </div>
                    <span>{selectedDate}</span>
                    <span className="text-purple-300">|</span>
                    <span>{selectedTime} 〜</span>
                  </div>
                  
                  <div className="space-y-5 flex-1">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">お名前 <span className="text-red-500">*</span></label>
                        <div className="relative group">
                            <User className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-purple-500 transition-colors" size={18}/>
                            <input required type="text" value={guestName} onChange={e => setGuestName(e.target.value)} 
                                className="pl-11 w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white focus:border-transparent outline-none transition-all placeholder:text-gray-400 font-medium" 
                                placeholder="山田 太郎"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">メールアドレス <span className="text-red-500">*</span></label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-purple-500 transition-colors" size={18}/>
                            <input required type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} 
                                className="pl-11 w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white focus:border-transparent outline-none transition-all placeholder:text-gray-400 font-medium" 
                                placeholder="taro@example.com"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">メッセージ (任意)</label>
                        <div className="relative group">
                            <MessageSquare className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-purple-500 transition-colors" size={18}/>
                            <textarea value={note} onChange={e => setNote(e.target.value)} 
                                className="pl-11 w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white focus:border-transparent outline-none transition-all placeholder:text-gray-400 font-medium min-h-[100px]" 
                                rows={3} placeholder="相談内容や事前に伝えたいこと"
                            />
                        </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <button 
                        type="submit" 
                        disabled={loadingSubmit}
                        className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold hover:bg-purple-700 shadow-xl shadow-purple-200 transition-all flex items-center justify-center gap-2 transform active:scale-[0.98]"
                    >
                        {loadingSubmit ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>}
                        <span>予約リクエストを送信</span>
                    </button>
                  </div>
              </form>
          )}

        </div>
      </div>
    </div>
  );
}