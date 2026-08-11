import {
  createHisConnectionCommandService,
  type HisConnectionCommandService,
} from '@/modules/institution-system/application/his-connection-command-service';
import { createHisConnectionCommandRepository } from '@/modules/institution-system/server/his-connection-command-repository';
import type { TenantDatabase } from '@/server/db/client';

export function createHisConnectionWriter(
  database: TenantDatabase,
): HisConnectionCommandService {
  return createHisConnectionCommandService(
    createHisConnectionCommandRepository(database),
  );
}

export type HisConnectionWriter = ReturnType<typeof createHisConnectionWriter>;
