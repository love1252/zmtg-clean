import {
  readFileSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';

import {
  render,
  screen,
} from '@testing-library/react';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { CareFollowUpControlledShell } from '@/modules/care/components/CareFollowUpControlledShell';

describe('Hospital Care follow-ups controlled page', () => {
  it('renders authoritative empty without fake tasks or external actions', () => {
    render(
      <CareFollowUpControlledShell
        records={[]}
        canCreate={false}
      />,
    );

    expect(
      screen.getByRole(
        'heading',
        { name: '人工随访任务' },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '当前正式机构范围内暂无人工随访任务。',
      ),
    ).toBeInTheDocument();
  });

  it('canonical page is fixed to Care + page_care_followups operational authority', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/app/hospital/care/followups/page.tsx',
      ),
      'utf8',
    );

    expect(source).toContain(
      "const TARGET_SECTION_ID = 'care' as const;",
    );
    expect(source).toContain(
      "'page_care_followups' as const;",
    );
    expect(source).toContain(
      "capability?.decision !== 'operational'",
    );
    expect(source).toContain(
      "capability.safeSummary\n      !== '随访任务可用'",
    );
  });
});
