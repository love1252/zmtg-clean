import { describe, expect, it, vi } from 'vitest';
import { CareFollowUpCommandInputError, createFollowUpCommandService, type FollowUpCommandRepository } from '@/modules/care/application/follow-up-command-service';

function repositoryMock(){
  const createTreatmentSourceTask=vi.fn<FollowUpCommandRepository['createTreatmentSourceTask']>(async()=>({kind:'not_found_or_not_owned'}));
  const createManualTask=vi.fn<FollowUpCommandRepository['createManualTask']>(async()=>({kind:'not_found_or_not_owned'}));
  const transitionTaskWithTimeline=vi.fn<FollowUpCommandRepository['transitionTaskWithTimeline']>(async()=>({kind:'not_found_or_not_owned'}));
  const createPathEnrollmentBundle=vi.fn<FollowUpCommandRepository['createPathEnrollmentBundle']>(async()=>({kind:'not_found_or_not_owned'}));
  const cancelPathEnrollmentWithTimeline=vi.fn<FollowUpCommandRepository['cancelPathEnrollmentWithTimeline']>(async()=>({kind:'not_found_or_not_owned'}));
  const recordTimelineEvidence=vi.fn<FollowUpCommandRepository['recordTimelineEvidence']>(async()=>({kind:'not_found_or_not_owned'}));
  const repository:FollowUpCommandRepository={createTreatmentSourceTask,createManualTask,transitionTaskWithTimeline,createPathEnrollmentBundle,cancelPathEnrollmentWithTimeline,recordTimelineEvidence};
  return {repository,createTreatmentSourceTask,createManualTask,transitionTaskWithTimeline,createPathEnrollmentBundle,cancelPathEnrollmentWithTimeline,recordTimelineEvidence};
}
const attribution={tenantId:'tenant-a',institutionId:'institution-a'};

describe('FollowUpCommandService',()=>{
  it('rejects missing institution before repository',async()=>{
    const mock=repositoryMock(); const service=createFollowUpCommandService(mock.repository);
    await expect(service.createTreatmentSourceTask({attribution:{tenantId:'tenant-a',institutionId:''},task:{id:'task-a',customerId:'customer-a',journeyId:'journey-a',stage:'D1',dueAt:'2026-08-10T01:00:00.000Z',suggestedAction:'manual',riskLevel:'watch',sourceTreatmentSummaryId:'summary-a',sourceSuggestionKey:'summary-a:path:D1'}})).rejects.toBeInstanceOf(CareFollowUpCommandInputError);
    expect(mock.createTreatmentSourceTask).not.toHaveBeenCalled();
  });
  it('forwards server tenant and institution for source task',async()=>{
    const mock=repositoryMock(); const service=createFollowUpCommandService(mock.repository);
    await service.createTreatmentSourceTask({attribution,task:{id:'task-a',customerId:'customer-a',journeyId:'journey-a',stage:'D1',dueAt:'2026-08-10T01:00:00.000Z',suggestedAction:'人工确认',riskLevel:'watch',sourceTreatmentSummaryId:'summary-a',sourceSuggestionKey:'summary-a:path:D1'}});
    expect(mock.createTreatmentSourceTask).toHaveBeenCalledWith(expect.objectContaining({tenantId:'tenant-a',institutionId:'institution-a',customerId:'customer-a',sourceTreatmentSummaryId:'summary-a'}));
  });
  it('transition carries actor and occurredAt',async()=>{
    const mock=repositoryMock(); const service=createFollowUpCommandService(mock.repository);
    await service.transitionTaskWithTimeline({attribution,taskId:'task-a',nextStatus:'in_progress',actorId:'operator-a',actorRole:'consultant',occurredAt:'2026-08-10T02:00:00.000Z'});
    expect(mock.transitionTaskWithTimeline).toHaveBeenCalledWith({tenantId:'tenant-a',institutionId:'institution-a',taskId:'task-a',nextStatus:'in_progress',actorId:'operator-a',actorRole:'consultant',occurredAt:'2026-08-10T02:00:00.000Z'});
  });
  it('path bundle rejects cross-reference drift',async()=>{
    const mock=repositoryMock(); const service=createFollowUpCommandService(mock.repository);
    await expect(service.createPathEnrollmentBundle({attribution,actorRole:'tenant_admin',occurredAt:'2026-08-10T03:00:00.000Z',enrollment:{id:'enrollment-a',customerId:'customer-a',treatmentSummaryId:'summary-a',sourceType:'treatment_summary',sourceId:'summary-a',templateKey:'hydro_injection_care',templateVersion:'v0.6-static',templateSnapshotJson:{},startedAt:'2026-08-10T03:00:00.000Z',safeReasonCode:'treatment_summary_path_enrolled',metadataJson:{}},tasks:[{id:'task-a',customerId:'customer-other',journeyId:'journey-a',stage:'D1',status:'scheduled',dueAt:'2026-08-11T03:00:00.000Z',suggestedAction:'manual',riskLevel:'normal',sourceTreatmentSummaryId:'summary-a',sourceSuggestionKey:'summary-a:path:D1'}],stages:[]})).rejects.toThrow('invalid_path_task_reference');
    expect(mock.createPathEnrollmentBundle).not.toHaveBeenCalled();
  });
  it('timeline evidence validates canonical enums',async()=>{
    const mock=repositoryMock(); const service=createFollowUpCommandService(mock.repository);
    await service.recordTimelineEvidence({attribution,event:{id:'event-a',customerId:'customer-a',sourceType:'followup_task',sourceId:'task-a:in_progress',eventType:'followup_task_status_changed',eventTitle:'状态变化',safeSummary:'人工随访状态变化。',riskLevel:null,occurredAt:'2026-08-10T04:00:00.000Z',safeActorRole:'consultant',safeReasonCode:'followup_task_status_changed',metadataJson:{}}});
    expect(mock.recordTimelineEvidence).toHaveBeenCalledWith(expect.objectContaining({tenantId:'tenant-a',institutionId:'institution-a',sourceType:'followup_task',eventType:'followup_task_status_changed'}));
  });
});
