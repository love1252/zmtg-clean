import { describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({repository:vi.fn(() => ({})),service:vi.fn(()=>({createInstitutionKnowledgeItem:vi.fn(),updateInstitutionKnowledgeItem:vi.fn(),archiveInstitutionKnowledgeItem:vi.fn()}))}));
vi.mock('@/modules/knowledge/server/institution-knowledge-command-repository',()=>({createInstitutionKnowledgeCommandRepository:mocks.repository}));
vi.mock('@/modules/knowledge/application/institution/knowledge-item-command-service',()=>({createKnowledgeItemCommandService:mocks.service}));
import { runKnowledgeInstitutionTransaction } from '@/server/orchestration/knowledge-institution-transaction';
import type { TenantDatabase } from '@/server/db/client';
describe('Knowledge institution transaction orchestration',()=>{
  it('binds repository and service to one transaction database',async()=>{const txDb={kind:'knowledge-transaction-db'} as unknown as TenantDatabase;const transaction=vi.fn(async(op:(d:TenantDatabase)=>Promise<string>)=>op(txDb));const result=await runKnowledgeInstitutionTransaction({transaction} as unknown as TenantDatabase,async({commandService})=>{expect(commandService.createInstitutionKnowledgeItem).toBeTypeOf('function');return 'committed';});expect(result).toBe('committed');expect(mocks.repository).toHaveBeenCalledWith(txDb);expect(transaction).toHaveBeenCalledTimes(1);});
  it('propagates failure to rollback boundary',async()=>{const transaction=vi.fn(async(op:(d:TenantDatabase)=>Promise<unknown>)=>op({} as TenantDatabase));await expect(runKnowledgeInstitutionTransaction({transaction} as unknown as TenantDatabase,async()=>{throw new Error('knowledge_bundle_failed');})).rejects.toThrow('knowledge_bundle_failed');});
});
