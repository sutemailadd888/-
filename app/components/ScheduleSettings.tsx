// app/components/ScheduleSettings.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Settings, Save, Loader2, Clock } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ★変更点: orgId を受け取るようにする
interface Props {
  session: any;
  orgId: string; 
}

const DEFAULT_CONFIG = {
  monday:    { active: true, start: '10:00', end: '18:00' },
  tuesday:   { active: true, start: '10:00', end: '18:00' },
  wednesday: { active: true, start: '10:00', end: '18:00' },
  thursday:  { active: true, start: '10:00', end: '18:00' },
  friday:    { active: true, start: '10:00', end: '18:00' },
  saturday:  { active: false, start: '10:00', end: '18:00' },
  sunday:    { active: false, start: '10:00', end: '18:00' },
};

const DAY_LABELS: any = {
  monday: '月曜日', tuesday: '火曜日', wednesday: '水曜日',
  thursday: '木曜日', friday: '金曜日', saturday: '土曜日', sunday: '日曜日'
};

export default function ScheduleSettings({ session, orgId }: Props) {
  const [config, setConfig] = useState<any>(DEFAULT_CONFIG);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // ★変更点: orgId が変わるたびに再読み込みする
  useEffect(() => {
    fetchSettings();
  }, [session, orgId]);

  const fetchSettings = async () => {
    if (!session?.user?.id || !orgId) return;
    
    // ★変更点: organization_id も条件に加える
    const { data } = await supabase
        .from('schedule_settings')
        .select('weekly_config')
        .eq('user_id', session.user.id)
        .eq('organization_id', orgId)
        .single();
    
    if (data?.weekly_config) {
        setConfig(data.weekly_config);
    } else {
        // 設定がない場合(新しい組織など)はデフォルトに戻す
        setConfig(DEFAULT_CONFIG);
    }
  };

  const handleSave = async () => {
    if (!orgId) return alert("組織が選択されていません");
    setLoading(true);

    // ★変更点: organization_id を含めて保存する
    const { error } = await supabase
        .from('schedule_settings')
        .upsert({
            user_id: session.user.id,
            organization_id: orgId, // ここ！
            weekly_config: config,
            updated_at: new Date().toISOString()
        });
    
    setLoading(false);
    if (!error) {
        alert("✅ このワークスペースの稼働ルールを保存しました");
        setIsOpen(false);
    } else {
        alert("保存失敗: " + error.message);
    }
  };

  const handleChange = (day: string, field: string, value: any) => {
    setConfig((prev: any) => ({
        ...prev,
        [day]: { ...prev[day], [field]: value }
    }));
  };

  return (
    <div className="mb-6">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
      >
        <Settings size={16}/> 稼働日・時間設定
      </button>

      {isOpen && (
        <div className="mt-4 bg-white p-6 rounded-xl border border-gray-200 shadow-lg animate-in fade-in slide-in-from-top-2">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Clock className="text-purple-600"/> 曜日ごとの受付時間
            </h3>
            <p className="text-xs text-gray-500 mb-4">
                ※ この設定は、現在開いているワークスペースにのみ適用されます。
            </p>
            
            <div className="space-y-3">
                {Object.keys(DAY_LABELS).map((day) => (
                    <div key={day} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-3 w-32">
                            <input 
                                type="checkbox" 
                                checked={config[day].active}
                                onChange={(e) => handleChange(day, 'active', e.target.checked)}
                                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                            />
                            <span className={`text-sm font-bold ${config[day].active ? 'text-gray-700' : 'text-gray-400'}`}>
                                {DAY_LABELS[day]}
                            </span>
                        </div>

                        {config[day].active ? (
                            <div className="flex items-center gap-2">
                                <input 
                                    type="time" 
                                    value={config[day].start}
                                    onChange={(e) => handleChange(day, 'start', e.target.value)}
                                    className="text-sm border border-gray-300 rounded p-1"
                                />
                                <span className="text-gray-400">〜</span>
                                <input 
                                    type="time" 
                                    value={config[day].end}
                                    onChange={(e) => handleChange(day, 'end', e.target.value)}
                                    className="text-sm border border-gray-300 rounded p-1"
                                />
                            </div>
                        ) : (
                            <span className="text-xs text-gray-400 italic flex-1 text-center">-- 休み --</span>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button onClick={() => setIsOpen(false)} className="text-sm text-gray-500 px-4 py-2 hover:text-gray-700">キャンセル</button>
                <button 
                    onClick={handleSave} 
                    disabled={loading}
                    className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition"
                >
                    {loading ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                    この設定で保存
                </button>
            </div>
        </div>
      )}
    </div>
  );
}