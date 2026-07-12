import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  WE_COM_CUSTOMER_BROADCAST_TASK_ACCEPTANCE_KIND,
  WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY,
  WE_COM_CUSTOMER_BROADCAST_TASK_MESSAGE_KIND,
  WE_COM_CUSTOMER_BROADCAST_TASK_MOCK_RESULT_KIND,
  WE_COM_CUSTOMER_BROADCAST_TASK_PROOF_KIND,
  WE_COM_CUSTOMER_BROADCAST_TASK_SUCCESS_EVIDENCE_KIND,
  weComCustomerBroadcastTaskActions,
  weComCustomerBroadcastTaskProviderInputKeys,
  weComCustomerBroadcastTaskProviderResultKinds,
  type WeComCustomerBroadcastTaskProviderInput,
  type WeComCustomerBroadcastTaskProviderOutput,
} from '@/modules/institution/domain/wecom-customer-broadcast-task-provider';
import type {
  ProtectedWeComCustomerBroadcastTaskRecipientResolution,
  ProtectedWeComCustomerBroadcastTaskRecipientResolutionInput,
} from '@/modules/institution/server/wecom-customer-broadcast-task-provider-contract';
import {
  createProtectedWeComCustomerBroadcastTaskRecipientResolverMock,
  createWeComCustomerBroadcastTaskMockProvider,
} from '@/modules/institution/server/wecom-customer-broadcast-task-mock-provider';

const providerInput = {
  operationRef: 'operation-ref-a',
  recipientBindingRef: 'binding-ref-a',
  recipientBindingDigest: 'a'.repeat(64),
  recipientBindingVersion: 'binding-version-a',
  contentRef: 'content-ref-a',
  contentHash: 'b'.repeat(64),
  messageKind: WE_COM_CUSTOMER_BROADCAST_TASK_MESSAGE_KIND,
  acceptanceKind: WE_COM_CUSTOMER_BROADCAST_TASK_ACCEPTANCE_KIND,
} satisfies WeComCustomerBroadcastTaskProviderInput;

const resolutionInput = {
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  operationRef: providerInput.operationRef,
  recipientBindingRef: providerInput.recipientBindingRef,
  recipientBindingDigest: providerInput.recipientBindingDigest,
  recipientBindingVersion: providerInput.recipientBindingVersion,
} satisfies ProtectedWeComCustomerBroadcastTaskRecipientResolutionInput;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('企业微信客户群发任务 provider contract', () => {
  it('固定为非直接发送且要求员工确认的文本群发任务', () => {
    expect(WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY).toEqual({
      capabilityKind: WE_COM_CUSTOMER_BROADCAST_TASK_PROOF_KIND,
      directSend: false,
      requiresEmployeeConfirmation: true,
      messageKind: WE_COM_CUSTOMER_BROADCAST_TASK_MESSAGE_KIND,
      acceptanceKind: WE_COM_CUSTOMER_BROADCAST_TASK_ACCEPTANCE_KIND,
      successEvidenceKind: WE_COM_CUSTOMER_BROADCAST_TASK_SUCCESS_EVIDENCE_KIND,
    });
    expect(Object.isFrozen(WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY)).toBe(true);
    expect(weComCustomerBroadcastTaskActions).toEqual([
      'issue_confirmation',
      'create_task_once',
    ]);
  });

  it('provider input 恰好只包含八个低敏字段', () => {
    expect(Object.keys(providerInput)).toEqual([
      ...weComCustomerBroadcastTaskProviderInputKeys,
    ]);
  });

  it('accepted 仅表示 task_created，五类结果保持稳定且不携带原始详情', () => {
    const outputs = [
      {
        kind: 'accepted',
        acceptanceKind: WE_COM_CUSTOMER_BROADCAST_TASK_ACCEPTANCE_KIND,
      },
      { kind: 'rejected' },
      { kind: 'timeout' },
      { kind: 'transport_error' },
      { kind: 'indeterminate' },
    ] satisfies WeComCustomerBroadcastTaskProviderOutput[];

    expect(outputs.map((output) => output.kind)).toEqual([
      ...weComCustomerBroadcastTaskProviderResultKinds,
    ]);
    expect(outputs[0]).toEqual({
      kind: 'accepted',
      acceptanceKind: 'task_created',
    });
    expect(outputs.slice(1).every((output) => Object.keys(output).length === 1)).toBe(true);
  });

  it('mock provider 覆盖五类结果，accepted 仅为 task_created_mock', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const outputs = await Promise.all(
      weComCustomerBroadcastTaskProviderResultKinds.map((resultKind) =>
        createWeComCustomerBroadcastTaskMockProvider(resultKind).createTask(
          providerInput,
        ),
      ),
    );

    expect(outputs).toEqual([
      {
        kind: 'accepted',
        acceptanceKind: 'task_created',
        mockResultKind: WE_COM_CUSTOMER_BROADCAST_TASK_MOCK_RESULT_KIND,
        requiresEmployeeConfirmation: true,
      },
      { kind: 'rejected' },
      { kind: 'timeout' },
      { kind: 'transport_error' },
      { kind: 'indeterminate' },
    ]);
    expect(outputs[0]).not.toHaveProperty('status', 'succeeded');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('protected resolver 绑定 tenant 与 institution 且只返回低敏 binding', async () => {
    const resolver = createProtectedWeComCustomerBroadcastTaskRecipientResolverMock(
      resolutionInput,
    );
    const resolved = await resolver.resolve(resolutionInput);
    const expectedResolution = {
      kind: 'resolved',
      recipientBindingRef: resolutionInput.recipientBindingRef,
      recipientBindingDigest: resolutionInput.recipientBindingDigest,
      recipientBindingVersion: resolutionInput.recipientBindingVersion,
    } satisfies ProtectedWeComCustomerBroadcastTaskRecipientResolution;

    expect(Object.keys(resolutionInput)).toEqual([
      'tenantId',
      'institutionId',
      'operationRef',
      'recipientBindingRef',
      'recipientBindingDigest',
      'recipientBindingVersion',
    ]);
    expect(resolved).toEqual(expectedResolution);
    expect(Object.keys(resolved)).toEqual([
      'kind',
      'recipientBindingRef',
      'recipientBindingDigest',
      'recipientBindingVersion',
    ]);
  });

  it('protected resolver 对 digest mismatch 与 stale version 失败关闭', async () => {
    const resolver = createProtectedWeComCustomerBroadcastTaskRecipientResolverMock(
      resolutionInput,
    );

    await expect(
      resolver.resolve({
        ...resolutionInput,
        recipientBindingDigest: 'c'.repeat(64),
      }),
    ).resolves.toEqual({
      kind: 'blocked',
      reasonCode: 'binding_digest_mismatch',
    });
    await expect(
      resolver.resolve({
        ...resolutionInput,
        recipientBindingVersion: 'binding-version-stale',
      }),
    ).resolves.toEqual({ kind: 'blocked', reasonCode: 'binding_stale' });
  });

  it('protected resolver 对 scope 与 binding ref 失败关闭', async () => {
    const resolver = createProtectedWeComCustomerBroadcastTaskRecipientResolverMock(
      resolutionInput,
    );

    await expect(
      resolver.resolve({ ...resolutionInput, institutionId: 'institution-b' }),
    ).resolves.toEqual({
      kind: 'blocked',
      reasonCode: 'binding_scope_mismatch',
    });
    await expect(
      resolver.resolve({ ...resolutionInput, recipientBindingRef: 'binding-ref-b' }),
    ).resolves.toEqual({ kind: 'blocked', reasonCode: 'binding_missing' });
  });

  it('contract 源码不实现网络调用，也不声明被禁止的敏感字段', () => {
    const sourceFiles = [
      'src/modules/institution/domain/wecom-customer-broadcast-task-provider.ts',
      'src/modules/institution/server/wecom-customer-broadcast-task-provider-contract.ts',
      'src/modules/institution/server/wecom-customer-broadcast-task-mock-provider.ts',
    ];
    const source = sourceFiles
      .map((file) => readFileSync(`${process.cwd()}/${file}`, 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toMatch(/\b(?:axios|XMLHttpRequest)\b/u);
    expect(source).not.toMatch(/\b(?:process|Bun|Deno)\.env\b/u);
    expect(source).not.toMatch(/https?:\/\//u);
    expect(source).not.toMatch(
      /\b(?:external_userid|userid|access_token|secret|providerUrl|endpoint|baseUrl|rawResponse|responseBody|msgid|msg_id|messageContent|recipientValue|customerExternalId)\b/iu,
    );
  });
});
