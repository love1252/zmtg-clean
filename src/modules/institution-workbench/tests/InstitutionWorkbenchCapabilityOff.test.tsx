
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InstitutionWorkbenchCapabilityOff } from '@/modules/institution-workbench/components/InstitutionWorkbenchCapabilityOff';
import type { WorkbenchCapabilityProjection } from '@/modules/institution-workbench/domain/workbench-capability-view-models';

function projected(
  items: readonly Readonly<{
    key:
      | 'action_customer_create'
      | 'action_care_appointment_create'
      | 'action_care_followup_create';
    label: string;
    href: string;
  }>[],
): WorkbenchCapabilityProjection {
  return {
    status: 'projected',
    sourceReadiness: 'ready',
    summaries: [],
    quickCreateMenu: {
      label: '新建',
      items,
    },
  } as unknown as WorkbenchCapabilityProjection;
}

const customerCreate = Object.freeze({
  key: 'action_customer_create' as const,
  label: '新建客户',
  href: '/hospital/customers?create=1',
});

const appointmentCreate = Object.freeze({
  key: 'action_care_appointment_create' as const,
  label: '新建预约',
  href: '/hospital/care/appointments?create=1',
});

const followUpCreate = Object.freeze({
  key: 'action_care_followup_create' as const,
  label: '新建随访',
  href: '/hospital/care/followups?create=1',
});

describe('InstitutionWorkbenchCapabilityOff controlled quick-create gate', () => {
  it('accepts the governed customer + appointment + follow-up menu', () => {
    const { container } = render(
      <InstitutionWorkbenchCapabilityOff
        genuineAllowed
        capabilityProjection={projected([
          customerCreate,
          appointmentCreate,
          followUpCreate,
        ])}
      />,
    );

    expect(
      container.querySelector(
        '[data-capability-state="controlled-write-pilot"]',
      ),
    ).not.toBeNull();

    expect(
      screen.getByRole('link', { name: '新建客户' }),
    ).toHaveAttribute(
      'href',
      '/hospital/customers?create=1',
    );

    expect(
      screen.getByRole('link', { name: '新建预约' }),
    ).toHaveAttribute(
      'href',
      '/hospital/care/appointments?create=1',
    );

    expect(
      screen.getByRole('link', { name: '新建随访' }),
    ).toHaveAttribute(
      'href',
      '/hospital/care/followups?create=1',
    );

    expect(
      screen.queryByText('工作台访问已核验'),
    ).not.toBeInTheDocument();
  });

  it('accepts authorization-filtered governed subsets in canonical order', () => {
    render(
      <InstitutionWorkbenchCapabilityOff
        genuineAllowed
        capabilityProjection={projected([
          appointmentCreate,
          followUpCreate,
        ])}
      />,
    );

    expect(
      screen.getByRole('link', { name: '新建预约' }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: '新建随访' }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('link', { name: '新建客户' }),
    ).not.toBeInTheDocument();
  });

  it('keeps fail-closed for reordered or forged quick-create targets', () => {
    const reordered = projected([
      appointmentCreate,
      customerCreate,
    ]);

    const first = render(
      <InstitutionWorkbenchCapabilityOff
        genuineAllowed
        capabilityProjection={reordered}
      />,
    );

    expect(
      screen.getByText('工作台访问已核验'),
    ).toBeInTheDocument();

    expect(
      first.container.querySelector(
        '[data-capability-state="controlled-write-pilot"]',
      ),
    ).toBeNull();

    first.unmount();

    render(
      <InstitutionWorkbenchCapabilityOff
        genuineAllowed
        capabilityProjection={projected([
          {
            ...customerCreate,
            href: '/hospital/customers?create=forged',
          },
        ])}
      />,
    );

    expect(
      screen.getByText('工作台访问已核验'),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('link', { name: '新建客户' }),
    ).not.toBeInTheDocument();
  });
});
