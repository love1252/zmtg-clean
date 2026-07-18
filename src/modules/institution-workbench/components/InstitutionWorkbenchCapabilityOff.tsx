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

/**
 * 首期根页只展示已发布的工作台外壳。业务来源尚未接通时，显式传入不可用/阻断投影，
 * 不以 fixture、旧工作台摘要或静态计数补齐。
 */
export function InstitutionWorkbenchCapabilityOff() {
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
