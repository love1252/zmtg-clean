import { InstitutionWorkbenchShell } from '@/modules/institution-workbench/components/InstitutionWorkbenchShell';
import type { WorkbenchActionProjection } from '@/modules/institution-workbench/domain/workbench-action-view-models';
import type { WorkbenchCapabilityProjection } from '@/modules/institution-workbench/domain/workbench-capability-view-models';
import type { WorkbenchLifecycleProjection } from '@/modules/institution-workbench/domain/workbench-lifecycle-view-models';

const capabilityOffActionProjection: WorkbenchActionProjection = {
  status: 'blocked',
  filter: 'all',
  cards: [],
  desktopActions: [],
  mobileActions: [],
};

const capabilityOffLifecycleProjection: WorkbenchLifecycleProjection = {
  status: 'blocked',
  items: [],
};

const capabilityOffCapabilityProjection: WorkbenchCapabilityProjection = {
  status: 'blocked',
  summaries: [],
  quickCreateMenu: null,
};

export function InstitutionWorkbenchCapabilityOff({
  genuineAllowed = false,
  capabilityProjection = null,
  actionProjection = null,
}: Readonly<{
  genuineAllowed?: boolean;
  capabilityProjection?: WorkbenchCapabilityProjection | null;
  actionProjection?: WorkbenchActionProjection | null;
}>) {
  if (
    genuineAllowed &&
    capabilityProjection?.status === 'projected' &&
    (
      capabilityProjection.quickCreateMenu === null
      || (
        capabilityProjection.quickCreateMenu.label === '新建'
        && capabilityProjection.quickCreateMenu.items.length === 1
        && capabilityProjection.quickCreateMenu.items[0]?.key
          === 'action_care_followup_create'
        && capabilityProjection.quickCreateMenu.items[0]?.href
          === '/hospital/care/followups?create=1'
      )
    )
  ) {
    return (
      <div
        data-capability-state={
          capabilityProjection.quickCreateMenu !== null
          || actionProjection?.status === 'projected'
            ? 'controlled-write-pilot'
            : 'readonly-pilot'
        }
        className="min-w-0"
      >
        <InstitutionWorkbenchShell
          actionProjection={
            actionProjection?.status === 'projected'
              ? actionProjection
              : capabilityOffActionProjection
          }
          lifecycleProjection={capabilityOffLifecycleProjection}
          capabilityProjection={capabilityProjection}
        />
      </div>
    );
  }

  if (genuineAllowed) {
    return (
      <section
        data-capability-state="authorized-boundary"
        aria-labelledby="institution-workbench-authorized-boundary-title"
        className="rounded-[28px] border border-emerald-100 bg-emerald-50/70 px-6 py-10 text-center shadow-[0_16px_42px_rgba(32,61,104,0.06)]"
      >
        <h2
          id="institution-workbench-authorized-boundary-title"
          className="text-xl font-semibold text-slate-950"
        >
          工作台访问已核验
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
          当前仅确认工作台访问边界；业务数据、操作入口和实时统计仍未开放。
        </p>
      </section>
    );
  }

  return (
    <div data-capability-state="blocked" className="min-w-0">
      <InstitutionWorkbenchShell
        actionProjection={capabilityOffActionProjection}
        lifecycleProjection={capabilityOffLifecycleProjection}
        capabilityProjection={capabilityOffCapabilityProjection}
      />
    </div>
  );
}
