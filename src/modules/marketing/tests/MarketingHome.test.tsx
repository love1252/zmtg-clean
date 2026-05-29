import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarketingHome } from '@/modules/marketing/components/MarketingHome';

describe('MarketingHome', () => {
  it('renders the ZMTG brand promise and primary actions', () => {
    render(<MarketingHome />);

    expect(screen.getByAltText('智美天工')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '让医美经营拥有智能体驱动' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '立即试用' })[0]).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: '平台登录' })).toHaveAttribute('href', '/platform-login');
  });
});
