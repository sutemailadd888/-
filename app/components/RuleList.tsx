// app/components/RuleList.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Trash2, RefreshCw } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ★変更: orgId を受け取る
interface Props {
  session: any;
  orgId: string;
}

export default function RuleList({ session, orgId }: Props) {
  const [rules, setRules] = useState<any[]>([]);

  // ★変更: orgId が変わったら再取得
  useEffect(() => {
    fetchRules();
  }, [session, orgId]);

  const fetchRules = async () => {
    if (!session?.user?.id || !orgId) return;

    // ★変更: organization_id で絞り込み
    const { data } = await supabase
      .from('meeting_rules')
      .select('*')
      .eq('organization_id', orgId) 
      .order('created_at', { ascending: false });

    if (data) setRules(data);
  };

  const handleDelete = async (id: string) => {
    if(!confirm("このルールを削除しますか？")) return;
    const { error } = await supabase
        .from('meeting_rules')
        .delete()
        .eq('id', id);
    if (!error) fetchRules();
  };

  if (rules.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-gray-600 font-bold mb-3 flex items-center gap-2">
        <RefreshCw size={16}/> 稼働中のエージェント ({rules.length})
      </h3>
      <div className="space-y-3">
        {rules.map((rule) => (
            <div key={rule.id} className="bg-white border border-gray-200 p-4 rounded-lg flex justify-between items-center shadow-sm">
                <div>
                    <div className="font-bold text-gray-800">{rule.rule_name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                        {rule.config.start_time}〜 ({rule.config.duration_minutes}分)
                    </div>
                </div>
                <button 
                    onClick={() => handleDelete(rule.id)}
                    className="text-gray-400 hover:text-red-500 p-2"
                >
                    <Trash2 size={18}/>
                </button>
            </div>
        ))}
      </div>
    </div>
  );
}