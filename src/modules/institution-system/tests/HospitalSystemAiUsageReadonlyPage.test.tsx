import {
  readFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

import {
  render,
  screen,
} from '@testing-library/react';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const requestOwners =
  vi.hoisted(() => new WeakSet<object>());
const navigationOwners =
  vi.hoisted(() => new WeakSet<object>());

const mocks = vi.hoisted(() => ({
  authorizeNavigation: vi.fn(),
  readAiUsage: vi.fn(),
  resolveCapability: vi.fn(),
  resolveServerAuthorization: vi.fn(),
}));

vi.mock(
  '@/modules/institution/server/institution-server-runtime',
  () => ({
    resolveInstitutionServerAuthorizationV1:
      mocks.resolveServerAuthorization,
  }),
);

vi.mock(
  '@/modules/security/server/institution-request-authorization',
  () => ({
    isInstitutionRequestAuthorizationV1(
      value: unknown,
    ) {
      return (
        value !== null
        && typeof value === 'object'
        && requestOwners.has(value)
      );
    },
  }),
);

vi.mock(
  '@/modules/security/server/institution-section-guard',
  () => ({
    isInstitutionNavigationAuthorizationV1(
      value: unknown,
    ) {
      return (
        value !== null
        && typeof value === 'object'
        && navigationOwners.has(value)
      );
    },
  }),
);

vi.mock(
  '@/server/orchestration/institution-capability-authority',
  () => ({
    resolveInstitutionCapabilityAuthorityStatusV1:
      mocks.resolveCapability,
  }),
);

vi.mock(
  '@/server/orchestration/institution-ai-usage-metrics-reader',
  () => ({
    readCurrentInstitutionAiUsageMetricsV1:
      mocks.readAiUsage,
  }),
);

vi.mock(
  '@/modules/institution/components/InstitutionNavigationShell',
  () => ({
    InstitutionNavigationShell: ({
      children,
    }: {
      children: React.ReactNode;
    }) => (
      <div data-testid="institution-navigation-shell">
        {children}
      </div>
    ),
  }),
);

import HospitalSystemAiUsagePage, {
  dynamic,
} from '@/app/hospital/system/ai-usage/page';

const allSections = Object.freeze([
  'workbench',
  'customers',
  'conversations',
  'care',
  'knowledge',
  'analytics',
  'system',
] as const);

const requestAuthorization =
  Object.freeze({
    authorizeCurrentInstitutionNavigationV1:
      mocks.authorizeNavigation,
  });

const emptyReady = Object.freeze({
  kind: 'ready' as const,
  preset: 'currentMonth' as const,
  metrics: Object.freeze({
    totalCallCount: 0,
    serviceUnits: null,
    failureCount: 0,
    rejectionCount: 0,
    incompleteCount: 0,
    successRate: Object.freeze({
      numerator: 0,
      denominator: 0,
      value: null,
    }),
    byServiceKey: Object.freeze([]),
  }),
});

function navigation(
  targetAccess: 'allowed' | 'blocked',
) {
  const value = Object.freeze({
    kind:
      'institution_navigation_authorization',
    targetSectionId: 'system',
    targetAccess,
    availableSectionIds: allSections,
  });

  navigationOwners.add(value);
  return value;
}

function capability(
  decision: 'read_only' | 'hidden'
    = 'read_only',
) {
  return Object.freeze({
    contractVersion: 'v1',
    readiness: 'ready',
    failureCode: null,
    partitions: Object.freeze([
      Object.freeze({
        key: 'page_system_ai_usage',
        readiness: 'ready',
        failureCode: null,
      }),
    ]),
    data: Object.freeze({
      capabilities: Object.freeze([
        Object.freeze({
          key: 'page_system_ai_usage',
          decision,
          dimensions: Object.freeze({
            codeMaturity: 'verified',
            institutionAuthorization:
              'authorized',
            connectionAvailability:
              'not_required',
            dataReadiness: 'ready',
            productionRelease:
              decision === 'read_only'
                ? 'pilot_released'
                : 'not_released',
          }),
          safeSummary:
            decision === 'read_only'
              ? 'AI 使用统计仅供查看'
              : null,
        }),
      ]),
    }),
  });
}

beforeEach(() => {
  Object.values(mocks).forEach(
    (mock) => mock.mockReset(),
  );

  requestOwners.add(requestAuthorization);

  mocks.resolveServerAuthorization
    .mockResolvedValue(
      requestAuthorization,
    );
  mocks.authorizeNavigation
    .mockResolvedValue(
      navigation('allowed'),
    );
  mocks.resolveCapability
    .mockResolvedValue(
      capability(),
    );
  mocks.readAiUsage
    .mockResolvedValue(
      emptyReady,
    );
});

describe('/hospital/system/ai-usage readonly release page', () => {
  it('canonical page force-dynamic，并正确呈现可信空状态', async () => {
    expect(dynamic).toBe('force-dynamic');

    render(
      await HospitalSystemAiUsagePage({
        searchParams: Promise.resolve({
          preset: 'currentMonth',
        }),
      }),
    );

    expect(
      screen.getByRole('heading', {
        name: 'AI 使用概览',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        '暂无正式 AI 使用记录',
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        '当前所选时间范围内没有可用的正式 AI 使用记录。',
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByText(
        '暂无可靠用量单位',
      ),
    ).not.toBeInTheDocument();

    expect(
      mocks.authorizeNavigation,
    ).toHaveBeenCalledWith({
      targetSectionId: 'system',
    });

    expect(
      mocks.resolveCapability
        .mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.readAiUsage
        .mock.invocationCallOrder[0]!,
    );
  });

  it('非空低敏结果只显示正式业务指标', async () => {
    mocks.readAiUsage.mockResolvedValueOnce(
      Object.freeze({
        kind: 'ready',
        preset: 'today',
        metrics: Object.freeze({
          totalCallCount: 3,
          serviceUnits: null,
          failureCount: 1,
          rejectionCount: 0,
          incompleteCount: 0,
          successRate: Object.freeze({
            numerator: 2,
            denominator: 3,
            value: 2 / 3,
          }),
          byServiceKey: Object.freeze([
            Object.freeze({
              serviceKey:
                'conversation_ai',
              totalCallCount: 3,
              serviceUnits: null,
              failureCount: 1,
              rejectionCount: 0,
              incompleteCount: 0,
              successRate:
                Object.freeze({
                  numerator: 2,
                  denominator: 3,
                  value: 2 / 3,
                }),
            }),
          ]),
        }),
      }),
    );

    render(
      await HospitalSystemAiUsagePage({
        searchParams: Promise.resolve({
          preset: 'today',
        }),
      }),
    );

    expect(
      screen.getAllByText(
        '暂无可靠用量单位',
      ).length,
    ).toBeGreaterThan(0);

    expect(
      screen.getByText('会话 AI'),
    ).toBeInTheDocument();
  });

  it('navigation forbidden 不读取 capability 或业务数据', async () => {
    mocks.authorizeNavigation
      .mockResolvedValueOnce(
        navigation('blocked'),
      );

    render(
      await HospitalSystemAiUsagePage({}),
    );

    expect(
      screen.getByText(
        '当前账号不可访问 AI 使用概览',
      ),
    ).toBeInTheDocument();

    expect(
      mocks.resolveCapability,
    ).not.toHaveBeenCalled();

    expect(
      mocks.readAiUsage,
    ).not.toHaveBeenCalled();
  });

  it('capability hidden 不调用正式 AI usage Reader', async () => {
    mocks.resolveCapability
      .mockResolvedValueOnce(
        capability('hidden'),
      );

    render(
      await HospitalSystemAiUsagePage({}),
    );

    expect(
      screen.getByText(
        'AI 与额度尚未开放',
      ),
    ).toBeInTheDocument();

    expect(
      mocks.readAiUsage,
    ).not.toHaveBeenCalled();
  });

  it('duplicate capability fail-closed', async () => {
    const single = capability();

    mocks.resolveCapability
      .mockResolvedValueOnce(
        Object.freeze({
          ...single,
          data: Object.freeze({
            capabilities: Object.freeze([
              ...single.data.capabilities,
              ...single.data.capabilities,
            ]),
          }),
        }),
      );

    render(
      await HospitalSystemAiUsagePage({}),
    );

    expect(
      screen.getByText(
        'AI 与额度尚未开放',
      ),
    ).toBeInTheDocument();

    expect(
      mocks.readAiUsage,
    ).not.toHaveBeenCalled();
  });

  it.each([
    [
      {
        kind: 'forbidden',
      },
      '当前账号不可访问 AI 使用概览',
    ],
    [
      {
        kind: 'unavailable',
      },
      'AI 使用概览暂时不可用',
    ],
    [
      {
        kind: 'invalid_query',
        code: 'invalid_ai_usage_query',
      },
      'AI 使用查询条件无效',
    ],
  ] as const)(
    'Reader %o 显示安全状态',
    async (result, title) => {
      mocks.readAiUsage
        .mockResolvedValueOnce(result);

      render(
        await HospitalSystemAiUsagePage({}),
      );

      expect(
        screen.getByText(title),
      ).toBeInTheDocument();
    },
  );

  it('页面把 duplicate/unknown query 原样交给 formal Reader 校验', async () => {
    render(
      await HospitalSystemAiUsagePage({
        searchParams: Promise.resolve({
          preset: [
            'today',
            'last7days',
          ],
          unknown: 'value',
        }),
      }),
    );

    const params =
      mocks.readAiUsage
        .mock.calls[0]?.[0] as URLSearchParams;

    expect(
      params.getAll('preset'),
    ).toEqual([
      'today',
      'last7days',
    ]);

    expect(
      params.get('unknown'),
    ).toBe('value');
  });

  it('production page/component 不引入 legacy usage shell、mutation 或高敏技术展示', () => {
    const page = readFileSync(
      resolve(
        process.cwd(),
        'src/app/hospital/system/ai-usage/page.tsx',
      ),
      'utf8',
    );

    const component = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-system/components/AiUsageReadonlyShell.tsx',
      ),
      'utf8',
    );

    const production =
      `${page}\n${component}`;

    expect(production).toContain(
      'readCurrentInstitutionAiUsageMetricsV1',
    );

    expect(production).not.toMatch(
      /institution-ai-service-usage-client|InstitutionAiServiceUsage|createUsageRecord|createAiCallUsageCommandRepository|\?create=1|provider|model|promptTokens|completionTokens|totalTokens|latencyMs|errorCode|meteringDetails|metadata|remainingCredits|billing|purchase/iu,
    );
  });
});
