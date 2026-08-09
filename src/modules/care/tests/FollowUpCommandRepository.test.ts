import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import { createFollowUpCommandRepository } from '@/modules/care/server/follow-up-command-repository';
import type { TenantDatabase } from '@/server/db/client';
import { customers, followUpCustomerTimelineEvents, followUpPathEnrollments, followUpTasks, treatmentSummaries } from '@/server/db/schema';

type FollowUpTaskRow=typeof followUpTasks.$inferSelect;
type TimelineRow=typeof followUpCustomerTimelineEvents.$inferSelect;
const taskRow:FollowUpTaskRow={id:'task-a',tenantId:'tenant-a',institutionId:'institution-a',customerId:'customer-a',customerDisplayName:'客户A',journeyId:'journey-a',stage:'D1',status:'scheduled',dueAt:new Date('2026-08-10T01:00:00.000Z'),suggestedAction:'人工确认',riskLevel:'watch',sourceTreatmentSummaryId:'summary-a',sourceSuggestionKey:'summary-a:path:D1',updatedBy:null,updatedAt:null,createdAt:new Date('2026-08-09T01:00:00.000Z')};
const timelineRow:TimelineRow={id:'event-a',tenantId:'tenant-a',institutionId:'institution-a',customerId:'customer-a',sourceType:'manual_note',sourceId:'manual-a',eventType:'manual_feedback_recorded',eventTitle:'人工反馈',safeSummary:'低敏反馈',riskLevel:null,occurredAt:new Date('2026-08-10T02:00:00.000Z'),safeActorRole:'consultant',safeReasonCode:'manual_feedback_recorded',metadataJson:{},createdAt:new Date('2026-08-10T02:00:00.000Z'),updatedAt:new Date('2026-08-10T02:00:00.000Z')};
function dbMock(input:{selectRows?:unknown[][];insertRows?:unknown[][];updateRows?:unknown[][]}={}){
  let si=0,ii=0,ui=0;
  const selectWhere=vi.fn(async(_condition:SQL)=>input.selectRows?.[si++]??[]); const from=vi.fn(()=>({where:selectWhere})); const select=vi.fn(()=>({from}));
  const insertReturning=vi.fn(async()=>input.insertRows?.[ii++]??[]); const onConflictDoNothing=vi.fn(()=>({returning:insertReturning})); const values=vi.fn(()=>({onConflictDoNothing,returning:insertReturning})); const insert=vi.fn(()=>({values}));
  const updateReturning=vi.fn(async()=>input.updateRows?.[ui++]??[]); const updateWhere=vi.fn((condition:SQL)=>({condition,returning:updateReturning})); const set=vi.fn(()=>({where:updateWhere})); const update=vi.fn(()=>({set}));
  return {database:{insert,select,update} as unknown as TenantDatabase,insert,selectWhere,update,updateWhere,values};
}
function sql(condition:SQL){return new PgDialect().sqlToQuery(condition).sql;}
const sourceTaskInput={tenantId:'tenant-a',institutionId:'institution-a',id:'task-a',customerId:'customer-a',journeyId:'journey-a',stage:'D1',status:'scheduled' as const,dueAt:'2026-08-10T01:00:00.000Z',suggestedAction:'人工确认',riskLevel:'watch' as const,sourceTreatmentSummaryId:'summary-a',sourceSuggestionKey:'summary-a:path:D1'};

describe('FollowUpCommandRepository',()=>{
  it('source task customer query binds tenant institution customer',async()=>{
    const db=dbMock({selectRows:[[]]}); const repo=createFollowUpCommandRepository(db.database);
    await expect(repo.createTreatmentSourceTask(sourceTaskInput)).resolves.toEqual({kind:'not_found_or_not_owned'});
    expect(db.insert).not.toHaveBeenCalled(); const q=sql(db.selectWhere.mock.calls[0]?.[0] as SQL); expect(q).toContain('"tenant_id"'); expect(q).toContain('"institution_id"'); expect(q).toContain('"id"');
  });
  it('source task validates summary and writes institutionId',async()=>{
    const db=dbMock({selectRows:[[{id:'customer-a',displayName:'客户A'}],[{id:'summary-a'}],[]],insertRows:[[taskRow]]}); const repo=createFollowUpCommandRepository(db.database);
    const result=await repo.createTreatmentSourceTask(sourceTaskInput); const q=sql(db.selectWhere.mock.calls[1]?.[0] as SQL);
    expect(q).toContain('"institution_id"'); expect(q).toContain('"customer_id"'); expect(db.values).toHaveBeenCalledWith(expect.objectContaining({tenantId:'tenant-a',institutionId:'institution-a',customerId:'customer-a',customerDisplayName:'客户A'})); expect(result).toMatchObject({kind:'created',task:{institutionId:'institution-a'}});
  });
  it('manual timeline evidence is idempotent by source event',async()=>{
    const db=dbMock({selectRows:[[{id:'customer-a',displayName:'客户A'}],[timelineRow]]}); const repo=createFollowUpCommandRepository(db.database);
    const result=await repo.recordTimelineEvidence({tenantId:'tenant-a',institutionId:'institution-a',id:'event-new',customerId:'customer-a',sourceType:'manual_note',sourceId:'manual-a',eventType:'manual_feedback_recorded',eventTitle:'人工反馈',safeSummary:'低敏反馈',riskLevel:null,occurredAt:'2026-08-10T02:00:00.000Z',safeActorRole:'consultant',safeReasonCode:'manual_feedback_recorded',metadataJson:{}});
    expect(result).toMatchObject({kind:'exists'}); expect(db.insert).not.toHaveBeenCalled();
  });
  it('typed path source cross institution mismatch fails closed',async()=>{
    const db=dbMock({selectRows:[[{id:'customer-a',displayName:'客户A'}],[]]}); const repo=createFollowUpCommandRepository(db.database);
    await expect(repo.recordTimelineEvidence({tenantId:'tenant-a',institutionId:'institution-a',id:'event-a',customerId:'customer-a',sourceType:'path_enrollment',sourceId:'enrollment-other:tasks_generated',eventType:'followup_tasks_generated',eventTitle:'任务生成',safeSummary:'低敏任务生成记录',riskLevel:null,occurredAt:'2026-08-10T02:00:00.000Z',safeActorRole:'tenant_admin',safeReasonCode:'followup_tasks_generated',metadataJson:{}})).resolves.toEqual({kind:'not_found_or_not_owned'});
    expect(db.insert).not.toHaveBeenCalled(); const q=sql(db.selectWhere.mock.calls[1]?.[0] as SQL); expect(q).toContain('"institution_id"'); expect(q).toContain('"customer_id"');
  });
  it('source locks task/path CAS and required timeline markers',()=>{
    const source=readFileSync(resolve(process.cwd(),'src/modules/care/server/follow-up-command-repository.ts'),'utf8');
    expect(source).toContain('observedUpdatedAtCondition'); expect(source).toContain('isNull(followUpTasks.updatedAt)'); expect(source).toContain('eq(followUpPathEnrollments.updatedAt,current.updatedAt)'); expect(source).toContain('requireTimelineEvidence');
    expect(source).toContain('.insert(followUpPathEnrollments)'); expect(source).toContain('.insert(followUpTasks)'); expect(source).toContain('.insert(followUpPathStages)'); expect(source).toContain('.insert(followUpCustomerTimelineEvents)');
  });
  it('schema already supports institution attribution and CAS fields',()=>{
    expect(customers.institutionId).toBeDefined(); expect(treatmentSummaries.institutionId).toBeDefined(); expect(followUpTasks.institutionId).toBeDefined(); expect(followUpTasks.updatedAt).toBeDefined(); expect(followUpPathEnrollments.institutionId).toBeDefined(); expect(followUpPathEnrollments.updatedAt).toBeDefined(); expect(followUpCustomerTimelineEvents.institutionId).toBeDefined();
  });
});
