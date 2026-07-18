import { types as nodeTypes } from 'node:util';

import type { AiUsageTerminalStatusPolicy } from '@/modules/institution-system/domain/ai-usage-outcomes';

const OWNER_POLICY_MAX_STATUS_ENTRIES = 6;
const OWNER_POLICY_MAX_STRING_LENGTH = 64;
const OWNER_POLICY_REVISION = 'institution_ai_usage_terminal_status_policy_v1';
const stableStatusPattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;

const ownerStatusKeys = Object.freeze([
  'succeeded',
  'failed',
  'rate_limited',
  'provider_unavailable',
  'rejected',
  'sensitive_input_rejected',
] as const);

const ownerTerminalStatusPolicyDefinition = Object.freeze({
  succeeded: 'success',
  failed: 'failure',
  rate_limited: 'failure',
  provider_unavailable: 'failure',
  rejected: 'rejection',
  sensitive_input_rejected: 'rejection',
} as const);

export type InstitutionAiUsageTerminalStatusPolicySnapshot = Readonly<{
  revision: typeof OWNER_POLICY_REVISION;
  terminalStatusPolicy: AiUsageTerminalStatusPolicy;
}>;

export type InstitutionAiUsageTerminalStatusPolicySnapshotResult =
  | Readonly<{ ok: true; snapshot: InstitutionAiUsageTerminalStatusPolicySnapshot }>
  | Readonly<{ ok: false; code: 'owner_terminal_status_policy_unavailable' }>;

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & Readonly<{ value: unknown }> {
  return descriptor !== undefined
    && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    && !Object.prototype.hasOwnProperty.call(descriptor, 'get')
    && !Object.prototype.hasOwnProperty.call(descriptor, 'set');
}

function isStableStatus(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= OWNER_POLICY_MAX_STRING_LENGTH
    && stableStatusPattern.test(value);
}

function isTerminalOutcome(value: unknown): value is 'success' | 'failure' | 'rejection' {
  return value === 'success' || value === 'failure' || value === 'rejection';
}

function createOwnerPolicySnapshot(): InstitutionAiUsageTerminalStatusPolicySnapshotResult {
  try {
    if (
      nodeTypes.isProxy(ownerTerminalStatusPolicyDefinition)
      || Object.getPrototypeOf(ownerTerminalStatusPolicyDefinition) !== Object.prototype
      || ownerStatusKeys.length > OWNER_POLICY_MAX_STATUS_ENTRIES
      || new Set(ownerStatusKeys).size !== ownerStatusKeys.length
    ) return Object.freeze({ ok: false, code: 'owner_terminal_status_policy_unavailable' });

    const descriptors = Object.getOwnPropertyDescriptors(ownerTerminalStatusPolicyDefinition) as Record<
      string,
      PropertyDescriptor
    >;
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.some(key => typeof key !== 'string')
      || ownKeys.length !== ownerStatusKeys.length
      || ownerStatusKeys.some(key => !Object.prototype.hasOwnProperty.call(descriptors, key))
    ) return Object.freeze({ ok: false, code: 'owner_terminal_status_policy_unavailable' });

    const terminalStatusPolicy: Record<string, 'success' | 'failure' | 'rejection'> = {};
    for (const status of ownerStatusKeys) {
      const descriptor = descriptors[status];
      if (
        !isDataDescriptor(descriptor)
        || descriptor.enumerable !== true
        || !isStableStatus(status)
        || !isTerminalOutcome(descriptor.value)
      ) return Object.freeze({ ok: false, code: 'owner_terminal_status_policy_unavailable' });
      Object.defineProperty(terminalStatusPolicy, status, {
        configurable: false,
        enumerable: true,
        value: descriptor.value,
        writable: false,
      });
    }

    return Object.freeze({
      ok: true,
      snapshot: Object.freeze({
        revision: OWNER_POLICY_REVISION,
        terminalStatusPolicy: Object.freeze(terminalStatusPolicy),
      }),
    });
  } catch {
    return Object.freeze({ ok: false, code: 'owner_terminal_status_policy_unavailable' });
  }
}

const ownerPolicySnapshot = createOwnerPolicySnapshot();

/**
 * This owner boundary has no caller-supplied outcome policy. A reviewed owner-module change is
 * required to add a persistent terminal status or alter its business classification.
 */
export function getInstitutionAiUsageTerminalStatusPolicySnapshot(): InstitutionAiUsageTerminalStatusPolicySnapshotResult {
  return ownerPolicySnapshot;
}
