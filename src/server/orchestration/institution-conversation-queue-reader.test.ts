import { beforeEach, describe, expect, it, vi } from 'vitest';

const authorizationHandle = Object.freeze({});
const source = Object.freeze({ list: vi.fn() });
const reader = Object.freeze({ read: vi.fn() });
const database = Object.freeze({ kind: 'database' });

const mocks = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  consumeAuthorization: vi.fn(),
  getDatabase: vi.fn(),
  createRepository: vi.fn(),
  createReader: vi.fn(),
}));

vi.mock('@/server/orchestration/institution-conversation-read-authorization', () => ({
  resolveInstitutionConversationReadAuthorizationV1: mocks.resolveAuthorization,
  consumeInstitutionConversationReadAuthorizationV1: mocks.consumeAuthorization,
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
});
