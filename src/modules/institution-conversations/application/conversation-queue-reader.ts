import { isProxy } from 'node:util/types';

import {
  conversationRootIdentityStates,
  type ConversationRootIdentityState,
} from '../domain/conversations';
import {
  conversationSegmentStates,
  type ConversationSegmentState,
} from '../domain/conversation-segments';
import type {
  ConversationQueueSourceRowV1,
  ConversationQueueSourceV1,
} from '../ports/conversation-queue-source';

export const CONVERSATION_QUEUE_PAGE_SIZE_V1 = 100;

export type ConversationQueueItemV1 = Readonly<{
  contractVersion: 'v1';
  conversationId: string;
  channelType: string;
  identityState: ConversationRootIdentityState;
  activeSegmentState: ConversationSegmentState | null;
  latestCustomerInboundAt: string | null;
  updatedAt: string;
}>;

export type ConversationQueueV1 = Readonly<{
  contractVersion: 'v1';
  dataState: 'empty' | 'ready';
  records: readonly ConversationQueueItemV1[];
  pageInfo: Readonly<{
    pageSize: typeof CONVERSATION_QUEUE_PAGE_SIZE_V1;
    hasMore: boolean;
  }>;
}>;

export type ConversationQueueReaderResultV1 =
  | Readonly<{ kind: 'ready'; queue: ConversationQueueV1 }>
  | Readonly<{ kind: 'unavailable' }>;

export type ConversationQueueReaderV1 = Readonly<{
  read: (input: Readonly<{
    tenantId: string;
    institutionId: string;
  }>) => Promise<ConversationQueueReaderResultV1>;
}>;

const FACTORY_KEYS = Object.freeze(['source'] as const);
const READ_KEYS = Object.freeze(['tenantId', 'institutionId'] as const);
const SOURCE_ROW_KEYS = Object.freeze([
  'tenantId',
  'institutionId',
  'conversationId',
  'channelType',
  'identityState',
  'activeSegmentId',
  'activeSegmentState',
  'latestCustomerInboundAt',
  'updatedAt',
] as const);

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const channelPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;
const canonicalUtcInstant =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const UNAVAILABLE = Object.freeze({ kind: 'unavailable' } as const);

function snapshot(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || isProxy(value)
      || Object.getPrototypeOf(value) !== Object.prototype
    ) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).length !== keys.length
      || keys.some((key) => !Object.hasOwn(descriptors, key))
    ) return null;

    const result: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
      Object.defineProperty(result, key, {
        value: descriptor.value,
        enumerable: true,
      });
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && idPattern.test(value);
}

function isChannelType(value: unknown): value is string {
  return typeof value === 'string' && channelPattern.test(value);
}

function isIdentityState(value: unknown): value is ConversationRootIdentityState {
  return conversationRootIdentityStates.some((item) => item === value);
}

function isSegmentState(value: unknown): value is ConversationSegmentState {
  return conversationSegmentStates.some((item) => item === value);
}

function isUtcInstant(value: unknown): value is string {
  if (typeof value !== 'string' || !canonicalUtcInstant.test(value)) return false;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value;
}

function parseSourceRow(
  value: unknown,
  tenantId: string,
  institutionId: string,
): ConversationQueueSourceRowV1 | null {
  const row = snapshot(value, SOURCE_ROW_KEYS);
  if (
    !row
    || row.tenantId !== tenantId
    || row.institutionId !== institutionId
    || !isId(row.conversationId)
    || !isChannelType(row.channelType)
    || !isIdentityState(row.identityState)
    || (
      row.activeSegmentId !== null
      && !isId(row.activeSegmentId)
    )
    || (
      row.activeSegmentState !== null
      && !isSegmentState(row.activeSegmentState)
    )
    || (
      (row.activeSegmentId === null) !== (row.activeSegmentState === null)
    )
    || (
      row.latestCustomerInboundAt !== null
      && !isUtcInstant(row.latestCustomerInboundAt)
    )
    || !isUtcInstant(row.updatedAt)
  ) return null;

  return Object.freeze({
    tenantId,
    institutionId,
    conversationId: row.conversationId,
    channelType: row.channelType,
    identityState: row.identityState,
    activeSegmentId: row.activeSegmentId,
    activeSegmentState: row.activeSegmentState,
    latestCustomerInboundAt: row.latestCustomerInboundAt,
    updatedAt: row.updatedAt,
  });
}

function makeReader(source: ConversationQueueSourceV1 | null): ConversationQueueReaderV1 {
  return Object.freeze({
    async read(value): Promise<ConversationQueueReaderResultV1> {
      const input = snapshot(value, READ_KEYS);
      if (
        !input
        || !isId(input.tenantId)
        || !isId(input.institutionId)
        || !source
        || typeof source.list !== 'function'
        || isProxy(source.list)
      ) return UNAVAILABLE;

      try {
        const rows = await source.list({
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          limit: 101,
        });
        if (!Array.isArray(rows) || rows.length > 101) return UNAVAILABLE;

        const parsed = rows.map((row) =>
          parseSourceRow(
            row,
            input.tenantId as string,
            input.institutionId as string,
          ),
        );
        if (parsed.some((row) => row === null)) return UNAVAILABLE;

        const records = Object.freeze(
          parsed.slice(0, CONVERSATION_QUEUE_PAGE_SIZE_V1).map((row) => {
            if (!row) throw new Error('conversation_queue_row_unavailable');
            return Object.freeze({
              contractVersion: 'v1' as const,
              conversationId: row.conversationId,
              channelType: row.channelType,
              identityState: row.identityState,
              activeSegmentState: row.activeSegmentState,
              latestCustomerInboundAt: row.latestCustomerInboundAt,
              updatedAt: row.updatedAt,
            });
          }),
        );

        return Object.freeze({
          kind: 'ready' as const,
          queue: Object.freeze({
            contractVersion: 'v1' as const,
            dataState: records.length === 0 ? 'empty' as const : 'ready' as const,
            records,
            pageInfo: Object.freeze({
              pageSize: CONVERSATION_QUEUE_PAGE_SIZE_V1,
              hasMore: rows.length > CONVERSATION_QUEUE_PAGE_SIZE_V1,
            }),
          }),
        });
      } catch {
        return UNAVAILABLE;
      }
    },
  });
}

export function createConversationQueueReaderV1(
  input: Readonly<{ source: ConversationQueueSourceV1 }>,
): ConversationQueueReaderV1 {
  const record = snapshot(input, FACTORY_KEYS);
  return makeReader(
    record
      && record.source !== null
      && typeof record.source === 'object'
      && !isProxy(record.source)
      && typeof (record.source as ConversationQueueSourceV1).list === 'function'
      ? (record.source as ConversationQueueSourceV1)
      : null,
  );
}
