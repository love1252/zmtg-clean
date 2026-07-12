import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  WE_COM_CUSTOMER_BROADCAST_TASK_ACCEPTANCE_KIND,
  WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY,
  WE_COM_CUSTOMER_BROADCAST_TASK_MESSAGE_KIND,
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
    const input = {
      operationRef: 'operation-ref-a',
      recipientBindingRef: 'binding-ref-a',
      recipientBindingDigest: 'a'.repeat(64),
      recipientBindingVersion: 'binding-version-a',
      contentRef: 'content-ref-a',
      contentHash: 'b'.repeat(64),
      messageKind: WE_COM_CUSTOMER_BROADCAST_TASK_MESSAGE_KIND,
      acceptanceKind: WE_COM_CUSTOMER_BROADCAST_TASK_ACCEPTANCE_KIND,
    } satisfies WeComCustomerBroadcastTaskProviderInput;

    expect(Object.keys(input)).toEqual([...weComCustomerBroadcastTaskProviderInputKeys]);
  });

  it('accepted 仅表示 task_created，五类结果保持稳定且不携带原始详情', () => {
    const outputs = [
      { kind: 'accepted', acceptanceKind: WE_COM_CUSTOMER_BROADCAST_TASK_ACCEPTANCE_KIND },
      { kind: 'rejected' },
      { kind: 'timeout' },
      { kind: 'transport_error' },
      { kind: 'indeterminate' },
    ] satisfies WeComCustomerBroadcastTaskProviderOutput[];

    expect(outputs.map((output) => output.kind)).toEqual([
      ...weComCustomerBroadcastTaskProviderResultKinds,
    ]);
    expect(outputs[0]).toEqual({ kind: 'accepted', acceptanceKind: 'task_created' });
    expect(outputs.slice(1).every((output) => Object.keys(output).length === 1)).toBe(true);
  });

  it('protected resolver 绑定 tenant 与 institution 且只返回低敏 binding', () => {
    const input = {
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      operationRef: 'operation-ref-a',
      recipientBindingRef: 'binding-ref-a',
      recipientBindingDigest: 'a'.repeat(64),
    } satisfies ProtectedWeComCustomerBroadcastTaskRecipientResolutionInput;
    const resolved = {
      kind: 'resolved',
      recipientBindingRef: input.recipientBindingRef,
      recipientBindingDigest: input.recipientBindingDigest,
      recipientBindingVersion: 'binding-version-a',
    } satisfies ProtectedWeComCustomerBroadcastTaskRecipientResolution;

    expect(Object.keys(input)).toEqual([
      'tenantId',
      'institutionId',
      'operationRef',
      'recipientBindingRef',
      'recipientBindingDigest',
    ]);
    expect(Object.keys(resolved)).toEqual([
      'kind',
      'recipientBindingRef',
      'recipientBindingDigest',
      'recipientBindingVersion',
    ]);
  });

  it('contract 源码不实现网络调用，也不声明被禁止的敏感字段', () => {
    const sourceFiles = [
      'src/modules/institution/domain/wecom-customer-broadcast-task-provider.ts',
      'src/modules/institution/server/wecom-customer-broadcast-task-provider-contract.ts',
    ];
    const source = sourceFiles
      .map((file) => readFileSync(`${process.cwd()}/${file}`, 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toMatch(/\b(?:axios|XMLHttpRequest)\b/u);
    expect(source).not.toMatch(/https?:\/\//u);
    expect(source).not.toMatch(
      /\b(?:external_userid|userid|access_token|secret|providerUrl|endpoint|baseUrl|rawResponse|responseBody|msgid|msg_id|messageContent|recipientValue|customerExternalId)\b/iu,
    );
  });
});
