'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, UserCog, UserRound } from 'lucide-react';

import { LuxuryLoginShell } from '@/modules/auth/components/LuxuryLoginShell';
import type { HomepageBrandConfig } from '@/modules/marketing/domain/homepageBrandConfig';

const isDevelopmentLoginEntryEnabled =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ZMTG_ENABLE_DEMO_AUTH === 'true';

export function InstitutionLoginClient({ config }: { config: HomepageBrandConfig }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loginConfig = config.login.institution;

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, scope: 'institution' }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || result?.code !== 0) {
        setError(result?.message || '用户名或密码错误');
        return;
      }

      const tenantId = result?.data?.user?.tenantId;
      if (tenantId && typeof window !== 'undefined') window.localStorage.setItem('zmtg_tenant_id', String(tenantId));

      window.location.href = '/hospital';
    } catch (loginError) {
      console.error('[Auth] Institution login failed:', loginError);
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = () => {
    setUsername('admin');
    setPassword('admin123');
  };

  return (
    <LuxuryLoginShell
      variant="institution"
      eyebrow={loginConfig.eyebrow}
      title={loginConfig.title}
      accentTitle={loginConfig.accentTitle}
      description={loginConfig.description}
      metrics={loginConfig.metrics}
      insights={loginConfig.insights}
      alternateHref={loginConfig.alternateHref}
      alternateLabel={loginConfig.alternateLabel}
      logoUrl={config.assets.horizontalLogoUrl}
      logoAlt={config.brand.platformName}
      backgroundImageUrl={config.assets.heroBackgroundUrl}
    >
      <div className="rounded-[30px] border border-white/80 bg-white/78 p-5 shadow-[0_30px_80px_rgba(23,44,56,0.16)] backdrop-blur-2xl sm:p-7">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#0d6a76]">{loginConfig.formEyebrow}</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-normal text-slate-950">
              {loginConfig.formTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{loginConfig.formDescription}</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0d6a76] text-white shadow-lg shadow-[#0d6a76]/20">
            <UserRound className="h-6 w-6" />
          </div>
        </div>

        {isDevelopmentLoginEntryEnabled ? (
          <div className="mb-6 rounded-[22px] border border-[#dce8e8] bg-[#f5fbfa]/85 p-4 text-sm leading-6 text-slate-600">
            <span className="font-semibold text-slate-900">开发环境入口</span>
            <span className="mx-2 text-slate-300">/</span>
            仅用于本地和测试服务器调试，不创建真实用户，也不代表真实租户。
          </div>
        ) : null}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-sm font-semibold text-slate-700">
              用户名 / 手机号
            </label>
            <div className="relative mt-2">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="请输入用户名或手机号"
                className="h-12 w-full rounded-2xl border border-[#d6e1e1] bg-white/80 px-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0d6a76] focus:ring-[3px] focus:ring-[#0d6a76]/12"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                密码
              </label>
              <button type="button" className="text-xs font-semibold text-[#0d6a76] transition hover:text-[#084852]">
                忘记密码？
              </button>
            </div>
            <div className="relative mt-2">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
                className="h-12 w-full rounded-2xl border border-[#d6e1e1] bg-white/80 px-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0d6a76] focus:ring-[3px] focus:ring-[#0d6a76]/12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0d6a76] font-semibold text-white shadow-lg shadow-[#0d6a76]/20 transition hover:bg-[#084f59] hover:shadow-xl hover:shadow-[#0d6a76]/25 disabled:opacity-55"
          >
            {loading ? '登录中...' : loginConfig.submitLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {isDevelopmentLoginEntryEnabled ? (
          <button
            type="button"
            onClick={fillDemoAccount}
            className="mt-4 h-12 w-full rounded-2xl border border-[#d6e1e1] bg-white/65 text-sm font-semibold text-slate-700 transition hover:border-[#9fb8bb] hover:bg-white"
          >
            填入开发账号
          </button>
        ) : null}

        <p className="mt-6 text-center text-sm leading-6 text-slate-500">
          还没有机构账号？
          <Link href="/#pricing" className="font-semibold text-[#0d6a76] transition hover:text-[#084f59]">
            联系销售
          </Link>
        </p>
      </div>
    </LuxuryLoginShell>
  );
}

export function PlatformLoginClient({ config }: { config: HomepageBrandConfig }) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const loginConfig = config.login.platform;

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!account || !password) {
      setError('请输入平台管理员账号和密码');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: account, password, scope: 'platform' }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || result?.code !== 0) {
        setError(result?.message || '平台管理员账号或密码错误');
        return;
      }

      window.location.href = '/open-platform';
    } catch (loginError) {
      console.error('[认证] 平台登录失败:', loginError);
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LuxuryLoginShell
      variant="platform"
      eyebrow={loginConfig.eyebrow}
      title={loginConfig.title}
      accentTitle={loginConfig.accentTitle}
      description={loginConfig.description}
      metrics={loginConfig.metrics}
      insights={loginConfig.insights}
      alternateHref={loginConfig.alternateHref}
      alternateLabel={loginConfig.alternateLabel}
      logoUrl={config.assets.horizontalLogoUrl}
      logoAlt={config.brand.platformName}
      backgroundImageUrl={config.assets.heroBackgroundUrl}
    >
      <div className="rounded-[30px] border border-white/80 bg-white/80 p-5 shadow-[0_30px_80px_rgba(23,44,56,0.18)] backdrop-blur-2xl sm:p-7">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#0d6a76]">{loginConfig.formEyebrow}</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-normal text-slate-950">
              {loginConfig.formTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{loginConfig.formDescription}</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </div>

        {isDevelopmentLoginEntryEnabled ? (
          <div className="mb-6 rounded-[22px] border border-[#dce8e8] bg-[#f5fbfa]/85 p-4 text-sm leading-6 text-slate-600">
            <span className="font-semibold text-slate-900">开发环境入口</span>
            <span className="mx-2 text-slate-300">/</span>
            仅用于本地和测试服务器调试，不创建真实平台管理员，也不代表生产认证。
          </div>
        ) : null}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="platform-account" className="block text-sm font-semibold text-slate-700">
              管理员账号
            </label>
            <div className="relative mt-2">
              <UserCog className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="platform-account"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#d6e1e1] bg-white/80 px-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0d6a76] focus:ring-[3px] focus:ring-[#0d6a76]/12"
                placeholder="请输入平台管理员账号"
              />
            </div>
          </div>

          <div>
            <label htmlFor="platform-password" className="block text-sm font-semibold text-slate-700">
              密码
            </label>
            <div className="relative mt-2">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="platform-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#d6e1e1] bg-white/80 px-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0d6a76] focus:ring-[3px] focus:ring-[#0d6a76]/12"
                placeholder="请输入密码"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:bg-[#0d6a76] hover:shadow-xl hover:shadow-[#0d6a76]/25 disabled:opacity-55"
          >
            {loading ? '登录中...' : loginConfig.submitLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-6 rounded-[22px] border border-slate-200 bg-white/55 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <LockKeyhole className="h-4 w-4 text-[#0d6a76]" />
            平台入口已与机构入口隔离
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            登录将携带平台权限范围，不会进入机构租户工作台。
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm font-semibold text-[#0d6a76] transition hover:text-[#084f59]">
            前往机构登录
          </Link>
        </div>
      </div>
    </LuxuryLoginShell>
  );
}
