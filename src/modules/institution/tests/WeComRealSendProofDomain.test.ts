import { describe, expect, it } from 'vitest';

import {
  createWeComRealSendConfirmationToken,
  createWeComRealSendProofDigest,
  createWeComRealSendSourceBinding,
  evaluateProductionAttestation,
  evaluateRealSendProofControls,
  evaluateWeComRealSendProofPermission,
  transitionWeComRealSendProofStatus,
  WE_COM_REAL_SEND_PROOF_CONFIRMATION_TTL_MS,
  type WeComRealSendProofControl,
  type WeComRealSendProductionAttestation,
  type WeComRealSendReadySource,
} from '@/modules/institution/domain/wecom-real-send-proof';

const now = '2026-07-12T08:00:00.000Z';

function readySource(overrides: Partial<WeComRealSendReadySource> = {}): WeComRealSendReadySource {
  const source: WeComRealSendReadySource = {
    tenantId: 'tenant-a',
    institutionId: 'inst-a',
    customerId: 'customer-a',
    draftId: 'draft-a',
    deliveryId: 'delivery-a',
    approvedContent: '仅用于低敏 proof 的已批准内容',
    deliveryContentSnapshot: '仅用于低敏 proof 的已批准内容',
    operationRef: 'wrop_delivery-a',
    readyNoSendMetadata: {
      controlledReachOutId: 'ready-a',
      messageDraftId: 'draft-a',
      messageDeliveryId: 'delivery-a',
      customerId: 'customer-a',
      status: 'ready_no_send',
      realSendEnabled: false,
      noRealSend: true,
      noRealNetwork: true,
    },
    mapping: { id: 'mapping-a', version: 'v1', status: 'confirmed', customerId: 'customer-a' },
    consent: { id: 'consent-a', version: 1, status: 'consented', customerId: 'customer-a' },
    frequency: {
      id: 'frequency-a', version: 1, customerId: 'customer-a', lastPreparedRef: 'wrop_delivery-a',
      preparedCount: 1, completedCount: 0,
    },
    dryRunSnapshot: { id: 'snapshot-a', version: 1, status: 'dry_run_ready' },
    recipientBinding: {
      mappingId: 'mapping-a',
      mappingVersion: 'v1',
      proofContactRef: 'contact-proof-a',
      proofEmployeeRef: 'employee-proof-a',
    },
  };
  return { ...source, ...overrides };
}

function controls(overrides: Partial<WeComRealSendProofControl> = {}) {
  const base = {
    tenantId: null,
    institutionId: null,
    customerId: null,
    channelType: null,
    operatorId: null,
    role: null,
    proofEnabled: true,
    killSwitchEngaged: false,
    effectiveAt: '2026-07-12T07:00:00.000Z',
    expiresAt: '2026-07-12T09:00:00.000Z',
    approvalRef: 'approval-a',
    approvedBy: 'reviewer-a',
    updatedBy: 'reviewer-a',
    version: 1,
  } as const;
  return [
    { ...base, id: 'global', scopeKind: 'global' as const },
    { ...base, id: 'tenant', scopeKind: 'tenant' as const, tenantId: 'tenant-a' },
    { ...base, id: 'institution', scopeKind: 'institution' as const, tenantId: 'tenant-a', institutionId: 'inst-a' },
    { ...base, id: 'channel', scopeKind: 'channel' as const, channelType: 'wechat_work' as const },
    { ...base, id: 'customer', scopeKind: 'customer' as const, tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a' },
    { ...base, id: 'operator', scopeKind: 'operator_role' as const, tenantId: 'tenant-a', institutionId: 'inst-a', operatorId: 'admin-a', role: 'tenant_admin' as const },
  ].map((control) => ({ ...control, ...overrides })) as WeComRealSendProofControl[];
}

const scope = {
  tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a', operatorId: 'admin-a', role: 'tenant_admin' as const,
};

const attestation: WeComRealSendProductionAttestation = {
  id: 'attestation-a', environmentRef: 'prod-ref', databaseIdentityRef: 'db-ref',
  migrationTarget: '0036_v08_05b_a_single_real_send_proof_foundation', migrationHash: 'a'.repeat(64),
  journalLatest: '0036_v08_05b_a_single_real_send_proof_foundation', postcheckStatus: 'ready',
  approvalRef: 'approval-a', reviewedBy: 'reviewer-a', attestedBy: 'attestor-a',
  attestedAt: '2026-07-12T07:00:00.000Z', expiresAt: '2026-07-12T09:00:00.000Z', version: 1,
};

const expectedAttestation = {
  environmentRef: attestation.environmentRef,
  databaseIdentityRef: attestation.databaseIdentityRef,
  migrationTarget: attestation.migrationTarget,
  migrationHash: attestation.migrationHash,
  journalLatest: attestation.journalLatest,
};

describe('WeComRealSendProof domain', () => {
  it('生成 256-bit opaque token，仅持有不可逆 SHA-256 digest，TTL 固定四分钟', () => {
    const first = createWeComRealSendConfirmationToken();
    const second = createWeComRealSendConfirmationToken();

    expect(Buffer.from(first.token, 'base64url')).toHaveLength(32);
    expect(first.digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.digest).toBe(createWeComRealSendProofDigest(first.token));
    expect(first.digest).not.toContain(first.token);
    expect(second.token).not.toBe(first.token);
    expect(WE_COM_REAL_SEND_PROOF_CONFIRMATION_TTL_MS).toBe(4 * 60 * 1000);
  });

  it('fingerprint 绑定 contentHash、recipientBindingDigest 及所有 ready source 版本', () => {
    const original = createWeComRealSendSourceBinding(readySource());
    const contentChanged = createWeComRealSendSourceBinding(readySource({
      approvedContent: '另一份批准内容', deliveryContentSnapshot: '另一份批准内容',
    }));
    const recipientChanged = createWeComRealSendSourceBinding(readySource({
      mapping: { ...readySource().mapping, version: 2 },
      recipientBinding: {
        mappingId: 'mapping-a',
        mappingVersion: 2,
        proofContactRef: 'contact-proof-a',
        proofEmployeeRef: 'employee-proof-a',
      },
    }));

    expect(original).toMatchObject({
      sourceReadyNoSendRef: 'ready-a',
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      recipientBindingDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      readinessFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(contentChanged?.readinessFingerprint).not.toBe(original?.readinessFingerprint);
    expect(recipientChanged?.readinessFingerprint).not.toBe(original?.readinessFingerprint);
  });

  it('recipient binding 必须完整且与可信 mapping id/version 精确一致', () => {
    expect(createWeComRealSendSourceBinding(readySource({
      recipientBinding: { ...readySource().recipientBinding, mappingId: 'other-mapping' },
    }))).toBeNull();
    expect(createWeComRealSendSourceBinding(readySource({
      recipientBinding: { ...readySource().recipientBinding, mappingVersion: 'other-version' },
    }))).toBeNull();
    expect(createWeComRealSendSourceBinding(readySource({
      recipientBinding: { ...readySource().recipientBinding, proofEmployeeRef: '' },
    }))).toBeNull();
  });

  it('拒绝被篡改的 ready_no_send、频控或内容快照', () => {
    expect(createWeComRealSendSourceBinding(readySource({
      readyNoSendMetadata: { ...readySource().readyNoSendMetadata, realSendEnabled: true },
    }))).toBeNull();
    expect(createWeComRealSendSourceBinding(readySource({
      frequency: { ...readySource().frequency, lastPreparedRef: 'another-operation' },
    }))).toBeNull();
    expect(createWeComRealSendSourceBinding(readySource({
      deliveryContentSnapshot: '与批准内容不一致',
    }))).toBeNull();
  });

  it.each([
    ['requested', 'aborted', false, true],
    ['requested', 'attempted', true, true],
    ['attempted', 'succeeded', true, true],
    ['attempted', 'failed', true, true],
    ['attempted', 'unknown_outcome', true, true],
    ['attempted', 'succeeded', false, false],
    ['attempted', 'failed', false, false],
    ['attempted', 'unknown_outcome', false, false],
    ['requested', 'attempted', false, false],
    ['attempted', 'attempted', true, false],
    ['succeeded', 'failed', true, false],
    ['failed', 'attempted', true, false],
    ['aborted', 'attempted', true, false],
    ['unknown_outcome', 'attempted', true, false],
  ] as const)('%s → %s consumed=%s 合法=%s', (from, to, confirmationConsumed, valid) => {
    expect(transitionWeComRealSendProofStatus({ from, to, confirmationConsumed }).ok).toBe(valid);
  });

  it('ready_no_send 不是 succeeded，unknown_outcome 只能人工复核且不可重试', () => {
    expect(readySource().readyNoSendMetadata.status).toBe('ready_no_send');
    expect(readySource().readyNoSendMetadata.status).not.toBe('succeeded');
    expect(transitionWeComRealSendProofStatus({
      from: 'unknown_outcome', to: 'attempted', confirmationConsumed: true,
    })).toEqual({ ok: false, reason: 'unknown_outcome_manual_review_required' });
  });

  it('六层 controls 全部存在且匹配才允许，任一 deny/kill/过期/自批均 deny wins', () => {
    expect(evaluateRealSendProofControls({ controls: [], scope, now })).toMatchObject({ allowed: false, reason: 'control_missing' });
    expect(evaluateRealSendProofControls({ controls: controls(), scope, now })).toEqual({ allowed: true });
    expect(evaluateRealSendProofControls({ controls: controls({ killSwitchEngaged: true }), scope, now })).toMatchObject({ allowed: false, reason: 'kill_switch_engaged' });
    expect(evaluateRealSendProofControls({ controls: controls({ proofEnabled: false }), scope, now })).toMatchObject({ allowed: false, reason: 'control_disabled' });
    expect(evaluateRealSendProofControls({ controls: controls({ expiresAt: now }), scope, now })).toMatchObject({ allowed: false, reason: 'control_expired' });
    expect(evaluateRealSendProofControls({ controls: controls({ approvedBy: 'admin-a' }), scope, now })).toMatchObject({ allowed: false, reason: 'control_self_approved' });
  });

  it.each(['global', 'tenant', 'institution', 'channel', 'customer', 'operator_role'] as const)(
    '%s 单层 deny 都能独立阻断',
    (scopeKind) => {
      const rows = controls().map((control) => control.scopeKind === scopeKind
        ? { ...control, killSwitchEngaged: true }
        : control);
      expect(evaluateRealSendProofControls({ controls: rows, scope, now })).toMatchObject({
        allowed: false,
        reason: 'kill_switch_engaged',
        scopeKind,
      });
    },
  );

  it.each(['global', 'tenant', 'channel', 'operator_role'] as const)(
    '%s control 不允许由执行 operator 自批',
    (scopeKind) => {
      const rows = controls().map((control) => control.scopeKind === scopeKind
        ? { ...control, approvedBy: scope.operatorId }
        : control);
      expect(evaluateRealSendProofControls({ controls: rows, scope, now })).toMatchObject({
        allowed: false,
        reason: 'control_self_approved',
        scopeKind,
      });
    },
  );

  it('controls 时间异常和未来生效均 fail-closed', () => {
    expect(evaluateRealSendProofControls({ controls: controls(), scope, now: 'invalid-time' }))
      .toMatchObject({ allowed: false, reason: 'control_time_invalid' });
    expect(evaluateRealSendProofControls({ controls: controls({ effectiveAt: 'invalid-time' }), scope, now }))
      .toMatchObject({ allowed: false, reason: 'control_time_invalid' });
    expect(evaluateRealSendProofControls({ controls: controls({ effectiveAt: '2026-07-12T08:30:00.000Z' }), scope, now }))
      .toMatchObject({ allowed: false, reason: 'control_not_effective' });
  });

  it('production attestation 缺失、过期、blocked 或身份不匹配均 fail-closed', () => {
    expect(evaluateProductionAttestation({ attestation: null, expected: expectedAttestation, now })).toEqual({ allowed: false, reason: 'attestation_missing' });
    expect(evaluateProductionAttestation({ attestation, expected: expectedAttestation, now })).toEqual({ allowed: true });
    expect(evaluateProductionAttestation({ attestation: { ...attestation, expiresAt: now }, expected: expectedAttestation, now })).toEqual({ allowed: false, reason: 'attestation_expired' });
    expect(evaluateProductionAttestation({ attestation: { ...attestation, postcheckStatus: 'blocked' }, expected: expectedAttestation, now })).toEqual({ allowed: false, reason: 'attestation_not_ready' });
    expect(evaluateProductionAttestation({ attestation, expected: { ...expectedAttestation, databaseIdentityRef: 'other-db' }, now })).toEqual({ allowed: false, reason: 'attestation_mismatch' });
    expect(evaluateProductionAttestation({ attestation: { ...attestation, attestedAt: 'invalid-time' }, expected: expectedAttestation, now }))
      .toEqual({ allowed: false, reason: 'attestation_time_invalid' });
    expect(evaluateProductionAttestation({ attestation: { ...attestation, attestedAt: '2026-07-12T08:30:00.000Z' }, expected: expectedAttestation, now }))
      .toEqual({ allowed: false, reason: 'attestation_not_effective' });
  });

  it('demo_session、非专用角色、platform/read-only 默认不能 execute_once', () => {
    expect(evaluateWeComRealSendProofPermission({
      userId: 'admin-a', role: 'tenant_admin', scope: 'tenant', tenantId: 'tenant-a', institutionId: 'inst-a', source: 'demo_session',
    })).toEqual({ allowed: false, reason: 'formal_session_required' });
    expect(evaluateWeComRealSendProofPermission({
      userId: 'operator-a', role: 'tenant_operator', scope: 'tenant', tenantId: 'tenant-a', institutionId: 'inst-a', source: 'server_session',
    })).toEqual({ allowed: false, reason: 'execute_once_permission_required' });
    expect(evaluateWeComRealSendProofPermission({
      userId: 'platform-a', role: 'platform_admin', scope: 'platform', tenantId: null, source: 'server_session',
    })).toEqual({ allowed: false, reason: 'institution_context_required' });
  });
});
