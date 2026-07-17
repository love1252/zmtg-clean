import type {
  WorkbenchActionProjection,
  WorkbenchActionRowViewModel,
} from '@/modules/institution-workbench/domain/workbench-action-view-models';
import {
  WORKBENCH_DESKTOP_ACTION_LIMIT,
  WORKBENCH_MOBILE_ACTION_LIMIT,
} from '@/modules/institution-workbench/domain/workbench-action-view-models';

export type WorkbenchActionQueueProps = Readonly<{
  projection: WorkbenchActionProjection;
}>;

function actionSubjectLabel(action: WorkbenchActionRowViewModel): string {
  return action.subject.kind === 'customer' ? action.subject.displayName : action.subject.label;
}

function actionTime(action: WorkbenchActionRowViewModel): string {
  switch (action.kind) {
    case 'appointment':
      return action.appointmentAt;
    case 'followup':
      return action.dueAt;
    case 'conversation':
      return action.lastCustomerMessageAt;
  }
}

/**
 * 只消费已聚合的工作台行动投影；不读取来源、不会重新排序或构造业务链接。
 * 移动端从桌面安全前缀派生，以保证其始终是桌面队列的前缀。
 */
export function WorkbenchActionQueue({ projection }: WorkbenchActionQueueProps) {
  if (projection.status === 'blocked') {
    return null;
  }

  const desktopActions = projection.desktopActions.slice(0, WORKBENCH_DESKTOP_ACTION_LIMIT);
  const mobileActionCount = Math.min(desktopActions.length, WORKBENCH_MOBILE_ACTION_LIMIT);

  return (
    <section aria-labelledby="workbench-action-queue-heading" data-readiness={projection.sourceReadiness.care}>
      <h2 id="workbench-action-queue-heading">行动队列</h2>
      {desktopActions.length === 0 ? (
        <p>当前筛选暂无行动</p>
      ) : (
        <ol aria-label="行动队列">
          {desktopActions.map((action, index) => {
            const isMobileAction = index < mobileActionCount;

            return (
              <li
                key={action.key}
                className={isMobileAction ? undefined : 'hidden md:list-item'}
                data-testid={isMobileAction ? 'mobile-action' : undefined}
              >
                <p>{actionSubjectLabel(action)}</p>
                <p>{actionTime(action)}</p>
                {action.safeSummary === null ? null : <p>{action.safeSummary}</p>}
                <a href={action.detailHref}>查看详情</a>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
