'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, KeyRound, UserRound } from 'lucide-react';
import { LuxuryLoginShell } from '@/modules/auth/components/LuxuryLoginShell';

const metrics = [
  { value: '37%', label: '咨询转化提升', detail: '线索意向、回访节奏与成交机会集中呈现' },
  { value: '2.4h', label: '响应时间缩短', detail: 'AI 自动整理客户上下文，减少重复确认' },
  { value: '89%', label: '重点客户覆盖', detail: '高价值客户跟进、复诊与复购提醒不断档' },
];

const insights = [
  { title: 'AI 下一步建议', description: '进入工作台后优先看到今日高意向客户、待跟进事项与推荐动作。' },
  { title: '让咨询团队', description: '从对话、标签、预约到复购旅程形成同一条业务视线。' },
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
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
      eyebrow="机构增长工作台"
      title="让咨询团队"
      accentTitle="先看到增长机会"
      description="把客户画像、咨询对话、预约进度与 AI 建议放在同一个入口里，登录后即可进入机构经营视角。"
      metrics={metrics}
      insights={insights}
      alternateHref="/platform-login"
      alternateLabel="平台管理员入口"
    >
      <div className="rounded-[30px] border border-white/80 bg-white/78 p-5 shadow-[0_30px_80px_rgba(23,44,56,0.16)] backdrop-blur-2xl sm:p-7">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#0d6a76]">Institution Access</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-normal text-slate-950">
              机构工作台登录
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">请使用机构运营账号进入医美增长中枢。</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0d6a76] text-white shadow-lg shadow-[#0d6a76]/20">
            <UserRound className="h-6 w-6" />
          </div>
        </div>

        <div className="mb-6 rounded-[22px] border border-[#dce8e8] bg-[#f5fbfa]/85 p-4 text-sm leading-6 text-slate-600">
          <span className="font-semibold text-slate-900">演示账号：</span>admin
          <span className="mx-2 text-slate-300">/</span>
          <span className="font-semibold text-slate-900">密码：</span>admin123
        </div>

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
            {loading ? '登录中...' : '登录机构工作台'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <button
          type="button"
          onClick={fillDemoAccount}
          className="mt-4 h-12 w-full rounded-2xl border border-[#d6e1e1] bg-white/65 text-sm font-semibold text-slate-700 transition hover:border-[#9fb8bb] hover:bg-white"
        >
          填入 Demo 账号
        </button>

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
