import { beforeEach, describe, expect, it, vi } from 'vitest';

const authorizationHandle = Object.freeze({});
const writeAuthorizationHandle = Object.freeze({});
const source = Object.freeze({ list: vi.fn() });
const reader = Object.freeze({ read: vi.fn() });
const database = Object.freeze({ kind: 'database' });

const mocks = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  consumeAuthorization: vi.fn(),
  getDatabase: vi.fn(),
  createRepository: vi.fn(),
  createReader: vi.fn(),
  resolveWriteAuthorization: vi.fn(),
  consumeWriteAuthorization: vi.fn(),
  readCommandRecord: vi.fn(),
}));

vi.mock('@/server/orchestration/institution-conversation-read-authorization', () => ({
  resolveInstitutionConversationReadAuthorizationV1: mocks.resolveAuthorization,
  consumeInstitutionConversationReadAuthorizationV1: mocks.consumeAuthorization,
}));

vi.mock('@/server/orchestration/institution-conversation-write-authorization', () => ({
  resolveInstitutionConversationWriteAuthorizationV1: mocks.resolveWriteAuthorization,
  consumeInstitutionConversationWriteAuthorizationV1: mocks.consumeWriteAuthorization,
}));

vi.mock('@/modules/institution-conversations/server/conversation-command-repository', () => ({
  readScopedConversationCommandRecordV1: mocks.readCommandRecord,
}));

vi.mock('@/server/db/client', () => ({
  getDatabase: mocks.getDatabase,
}));

vi.mock('@/modules/institution-conversations/server/conversation-queue-repository', () => ({
  createConversationQueueRepository: mocks.createRepository,
}));

vi.mock('@/modules/institution-conversations/application/conversation-queue-reader', () => ({
  createConversationQueueReaderV1: mocks.createReader,
}));

import {
  readCurrentInstitutionConversationQueueActionableIdsV1,
  readCurrentInstitutionConversationQueueV1,
} from '@/server/orchestration/institution-conversation-queue-reader';

describe('Institution conversation queue orchestration', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.resolveAuthorization.mockResolvedValue({
      kind: 'allowed',
      authorization: authorizationHandle,
    });
    mocks.consumeAuthorization.mockReturnValue({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      observedAt: '2026-08-17T04:00:00.000Z',
    });
    mocks.getDatabase.mockReturnValue(database);
    mocks.createRepository.mockReturnValue(source);
    mocks.createReader.mockReturnValue(reader);
    mocks.resolveWriteAuthorization.mockResolvedValue({
      kind: 'allowed',
      authorization: writeAuthorizationHandle,
    });
    mocks.consumeWriteAuthorization.mockReturnValue({
      accountId: 'account-001',
      displayName: '当前处理人',
      role: 'customer_service',
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      observedAt: '2026-08-20T01:00:00.000Z',
    });
    reader.read.mockResolvedValue({
      kind: 'ready',
      queue: {
        contractVersion: 'v1',
        dataState: 'empty',
        records: [],
        pageInfo: { pageSize: 100, hasMore: false },
      },
    });
  });

  it('one-shot formal pair 直接驱动 exact-scoped source/reader', async () => {
    await expect(readCurrentInstitutionConversationQueueV1()).resolves.toMatchObject({
      kind: 'ready',
    });

    expect(mocks.consumeAuthorization).toHaveBeenCalledWith(authorizationHandle);
    expect(mocks.createRepository).toHaveBeenCalledWith(database);
    expect(mocks.createReader).toHaveBeenCalledWith({ source });
    expect(reader.read).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
    });
  });

  it('formal authorization forbidden 原样 fail-closed', async () => {
    mocks.resolveAuthorization.mockResolvedValueOnce({ kind: 'forbidden' });
    await expect(readCurrentInstitutionConversationQueueV1()).resolves.toEqual({
      kind: 'forbidden',
    });
    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });

  it('authorization unavailable 或 handle consumption 失败均 unavailable', async () => {
    mocks.resolveAuthorization.mockResolvedValueOnce({ kind: 'unavailable' });
    await expect(readCurrentInstitutionConversationQueueV1()).resolves.toEqual({
      kind: 'unavailable',
    });

    mocks.resolveAuthorization.mockResolvedValueOnce({
      kind: 'allowed',
      authorization: authorizationHandle,
    });
    mocks.consumeAuthorization.mockReturnValueOnce(null);
    await expect(readCurrentInstitutionConversationQueueV1()).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('repository/reader 异常不会泄露底层错误', async () => {
    reader.read.mockRejectedValueOnce(new Error('database secret'));
    await expect(readCurrentInstitutionConversationQueueV1()).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('管理角色对当前正式队列记录均可进入受控详情', async () => {
    mocks.consumeWriteAuthorization.mockReturnValueOnce({
      accountId: 'account-admin',
      displayName: '管理员',
      role: 'tenant_operator',
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      observedAt: '2026-08-20T01:00:00.000Z',
    });
    const queue = {
      contractVersion: 'v1' as const,
      dataState: 'ready' as const,
      records: [
        { conversationId: 'conversation-1' },
        { conversationId: 'conversation-2' },
      ],
      pageInfo: { pageSize: 100 as const, hasMore: false },
    } as never;

    await expect(
      readCurrentInstitutionConversationQueueActionableIdsV1(queue),
    ).resolves.toEqual(['conversation-1', 'conversation-2']);
    expect(mocks.readCommandRecord).not.toHaveBeenCalled();
  });

  it('普通角色仅对当前本人 active assignment 渲染受控详情入口', async () => {
    const queue = {
      contractVersion: 'v1' as const,
      dataState: 'ready' as const,
      records: [
        { conversationId: 'conversation-self' },
        { conversationId: 'conversation-other' },
      ],
      pageInfo: { pageSize: 100 as const, hasMore: false },
    } as never;
    mocks.readCommandRecord
      .mockResolvedValueOnce({
        segment: {
          assignment: {
            assigneeUserId: 'account-001',
            status: 'accepted',
          },
        },
      })
      .mockResolvedValueOnce({
        segment: {
          assignment: {
            assigneeUserId: 'account-999',
            status: 'accepted',
          },
        },
      });

    await expect(
      readCurrentInstitutionConversationQueueActionableIdsV1(queue),
    ).resolves.toEqual(['conversation-self']);
    expect(mocks.readCommandRecord).toHaveBeenCalledTimes(2);
  });

  it('写授权不可用时 fail-closed 隐藏全部详情入口', async () => {
    mocks.resolveWriteAuthorization.mockResolvedValueOnce({ kind: 'unavailable' });
    const queue = {
      contractVersion: 'v1' as const,
      dataState: 'ready' as const,
      records: [{ conversationId: 'conversation-1' }],
      pageInfo: { pageSize: 100 as const, hasMore: false },
    } as never;

    await expect(
      readCurrentInstitutionConversationQueueActionableIdsV1(queue),
    ).resolves.toEqual([]);
    expect(mocks.readCommandRecord).not.toHaveBeenCalled();
  });
});
