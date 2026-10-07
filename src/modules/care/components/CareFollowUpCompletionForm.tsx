'use client';

import { useState } from 'react';
import {
  parseFollowUpManualFeedback,
  type FollowUpCompletionCode,
} from '@/modules/care/domain/follow-up-completion-result';

export const manualCompletionLabels = {
  contact_completed: '已完成联系',
  no_response_closed: '无响应关闭',
  customer_declined: '客户拒绝',
  invalid_or_duplicate: '无效或重复任务',
} as const;

type ManualCompletionCode = keyof typeof manualCompletionLabels;
export function completionLabel(code: FollowUpCompletionCode) {
  return code === 'his_appointment_linked' ? '已关联预约' : manualCompletionLabels[code];
}

export function CareFollowUpCompletionForm({ onComplete }: {
  onComplete: (body: { code: ManualCompletionCode; feedback: ReturnType<typeof parseFollowUpManualFeedback> }) => Promise<void>;
}) {
  const [code, setCode] = useState<ManualCompletionCode>('contact_completed');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  return <form className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4" onSubmit={event => {
    event.preventDefault();
    const text = summary.trim();
    const feedback = text ? parseFollowUpManualFeedback({ kind: 'manual_low_sensitivity', summary: text }) : null;
    if (text && !feedback) {
      setError('摘要最多 240 字，不能包含手机号、身份证、病历信息或控制字符。');
      return;
    }
    setError('');
    void onComplete({ code, feedback });
  }}>
    <h3 className="font-semibold">记录随访结果</h3>
    <label className="grid gap-1 text-sm">完成结果
      <select value={code} onChange={event => setCode(event.target.value as ManualCompletionCode)} className="rounded-lg border p-2">
        {Object.entries(manualCompletionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <label className="grid gap-1 text-sm">低敏摘要（选填，最多 240 字）
      <textarea rows={3} value={summary} onChange={event => setSummary(event.target.value)} className="rounded-lg border p-2" />
    </label>
    <p className="text-xs text-slate-500">{Array.from(summary.trim()).length}/240 字。只记录联系结果，不填写手机号、身份证、病历或诊疗信息。</p>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <button type="submit" className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50">确认完成</button>
  </form>;
}
