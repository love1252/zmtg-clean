/**
 * 企业微信客户群发任务的低敏能力契约。
 *
 * 该能力不是服务端直接私聊。任务被接受只表示创建成功，员工仍需在
 * 企业微信客户端确认；只有后续发送结果为成功状态，才可作为终态成功证据。
 */
export const WE_COM_CUSTOMER_BROADCAST_TASK_PROOF_KIND =
  'customer_broadcast_task' as const;
export const WE_COM_CUSTOMER_BROADCAST_TASK_MESSAGE_KIND = 'text' as const;
export const WE_COM_CUSTOMER_BROADCAST_TASK_ACCEPTANCE_KIND = 'task_created' as const;
export const WE_COM_CUSTOMER_BROADCAST_TASK_SUCCESS_EVIDENCE_KIND =
  'send_result_status_1' as const;

export const WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY = Object.freeze({
  capabilityKind: WE_COM_CUSTOMER_BROADCAST_TASK_PROOF_KIND,
  directSend: false,
  requiresEmployeeConfirmation: true,
  messageKind: WE_COM_CUSTOMER_BROADCAST_TASK_MESSAGE_KIND,
  acceptanceKind: WE_COM_CUSTOMER_BROADCAST_TASK_ACCEPTANCE_KIND,
  successEvidenceKind: WE_COM_CUSTOMER_BROADCAST_TASK_SUCCESS_EVIDENCE_KIND,
});

export type WeComCustomerBroadcastTaskCapability =
  typeof WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY;

export const weComCustomerBroadcastTaskActions = [
  'issue_confirmation',
  'create_task_once',
] as const;

export type WeComCustomerBroadcastTaskAction =
  (typeof weComCustomerBroadcastTaskActions)[number];

export const weComCustomerBroadcastTaskProviderInputKeys = [
  'operationRef',
  'recipientBindingRef',
  'recipientBindingDigest',
  'recipientBindingVersion',
  'contentRef',
  'contentHash',
  'messageKind',
  'acceptanceKind',
] as const;

export type WeComCustomerBroadcastTaskProviderInput = Readonly<{
  operationRef: string;
  recipientBindingRef: string;
  recipientBindingDigest: string;
  recipientBindingVersion: string;
  contentRef: string;
  contentHash: string;
  messageKind: typeof WE_COM_CUSTOMER_BROADCAST_TASK_MESSAGE_KIND;
  acceptanceKind: typeof WE_COM_CUSTOMER_BROADCAST_TASK_ACCEPTANCE_KIND;
}>;

export const weComCustomerBroadcastTaskProviderResultKinds = [
  'accepted',
  'rejected',
  'timeout',
  'transport_error',
  'indeterminate',
] as const;

export type WeComCustomerBroadcastTaskProviderResultKind =
  (typeof weComCustomerBroadcastTaskProviderResultKinds)[number];

export type WeComCustomerBroadcastTaskProviderOutput =
  | Readonly<{
      kind: 'accepted';
      acceptanceKind: typeof WE_COM_CUSTOMER_BROADCAST_TASK_ACCEPTANCE_KIND;
    }>
  | Readonly<{ kind: 'rejected' }>
  | Readonly<{ kind: 'timeout' }>
  | Readonly<{ kind: 'transport_error' }>
  | Readonly<{ kind: 'indeterminate' }>;
