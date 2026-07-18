import Link from 'next/link';
import {
  INSTITUTION_NAVIGATION_SECTIONS_V1,
  type InstitutionNavigationSectionV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import { INSTITUTION_CANONICAL_ROUTES_V1 } from '@/modules/institution-contracts/v1/institution-routes';
import { InstitutionPageState } from '@/modules/institution/components/InstitutionPageState';

const sectionById = new Map(
  INSTITUTION_NAVIGATION_SECTIONS_V1.map((section) => [section.id, section] as const),
);
const safeRouteParameterPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const capabilityOffRoutes = INSTITUTION_CANONICAL_ROUTES_V1.flatMap((route) => {
  if (route.sectionId === 'workbench') return [];

  const section = sectionById.get(route.sectionId);
  if (!section) return [];

  return [
    {
      section,
      segments: route.pathnamePattern.split('/').filter(Boolean).slice(1),
    },
  ];
});

export function resolveInstitutionRouteSectionV1(
  slug: readonly string[],
): InstitutionNavigationSectionV1 | null {
  const route = capabilityOffRoutes.find((candidate) => {
    if (candidate.segments.length !== slug.length) return false;

    return candidate.segments.every((expectedSegment, index) => {
      const actualSegment = slug[index];
      if (!actualSegment) return false;

      return expectedSegment.startsWith(':')
        ? safeRouteParameterPattern.test(actualSegment)
        : expectedSegment === actualSegment;
    });
  });

  return route?.section ?? null;
}

export function InstitutionCapabilityOffPage({
  section,
}: {
  section: InstitutionNavigationSectionV1;
}) {
  const title = `${section.label}尚未开放`;

  return (
    <div
      data-capability-state="blocked"
      className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center"
    >
      <h1 className="sr-only">{title}</h1>
      <InstitutionPageState
        kind="placeholder"
        title="生产放行尚未完成"
        description="当前机构尚未获得该能力的生产放行。能力开放后仍会由服务端重新校验机构、角色和数据范围。"
        className="w-full border-white/90 bg-white/86 px-6 py-12 shadow-xl shadow-slate-200/60"
        action={
          <Link
            href="/hospital"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            返回工作台
          </Link>
        }
      />
    </div>
  );
}
