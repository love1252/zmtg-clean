'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, UserCog } from 'lucide-react';
import { LuxuryLoginShell } from '@/modules/auth/components/LuxuryLoginShell';

const metrics = [
  { value: '156', label: '入驻机构', detail: '租户、套餐与权限统一管理' },
  { value: '99.9%', label: '服务可用', detail: '平台级运行状态持续可观测' },
  { value: '24/7', label: '风险监控', detail: '关键接口、模型与连接器状态可追踪' },
];

const insights = [
  { title: '权限边界清晰', description: '平台运营、机构后台与租户数据保持隔离，降低误操作风险。' },
  { title: '平台运营中枢', description: '集中管理机构、套餐、模型、连接器与平台级数据资产。' },
];

export default function PlatformLoginPage() {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        headers: {
          'Content-Type': 'application/json',
        },
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
      eyebrow="平台安全入口"
      title="平台运营中枢"
      accentTitle="安全进入"
      description="为智美天工运营团队保留的管理入口，聚焦租户治理、服务状态、模型配置与平台级风控。"
      metrics={metrics}
      insights={insights}
      alternateHref="/login"
      alternateLabel="机构工作台入口"
    >
      <div className="rounded-[30px] border border-white/80 bg-white/80 p-5 shadow-[0_30px_80px_rgba(23,44,56,0.18)] backdrop-blur-2xl sm:p-7">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#0d6a76]">平台管理入口</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-normal text-slate-950">
              平台管理员登录
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">仅供智美天工平台运营团队使用。</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </div>

        <div className="mb-6 rounded-[22px] border border-[#dce8e8] bg-[#f5fbfa]/85 p-4 text-sm leading-6 text-slate-600">
          <span className="font-semibold text-slate-900">演示账号：</span>platform
          <span className="mx-2 text-slate-300">/</span>
          <span className="font-semibold text-slate-900">密码：</span>admin123
        </div>

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
            {loading ? '登录中...' : '进入平台后台'}
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
