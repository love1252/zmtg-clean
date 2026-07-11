import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  consentBlocksPreparedAttempt,
  createWeComReachOutOperationRef,
  createWeComReachOutFrequencyWindow,
  decideWeComReachOutConsentTransition,
  weComReachOutConsentConfirmations,
} from '@/modules/institution/domain/trusted-reachout-safety';

describe('可信企业微信触达安全领域', () => {
  it('Vitest alias 从当前 worktree 加载本任务模块且配置不含绝对用户路径', () => {
    const repositoryRoot = realpathSync(process.cwd());
    const config = readFileSync(resolve(repositoryRoot, 'vitest.config.ts'), 'utf8');
    expect(existsSync(resolve(repositoryRoot, 'src/modules/institution/domain/trusted-reachout-safety.ts'))).toBe(true);
    expect(config).toContain("fileURLToPath(new URL('./src', import.meta.url))");
    expect(config).not.toMatch(/\/Users\/|zmtg-clean-worktrees/u);
    expect(createWeComReachOutOperationRef('alias-proof')).toBe('wrop_alias-proof');
  });

  it.each([
    ['record_consent', 'customer_explicit_verbal', 'consented'],
    ['record_consent', 'customer_explicit_written', 'consented'],
    ['record_opt_out', 'customer_opt_out_request', 'opted_out'],
    ['revoke_consent', 'customer_consent_revocation', 'consent_revoked'],
  ] as const)('仅接受动作对应来源和精确确认：%s', (action, sourceType, status) => {
    expect(decideWeComReachOutConsentTransition({
      action,
      sourceType,
      confirmation: weComReachOutConsentConfirmations[action],
    })).toEqual({ kind: 'transition', transition: { status, sourceType } });
  });

  it('拒绝错配来源和近似确认，不允许直接清除 opt-out', () => {
    expect(decideWeComReachOutConsentTransition({
      action: 'record_consent',
      sourceType: 'customer_opt_out_request',
      confirmation: weComReachOutConsentConfirmations.record_consent,
    })).toEqual({ kind: 'invalid' });
    expect(decideWeComReachOutConsentTransition({
      action: 'record_opt_out',
      sourceType: 'customer_opt_out_request',
      confirmation: '确认退订',
    })).toEqual({ kind: 'invalid' });
  });

  it('opt-out 优先阻断，无记录和撤回也不能预留', () => {
    expect(consentBlocksPreparedAttempt('opted_out')).toBe('opted_out');
    expect(consentBlocksPreparedAttempt('unknown')).toBe('consent_required');
    expect(consentBlocksPreparedAttempt('consent_revoked')).toBe('consent_required');
    expect(consentBlocksPreparedAttempt('consented')).toBeNull();
  });

  it('频控窗口固定 24 小时', () => {
    const now = new Date('2026-07-11T00:00:00.000Z');
    expect(createWeComReachOutFrequencyWindow(now)).toEqual({
      windowStartedAt: now,
      windowEndsAt: new Date('2026-07-12T00:00:00.000Z'),
    });
  });

  it('operationRef 只由低敏系统 operation ID 派生', () => {
    expect(createWeComReachOutOperationRef('delivery_01-safe')).toBe('wrop_delivery_01-safe');
    expect(createWeComReachOutOperationRef('customer@example.com')).toBeNull();
    expect(createWeComReachOutOperationRef('包含自由文本')).toBeNull();
  });
});
