// app/components/RequestInbox.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Mail, Check, X, Loader2, Calendar, Clock, AlertCircle } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ★変更: orgId を受け取る
interface Props {
  session: any;
  orgId: string;
}

export default function RequestInbox({ session, orgId }: Props) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // ★変更: orgId が変わるたびに再読み込み
  useEffect(() => {
    if (session && orgId) {
        fetchRequests();
    }
  }, [session, orgId]);

  const fetchRequests = async () => {
    // ★変更: organization_id でフィルタリングする
    const { data, error } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('organization_id', orgId) // ここが重要！
      .eq('status', 'pending') // 未承認のものだけ
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRequests(data);
    }
  };

  const handleApprove = async (req: any) => {
    if (!confirm(`${req.guest_name} 様の予約を承認しますか？`)) return;
    setProcessingId(req.id);
    
    try {
      // 1. カレンダーに予定を作成するAPIを呼ぶ
      // (作成処理の中で Google Calendar API を叩く)
      const res = await fetch('/api/book/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            session: session, 
            request: req 
        }),
      });
      
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      // 2. DBのステータスを承認済み(confirmed)にする
      const { error } = await supabase
        .from('booking_requests')
        .update({ status: 'confirmed' })
        .eq('id', req.id);

      if (error) throw error;

      alert("✅ 予約を承認し、カレンダーに追加しました！");
      fetchRequests(); // リスト更新

    } catch (e: any) {
      console.error(e);
      alert(`エラー: ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('本当に却下しますか？（メール通知はされません）')) return;
    setProcessingId(id);

    const { error } = await supabase
        .from('booking_requests')
        .update({ status: 'rejected' })
        .eq('id', id);

    if (!error) {
        fetchRequests();
    } else {
        alert("エラーが発生しました");
    }
    setProcessingId(null);
  };

  // リクエストが0件の場合は何も表示しない
  if (requests.length === 0) return null;

  return (
    <div className="bg-white border border-purple-200 rounded-xl p-6 shadow-sm mb-8 animate-in slide-in-from-top-4">
      <h3 className="text-purple-900 font-bold mb-4 flex items-center gap-2">
        <Mail className="text-purple-600"/>
        未承認の予約リクエスト ({requests.length})
        <span className="text-xs font-normal text-purple-600 bg-purple-50 px-2 py-1 rounded-full animate-pulse">
            New
        </span>
      </h3>

      <div className="space-y-4">
        {requests.map((req) => (
            <div key={req.id} className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start md:items-center bg-gray-50">
                
                {/* 日時と内容 */}
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-white border border-gray-300 text-gray-700 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                            <Calendar size={12}/>
                            {new Date(req.start_time).toLocaleDateString()}
                        </span>
                        <span className="bg-white border border-gray-300 text-gray-700 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                            <Clock size={12}/>
                            {new Date(req.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 〜
                        </span>
                    </div>
                    <div className="font-bold text-gray-800 text-lg mb-1">
                        {req.guest_name} <span className="text-sm font-normal text-gray-500">様より</span>
                    </div>
                    <div className="text-sm text-gray-500 flex flex-col gap-1">
                        <div>📧 {req.guest_email}</div>
                        {req.note && (
                            <div className="bg-white p-2 rounded border border-gray-200 text-gray-600 mt-1 text-xs">
                                "{req.note}"
                            </div>
                        )}
                    </div>
                </div>

                {/* アクションボタン */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button 
                        onClick={() => handleReject(req.id)}
                        disabled={processingId === req.id}
                        className="flex-1 md:flex-none border border-gray-300 text-gray-500 hover:bg-gray-200 hover:text-gray-700 px-4 py-2 rounded-lg text-sm font-bold transition"
                    >
                        却下
                    </button>
                    <button 
                        onClick={() => handleApprove(req)}
                        disabled={processingId === req.id}
                        className="flex-1 md:flex-none bg-purple-600 text-white hover:bg-purple-700 px-6 py-2 rounded-lg text-sm font-bold shadow-md transition flex items-center justify-center gap-2"
                    >
                        {processingId === req.id ? <Loader2 className="animate-spin" size={16}/> : <Check size={16}/>}
                        承認する
                    </button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}