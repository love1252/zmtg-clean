'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type DemoSessionRole = 'tenant_admin' | 'platform_admin';

type DemoSessionGateProps = {
  allowedRole: DemoSessionRole;
  loginHref: string;
  wrongRoleHref: string;
  children: ReactNode;
};

type SessionPayload = {
  authenticated?: boolean;
  user?: {
    role?: string;
  } | null;
};

export function DemoSessionGate({ allowedRole, loginHref, wrongRoleHref, children }: DemoSessionGateProps) {
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        if (!response.ok) {
          window.location.href = loginHref;
          return;
        }

        const payload = (await response.json()) as SessionPayload;
        if (!payload.authenticated || !payload.user?.role) {
          window.location.href = loginHref;
          return;
        }

        if (payload.user.role !== allowedRole) {
          window.location.href = wrongRoleHref;
          return;
        }

        if (!cancelled) setAuthorized(true);
      } catch {
        window.location.href = loginHref;
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [allowedRole, loginHref, wrongRoleHref]);

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
          正在检查登录状态...
        </div>
      </main>
    );
  }

  return children;
}
