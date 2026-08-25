import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  INSTITUTION_V11_APPROVED_HOSPITAL_RUNTIME_PATH,
  InstitutionV11ApprovedPrototypeFrame,
} from '@/modules/institution-v11-preview/components/InstitutionV11ApprovedPrototypeFrame';

describe('InstitutionV11ApprovedPrototypeFrame', () => {
  it('在正式 /hospital 视口内装载受保护的 Approved 运行时', () => {
    render(<InstitutionV11ApprovedPrototypeFrame />);

    expect(
      screen.getByRole('main', { name: '机构端 V1.1 Approved 工作区' }),
    ).toHaveAttribute('data-institution-v11-approved-runtime', 'true');

    const frame = screen.getByTitle('机构端 V1.1 Approved 完整界面');
    expect(frame).toHaveAttribute(
      'src',
      INSTITUTION_V11_APPROVED_HOSPITAL_RUNTIME_PATH,
    );
    expect(frame).toHaveAttribute('sandbox', 'allow-same-origin allow-scripts');
  });
});
