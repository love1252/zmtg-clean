import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runCareFollowUpTransaction } from '@/server/orchestration/care-follow-up-transaction';
import type { TenantDatabase } from '@/server/db/client';

describe('care-follow-up transaction orchestration',()=>{
  it('creates one transaction-bound Care service',async()=>{
    const transactionDb={} as TenantDatabase; const transaction=vi.fn(async(operation:(database:TenantDatabase)=>Promise<string>)=>operation(transactionDb));
    const result=await runCareFollowUpTransaction({transaction} as unknown as TenantDatabase,async({commandService})=>{expect(commandService.createPathEnrollmentBundle).toBeTypeOf('function');expect(commandService.transitionTaskWithTimeline).toBeTypeOf('function');expect(commandService.cancelPathEnrollmentWithTimeline).toBeTypeOf('function');return 'committed';});
    expect(result).toBe('committed'); expect(transaction).toHaveBeenCalledTimes(1);
  });
  it('operation failure propagates to transaction rollback boundary',async()=>{
    const transaction=vi.fn(async(operation:(database:TenantDatabase)=>Promise<unknown>)=>operation({} as TenantDatabase));
    await expect(runCareFollowUpTransaction({transaction} as unknown as TenantDatabase,async()=>{throw new Error('required_timeline_evidence_failed');})).rejects.toThrow('required_timeline_evidence_failed');
  });
  it('institution delegate imports orchestration, not care server',()=>{
    const delegate=readFileSync(resolve(process.cwd(),'src/modules/institution/server/followup-path-enrollment-transaction.ts'),'utf8');
    const orchestration=readFileSync(resolve(process.cwd(),'src/server/orchestration/care-follow-up-transaction.ts'),'utf8');
    expect(delegate).toContain('@/server/orchestration/care-follow-up-transaction'); expect(delegate).not.toContain('@/modules/care/server/'); expect(orchestration).toContain('@/modules/care/server/follow-up-command-repository'); expect(orchestration).toContain('database.transaction');
  });
});
