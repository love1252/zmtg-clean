'use client';

import { LogOut } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

type LogoutButtonProps = {
  redirectTo: string;
  className?: string;
  children?: string;
};

export function LogoutButton({ redirectTo, className, children = '退出登录' }: LogoutButtonProps) {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = redirectTo;
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={cn('inline-flex items-center justify-center gap-2', className)}
    >
      <LogOut className="h-4 w-4" />
      {children}
    </button>
  );
}
