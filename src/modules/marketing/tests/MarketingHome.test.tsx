import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarketingHome } from '@/modules/marketing/components/MarketingHome';

describe('MarketingHome', () => {
  it('renders the ZMTG brand promise and primary actions', () => {
    render(<MarketingHome />);

    expect(document.querySelector('[aria-label="智美天工 ZHIMEI TIANGONG"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /让医美经营\s*更懂每位客户/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '预约演示' })).toHaveAttribute('href', '/login');
    screen.getAllByRole('link', { name: '预约增长诊断 →' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/login');
    });
    expect(screen.getByRole('link', { name: '查看客户旅程' })).toHaveAttribute('href', '#journey');
  });
});
