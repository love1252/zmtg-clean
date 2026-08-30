import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  INSTITUTION_V11_APPROVED_HOSPITAL_RUNTIME_PATH,
  INSTITUTION_V11_APPROVED_LOGOUT_MESSAGE,
  InstitutionV11ApprovedPrototypeFrame,
} from '@/modules/institution-v11-preview/components/InstitutionV11ApprovedPrototypeFrame';

const { replaceMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

describe('InstitutionV11ApprovedPrototypeFrame', () => {
  beforeEach(() => {
    replaceMock.mockClear();
  });

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

  it('仅接受当前 Approved iframe 的同源退出完成消息并导航到登录页', () => {
    render(<InstitutionV11ApprovedPrototypeFrame />);

    const frame = screen.getByTitle(
      '机构端 V1.1 Approved 完整界面',
    ) as HTMLIFrameElement;

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: INSTITUTION_V11_APPROVED_LOGOUT_MESSAGE },
        origin: 'https://untrusted.example',
        source: frame.contentWindow,
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: INSTITUTION_V11_APPROVED_LOGOUT_MESSAGE },
        origin: window.location.origin,
        source: window,
      }),
    );

    expect(replaceMock).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: INSTITUTION_V11_APPROVED_LOGOUT_MESSAGE },
        origin: window.location.origin,
        source: frame.contentWindow,
      }),
    );

    expect(replaceMock).toHaveBeenCalledOnce();
    expect(replaceMock).toHaveBeenCalledWith('/login');
  });
});
