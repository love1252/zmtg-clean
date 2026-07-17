import { WorkbenchActionQueue } from '@/modules/institution-workbench/components/WorkbenchActionQueue';
import type {
  WorkbenchActionProjection,
  WorkbenchCareCardViewModel,
} from '@/modules/institution-workbench/domain/workbench-action-view-models';
import type { WorkbenchCapabilityProjection } from '@/modules/institution-workbench/domain/workbench-capability-view-models';
import {
  WORKBENCH_LIFECYCLE_KEYS,
  type WorkbenchLifecycleItemViewModel,
  type WorkbenchLifecycleProjection,
} from '@/modules/institution-workbench/domain/workbench-lifecycle-view-models';

export type InstitutionWorkbenchShellProps = Readonly<{
  actionProjection: WorkbenchActionProjection;
  lifecycleProjection: WorkbenchLifecycleProjection;
  capabilityProjection: WorkbenchCapabilityProjection;
}>;

function sourceValue(value: number | null): string {
  return value === null ? '--' : String(value);
}

function FreshnessNote({ observedAt }: Readonly<{ observedAt: string | null }>) {
  return observedAt === null ? null : <p>截至 {observedAt}</p>;
}

function CareCard({ card }: Readonly<{ card: WorkbenchCareCardViewModel }>) {
  const content = (
    <>
      <h3>{card.title}</h3>
      <p>{sourceValue(card.count)}</p>
      {card.status === 'stale' ? <FreshnessNote observedAt={card.observedAt} /> : null}
    </>
  );

  if (card.status === 'ready' || card.status === 'empty') {
    return (
      <li data-card-status={card.status}>
        <a aria-label={`${card.title}详情`} href={card.canonicalHref}>
          {content}
        </a>
      </li>
    );
  }

  return <li data-card-status={card.status}>{content}</li>;
}

function LifecycleItem({ item }: Readonly<{ item: WorkbenchLifecycleItemViewModel }>) {
  const content = (
    <>
      <h3>{item.label}</h3>
      <p>{sourceValue(item.count)}</p>
      {item.status === 'stale' ? <FreshnessNote observedAt={item.observedAt} /> : null}
    </>
  );

  return (
    <li data-lifecycle-status={item.status}>
      {item.canonicalHref === null ? (
        content
      ) : (
        <a aria-label={`查看${item.label}客户`} href={item.canonicalHref}>
          {content}
        </a>
      )}
    </li>
  );
}

function orderedLifecycleItems(projection: WorkbenchLifecycleProjection) {
  if (projection.status === 'blocked') {
    return [];
  }

  return WORKBENCH_LIFECYCLE_KEYS.flatMap((key) => {
    const item = projection.items.find((candidate) => candidate.key === key);
    return item === undefined ? [] : [item];
  });
}

/**
 * capability-off 工作台展示层：只接收已授权、低敏的领域投影，不承担读取、解析、授权或刷新职责。
 */
export function InstitutionWorkbenchShell({
  actionProjection,
  lifecycleProjection,
  capabilityProjection,
}: InstitutionWorkbenchShellProps) {
  const lifecycleItems = orderedLifecycleItems(lifecycleProjection);
  const hasVisibleProjection =
    actionProjection.status === 'projected' ||
    lifecycleProjection.status === 'projected' ||
    capabilityProjection.status === 'projected';

  return (
    <main aria-label="机构工作台">
      <h1>机构工作台</h1>
      {hasVisibleProjection ? null : <p>工作台当前不可用</p>}

      {actionProjection.status !== 'projected' || actionProjection.cards.length === 0 ? null : (
        <section aria-labelledby="workbench-care-cards-heading">
          <h2 id="workbench-care-cards-heading">Care 行动概览</h2>
          <ul aria-label="Care 行动概览">
            {actionProjection.cards.map((card) => (
              <CareCard key={card.key} card={card} />
            ))}
          </ul>
        </section>
      )}

      <WorkbenchActionQueue projection={actionProjection} />

      {lifecycleItems.length === 0 ? null : (
        <section aria-labelledby="workbench-lifecycle-heading">
          <h2 id="workbench-lifecycle-heading">客户旅程</h2>
          <ul aria-label="客户旅程">
            {lifecycleItems.map((item) => (
              <LifecycleItem key={item.key} item={item} />
            ))}
          </ul>
        </section>
      )}

      {capabilityProjection.status !== 'projected' ? null : (
        <section aria-labelledby="workbench-capability-heading">
          <h2 id="workbench-capability-heading">机构能力</h2>
          {capabilityProjection.summaries.map((summary) => (
            <article key={summary.key}>
              <h3>{summary.label}</h3>
              <p>{summary.safeSummary}</p>
              {summary.dataStatus === 'stale' ? <FreshnessNote observedAt={summary.observedAt} /> : null}
            </article>
          ))}
          {capabilityProjection.quickCreateMenu === null ? null : (
            <nav aria-label={capabilityProjection.quickCreateMenu.label}>
              <h3>{capabilityProjection.quickCreateMenu.label}</h3>
              <ul>
                {capabilityProjection.quickCreateMenu.items.map((item) => (
                  <li key={item.key}>
                    <a href={item.href}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </section>
      )}
    </main>
  );
}
