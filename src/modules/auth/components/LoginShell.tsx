import Link from 'next/link';
import Image from 'next/image';
import { Home, KeyRound, UserRound } from 'lucide-react';
import { brandAssets } from '@/modules/branding/brand-assets';
import { Button } from '@/shared/ui/button';

type LoginShellProps = {
  variant: 'institution' | 'platform';
};

const copy = {
  institution: {
    eyebrow: '机构增长工作台',
    title: '机构工作台登录',
    description: '登录后进入客户、预约、治疗、随访和客服协同工作区。',
    alternateHref: '/platform-login',
    alternateLabel: '平台入口',
  },
  platform: {
    eyebrow: '智美天工平台端',
    title: '平台管理后台登录',
    description: '用于租户、套餐、用量、审计、品牌和连接器管理。',
    alternateHref: '/login',
    alternateLabel: '机构入口',
  },
} as const;

export function LoginShell({ variant }: LoginShellProps) {
  const current = copy[variant];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f2eb] text-slate-950">
      <Image
        src={brandAssets.homepageBackground}
        alt=""
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 object-cover opacity-72"
      />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(248,246,240,0.97)_0%,rgba(248,246,240,0.9)_48%,rgba(237,246,248,0.72)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1440px] flex-col px-6 py-6 md:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="返回智美天工首页">
            <Image
              src={brandAssets.logoHorizontalLuxury}
              alt="智美天工"
              width={960}
              height={306}
              priority
              className="h-14 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="secondary">
              <Link href={current.alternateHref}>{current.alternateLabel}</Link>
            </Button>
            <Button asChild variant="ghost" className="h-11 w-11 px-0">
              <Link href="/" aria-label="返回首页">
                <Home className="h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.72fr)]">
          <div>
            <p className="inline-flex rounded-full border border-[#bdd3d4] bg-white/64 px-4 py-2 text-sm font-semibold text-[#0d5d68]">
              {current.eyebrow}
            </p>
            <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[1.08] tracking-normal md:text-7xl">
              让团队先看到
              <span className="block text-[#0d6a76]">下一步增长动作</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-9 text-slate-600">
              {current.description}
            </p>
          </div>

          <aside className="rounded-[30px] border border-white/80 bg-white/78 p-7 shadow-[0_30px_80px_rgba(23,44,56,0.16)] backdrop-blur-2xl">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#0d6a76]">Secure Access</p>
                <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-normal text-slate-950">
                  {current.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">请输入账号和密码。</p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0d6a76] text-white shadow-lg shadow-[#0d6a76]/20">
                <UserRound className="h-6 w-6" />
              </div>
            </div>

            <form className="space-y-5">
              <div>
                <label htmlFor={`${variant}-username`} className="block text-sm font-semibold text-slate-700">
                  用户名 / 手机号
                </label>
                <div className="relative mt-2">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id={`${variant}-username`}
                    type="text"
                    className="h-12 w-full rounded-2xl border border-[#d6e1e1] bg-white/80 px-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0d6a76] focus:ring-[3px] focus:ring-[#0d6a76]/12"
                  />
                </div>
              </div>

              <div>
                <label htmlFor={`${variant}-password`} className="block text-sm font-semibold text-slate-700">
                  密码
                </label>
                <div className="relative mt-2">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id={`${variant}-password`}
                    type="password"
                    className="h-12 w-full rounded-2xl border border-[#d6e1e1] bg-white/80 px-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0d6a76] focus:ring-[3px] focus:ring-[#0d6a76]/12"
                  />
                </div>
              </div>

              <Button className="h-12 w-full" type="button">
                登录
              </Button>
            </form>
          </aside>
        </section>
      </div>
    </main>
  );
}
