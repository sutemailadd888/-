'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase初期化
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
  workspaceId: string;
  userId: string;
}

export default function MeetingTypeList({ workspaceId, userId }: Props) {
  const [types, setTypes] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // フォーム入力用
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    duration: 60,
    booking_method: 'and', // 'and' or 'or'
    host_ids: [] as string[] // 選ばれたメンバーID
  });

  // データ読み込み
  useEffect(() => {
    fetchData();
  }, [workspaceId]);

  const fetchData = async () => {
    // 1. 作成済みのメニューを取得
    const { data: typeData } = await supabase
      .from('meeting_types')
      .select('*, meeting_hosts(user_id)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    
    if (typeData) setTypes(typeData);

    // 2. メンバー一覧を取得 (担当者選択用)
    // ※実際はusersテーブルと結合して名前を取りたいが、簡易的にIDとemail等で表示
    const { data: memberData } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId);

    if (memberData) {
        // IDだけだと誰か分からないので、user_secretsなどから情報を補完するか、
        // 本来はProfilesテーブルが必要。今回は簡易的に「自分」と「他人」で表示分けする等の対応
        setMembers(memberData);
    }
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.slug || formData.host_ids.length === 0) {
      alert('タイトル、URL、担当者は必須です');
      return;
    }
    setLoading(true);

    try {
      // 1. メニュー本体を作成
      const { data: newType, error: typeError } = await supabase
        .from('meeting_types')
        .insert({
          workspace_id: workspaceId,
          title: formData.title,
          slug: formData.slug,
          duration_minutes: formData.duration,
          booking_method: formData.booking_method
        })
        .select()
        .single();

      if (typeError) throw typeError;

      // 2. 担当者を紐付け (meeting_hosts)
      const hostRows = formData.host_ids.map(uid => ({
        meeting_type_id: newType.id,
        user_id: uid
      }));

      const { error: hostError } = await supabase
        .from('meeting_hosts')
        .insert(hostRows);

      if (hostError) throw hostError;

      // リセット & 再読み込み
      setIsCreating(false);
      setFormData({ title: '', slug: '', duration: 60, booking_method: 'and', host_ids: [] });
      fetchData();
      alert('予約メニューを作成しました！');

    } catch (e: any) {
      alert('エラー: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleHost = (uid: string) => {
    setFormData(prev => {
      const exists = prev.host_ids.includes(uid);
      return {
        ...prev,
        host_ids: exists 
          ? prev.host_ids.filter(id => id !== uid)
          : [...prev.host_ids, uid]
      };
    });
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">予約メニュー</h2>
          <p className="text-sm text-gray-500">外部向けの予約ページを作成・管理します</p>
        </div>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          {isCreating ? 'キャンセル' : '+ 新規作成'}
        </button>
      </div>

      {/* 新規作成フォーム */}
      {isCreating && (
        <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">メニュー名</label>
              <input 
                type="text" 
                placeholder="例: 60分 初回面談"
                className="w-full p-2 border rounded"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">URLスラッグ</label>
              <div className="flex items-center">
                <span className="text-gray-400 text-sm mr-1">/book/</span>
                <input 
                  type="text" 
                  placeholder="interview-60"
                  className="w-full p-2 border rounded"
                  value={formData.slug}
                  onChange={e => setFormData({...formData, slug: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">所要時間 (分)</label>
              <input 
                type="number" 
                className="w-full p-2 border rounded"
                value={formData.duration}
                onChange={e => setFormData({...formData, duration: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">日程調整ルール</label>
              <select 
                className="w-full p-2 border rounded"
                value={formData.booking_method}
                onChange={e => setFormData({...formData, booking_method: e.target.value})}
              >
                <option value="and">全員参加 (AND条件)</option>
                <option value="or">誰か一人 (OR条件)</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-2">担当者を選択</label>
            <div className="flex gap-4 flex-wrap">
              {members.map(m => (
                <label key={m.user_id} className="flex items-center space-x-2 bg-white px-3 py-2 rounded border cursor-pointer hover:bg-gray-50">
                  <input 
                    type="checkbox" 
                    checked={formData.host_ids.includes(m.user_id)}
                    onChange={() => toggleHost(m.user_id)}
                  />
                  <span className="text-sm">
                    {m.user_id === userId ? '自分 (You)' : `User ${m.user_id.substring(0,4)}...`}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button 
            onClick={handleCreate} 
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存してURLを発行'}
          </button>
        </div>
      )}

      {/* 一覧リスト */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {types.length === 0 && !isCreating && (
          <p className="text-gray-400 col-span-2 text-center py-8">まだ予約メニューがありません。「新規作成」から作ってみましょう。</p>
        )}
        
        {types.map(type => (
          <div key={type.id} className="border p-4 rounded-lg hover:shadow-md transition bg-white relative group">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-lg">{type.title}</h3>
              <span className={`text-xs px-2 py-1 rounded ${type.booking_method === 'and' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                {type.booking_method === 'and' ? '全員参加' : '誰か1人'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              ⏱ {type.duration_minutes}分 / 👤 担当: {type.meeting_hosts.length}名
            </p>
            
            <div className="flex items-center bg-gray-50 p-2 rounded justify-between">
              <code className="text-xs text-gray-500 truncate max-w-[200px]">
                {typeof window !== 'undefined' ? `${window.location.origin}/book/${type.slug}` : `/book/${type.slug}`}
              </code>
              <button 
                onClick={() => {
                   const url = `${window.location.origin}/book/${type.slug}`;
                   navigator.clipboard.writeText(url);
                   alert('URLをコピーしました');
                }}
                className="text-xs bg-white border px-2 py-1 rounded hover:bg-gray-100 text-blue-600 font-bold"
              >
                Copy
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}