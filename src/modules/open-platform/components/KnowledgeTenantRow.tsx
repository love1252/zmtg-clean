import { cn } from '@/shared/utils/cn';

export type KnowledgeTenantRowProps = {
  tenantId: string;
  tenantName: string;
  knowledgeLabel: string;
  hitLabel: string;
  coverageLabel: string;
  statusLabel: string;
  isActive: boolean;
  onSelect: (tenantId: string) => void;
};

export function KnowledgeTenantRow({
  tenantId,
  tenantName,
  knowledgeLabel,
  hitLabel,
  coverageLabel,
  statusLabel,
  isActive,
  onSelect,
}: KnowledgeTenantRowProps) {
  return (
    <button
      type="button"
      aria-current={isActive ? 'true' : undefined}
      onClick={() => onSelect(tenantId)}
      className={cn(
        'w-full rounded-xl border px-3 py-3 text-left transition',
        isActive ? 'border-blue-200 bg-blue-50 shadow-sm' : 'border-[#e6edf5] bg-white hover:bg-[#f8fafc]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn('truncate text-sm font-semibold', isActive ? 'text-blue-700' : 'text-slate-950')}>
            {tenantName}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-500">
            <span>知识 {knowledgeLabel}</span>
            <span>命中 {hitLabel}</span>
            <span>覆盖 {coverageLabel}</span>
            <span>状态 {statusLabel}</span>
          </div>
        </div>
        <span className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
          isActive ? 'border-blue-100 bg-white text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600',
        )}>
          {coverageLabel}
        </span>
      </div>
    </button>
  );
}
