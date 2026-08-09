import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  CareFollowUpAtomicWriteError,
  isFollowUpTransitionAllowed,
  type CancelPathEnrollmentResult,
  type CreateManualTaskResult,
  type CreatePathEnrollmentBundleResult,
  type CreateTreatmentSourceTaskResult,
  type FollowUpCommandRepository,
  type FollowUpCommandStatus,
  type FollowUpPathEnrollmentCommandRecord,
  type FollowUpPathStageCommandRecord,
  type FollowUpTaskCommandRecord,
  type FollowUpTimelineCommandRecord,
  type RecordTimelineEvidenceResult,
  type TransitionTaskResult,
} from '@/modules/care/application/follow-up-command-service';
import type { TenantDatabase } from '@/server/db/client';
import { customers, followUpCustomerTimelineEvents, followUpPathEnrollments, followUpPathStages, followUpTasks, treatmentSummaries } from '@/server/db/schema';

type CustomerRow=typeof customers.$inferSelect;
type FollowUpTaskRow=typeof followUpTasks.$inferSelect;
type FollowUpPathEnrollmentRow=typeof followUpPathEnrollments.$inferSelect;
type FollowUpPathStageRow=typeof followUpPathStages.$inferSelect;
type FollowUpTimelineRow=typeof followUpCustomerTimelineEvents.$inferSelect;
const activeSourceStatuses:FollowUpCommandStatus[]=['scheduled','due','in_progress','escalated'];
const pathSafeMessage='路径任务需人工处理，不会主动向客户发送消息。';

function mapTaskRow(row:FollowUpTaskRow,institutionId:string):FollowUpTaskCommandRecord|null {
  if(row.institutionId!==institutionId) return null;
  const hasSource=Boolean(row.sourceTreatmentSummaryId&&row.sourceSuggestionKey);
  return {id:row.id,tenantId:row.tenantId,institutionId:row.institutionId,customerId:row.customerId,customerDisplayName:row.customerDisplayName,
    journeyId:row.journeyId,stage:row.stage,status:row.status,dueAt:row.dueAt.toISOString(),suggestedAction:row.suggestedAction,riskLevel:row.riskLevel,
    updatedBy:row.updatedBy,updatedAt:row.updatedAt?.toISOString()??null,source:hasSource?'treatment_summary':null,
    sourceTreatmentSummaryId:hasSource?row.sourceTreatmentSummaryId:null,sourceSuggestionKey:hasSource?row.sourceSuggestionKey:null,
    requiresHumanHandling:true,forbidAutoReachOut:true};
}
function mapStageRow(row:FollowUpPathStageRow,institutionId:string):FollowUpPathStageCommandRecord|null {
  if(row.institutionId!==institutionId) return null;
  return {id:row.id,tenantId:row.tenantId,institutionId:row.institutionId,enrollmentId:row.enrollmentId,nodeKey:row.nodeKey,stageKey:row.stageKey,
    dueAt:row.dueAt.toISOString(),status:row.status,followUpTaskId:row.followUpTaskId,handlerRole:row.handlerRole,riskLevel:row.riskLevel,
    safeMessage:row.safeMessage,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()};
}
function mapEnrollmentRow(input:{row:FollowUpPathEnrollmentRow;customer:Pick<CustomerRow,'displayName'>;stages:FollowUpPathStageCommandRecord[]}):FollowUpPathEnrollmentCommandRecord|null {
  const institutionId=input.row.institutionId;
  if(!institutionId) return null;
  const taskIds=input.stages.map(s=>s.followUpTaskId).filter((id):id is string=>Boolean(id));
  const dueAt=input.stages.filter(s=>s.status!=='completed'&&s.status!=='cancelled').sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt))[0]?.dueAt
    ?? [...input.stages].sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt))[0]?.dueAt ?? null;
  return {id:input.row.id,tenantId:input.row.tenantId,institutionId,customerId:input.row.customerId,customerDisplayName:input.customer.displayName,
    treatmentSummaryId:input.row.treatmentSummaryId??input.row.sourceId,sourceType:'treatment_summary',sourceId:input.row.sourceId,templateKey:input.row.templateKey,
    templateVersion:input.row.templateVersion,status:input.row.status,startedAt:input.row.startedAt.toISOString(),completedAt:input.row.completedAt?.toISOString()??null,
    safeReasonCode:input.row.safeReasonCode,metadataJson:input.row.metadataJson,stageCount:input.stages.length,taskCount:taskIds.length,dueAt,safeMessage:pathSafeMessage,
    taskIds,stages:input.stages,createdAt:input.row.createdAt.toISOString(),updatedAt:input.row.updatedAt.toISOString()};
}
function mapTimelineRow(row:FollowUpTimelineRow,institutionId:string):FollowUpTimelineCommandRecord|null {
  if(row.institutionId!==institutionId) return null;
  return {id:row.id,tenantId:row.tenantId,institutionId:row.institutionId,customerId:row.customerId,sourceType:row.sourceType,sourceId:row.sourceId,eventType:row.eventType,
    eventTitle:row.eventTitle,safeSummary:row.safeSummary,riskLevel:row.riskLevel,occurredAt:row.occurredAt.toISOString(),safeActorRole:row.safeActorRole,
    safeReasonCode:row.safeReasonCode,metadataJson:row.metadataJson,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()};
}
async function customerOwned(database:TenantDatabase,input:{tenantId:string;institutionId:string;customerId:string}) {
  const [row]=await database.select({id:customers.id,displayName:customers.displayName}).from(customers).where(and(
    eq(customers.tenantId,input.tenantId),eq(customers.institutionId,input.institutionId),eq(customers.id,input.customerId)));
  return row??null;
}
async function treatmentSummaryOwned(database:TenantDatabase,input:{tenantId:string;institutionId:string;customerId:string;treatmentSummaryId:string}) {
  const [row]=await database.select({id:treatmentSummaries.id}).from(treatmentSummaries).where(and(
    eq(treatmentSummaries.tenantId,input.tenantId),eq(treatmentSummaries.institutionId,input.institutionId),eq(treatmentSummaries.customerId,input.customerId),
    eq(treatmentSummaries.id,input.treatmentSummaryId),isNull(treatmentSummaries.voidedAt)));
  return Boolean(row);
}
async function findActiveSourceTask(database:TenantDatabase,input:{tenantId:string;institutionId:string;customerId:string;sourceTreatmentSummaryId:string;sourceSuggestionKey:string}) {
  const [row]=await database.select().from(followUpTasks).where(and(eq(followUpTasks.tenantId,input.tenantId),eq(followUpTasks.institutionId,input.institutionId),
    eq(followUpTasks.customerId,input.customerId),eq(followUpTasks.sourceTreatmentSummaryId,input.sourceTreatmentSummaryId),
    eq(followUpTasks.sourceSuggestionKey,input.sourceSuggestionKey),inArray(followUpTasks.status,activeSourceStatuses)));
  return row??null;
}
async function findActiveEnrollment(database:TenantDatabase,input:{tenantId:string;institutionId:string;customerId:string;sourceId:string;templateKey:string}) {
  const [row]=await database.select().from(followUpPathEnrollments).where(and(eq(followUpPathEnrollments.tenantId,input.tenantId),
    eq(followUpPathEnrollments.institutionId,input.institutionId),eq(followUpPathEnrollments.customerId,input.customerId),eq(followUpPathEnrollments.sourceType,'treatment_summary'),
    eq(followUpPathEnrollments.sourceId,input.sourceId),eq(followUpPathEnrollments.templateKey,input.templateKey),eq(followUpPathEnrollments.status,'active')));
  return row??null;
}
function sourceRootId(sourceId:string){ return sourceId.split(':')[0]??sourceId; }
async function typedTimelineSourceOwned(database:TenantDatabase,input:Parameters<FollowUpCommandRepository['recordTimelineEvidence']>[0]) {
  if(input.sourceType==='path_enrollment'){
    const [row]=await database.select({id:followUpPathEnrollments.id}).from(followUpPathEnrollments).where(and(
      eq(followUpPathEnrollments.tenantId,input.tenantId),eq(followUpPathEnrollments.institutionId,input.institutionId),
      eq(followUpPathEnrollments.customerId,input.customerId),eq(followUpPathEnrollments.id,sourceRootId(input.sourceId))));
    return Boolean(row);
  }
  if(input.sourceType==='followup_task'){
    const [row]=await database.select({id:followUpTasks.id}).from(followUpTasks).where(and(eq(followUpTasks.tenantId,input.tenantId),
      eq(followUpTasks.institutionId,input.institutionId),eq(followUpTasks.customerId,input.customerId),eq(followUpTasks.id,sourceRootId(input.sourceId))));
    return Boolean(row);
  }
  return true;
}
async function recordTimelineEvidenceInternal(database:TenantDatabase,input:Parameters<FollowUpCommandRepository['recordTimelineEvidence']>[0]):Promise<RecordTimelineEvidenceResult> {
  if(!(await customerOwned(database,input))) return {kind:'not_found_or_not_owned'};
  if(!(await typedTimelineSourceOwned(database,input))) return {kind:'not_found_or_not_owned'};
  const where=and(eq(followUpCustomerTimelineEvents.tenantId,input.tenantId),eq(followUpCustomerTimelineEvents.institutionId,input.institutionId),
    eq(followUpCustomerTimelineEvents.customerId,input.customerId),eq(followUpCustomerTimelineEvents.sourceType,input.sourceType),
    eq(followUpCustomerTimelineEvents.sourceId,input.sourceId),eq(followUpCustomerTimelineEvents.eventType,input.eventType));
  const [existing]=await database.select().from(followUpCustomerTimelineEvents).where(where);
  if(existing){ const event=mapTimelineRow(existing,input.institutionId); return event?{kind:'exists',event}:{kind:'not_found_or_not_owned'}; }
  const occurredAt=new Date(input.occurredAt);
  const [row]=await database.insert(followUpCustomerTimelineEvents).values({id:input.id,tenantId:input.tenantId,institutionId:input.institutionId,
    customerId:input.customerId,sourceType:input.sourceType,sourceId:input.sourceId,eventType:input.eventType,eventTitle:input.eventTitle,safeSummary:input.safeSummary,
    riskLevel:input.riskLevel,occurredAt,safeActorRole:input.safeActorRole,safeReasonCode:input.safeReasonCode,metadataJson:input.metadataJson,createdAt:occurredAt,updatedAt:occurredAt})
    .onConflictDoNothing().returning();
  if(row){ const event=mapTimelineRow(row,input.institutionId); return event?{kind:'created',event}:{kind:'not_found_or_not_owned'}; }
  const [concurrent]=await database.select().from(followUpCustomerTimelineEvents).where(where);
  if(!concurrent) return {kind:'not_found_or_not_owned'};
  const event=mapTimelineRow(concurrent,input.institutionId); return event?{kind:'exists',event}:{kind:'not_found_or_not_owned'};
}
async function requireTimelineEvidence(database:TenantDatabase,input:Parameters<FollowUpCommandRepository['recordTimelineEvidence']>[0]) {
  const result=await recordTimelineEvidenceInternal(database,input);
  if(result.kind==='not_found_or_not_owned') throw new CareFollowUpAtomicWriteError('required_timeline_evidence_failed',input.sourceId);
  return result;
}

export function createFollowUpCommandRepository(database:TenantDatabase):FollowUpCommandRepository {
  return Object.freeze({
    async createTreatmentSourceTask(input:Parameters<FollowUpCommandRepository['createTreatmentSourceTask']>[0]):Promise<CreateTreatmentSourceTaskResult>{
      const customer=await customerOwned(database,input); if(!customer) return {kind:'not_found_or_not_owned'};
      if(!(await treatmentSummaryOwned(database,{...input,treatmentSummaryId:input.sourceTreatmentSummaryId}))) return {kind:'not_found_or_not_owned'};
      const existing=await findActiveSourceTask(database,input); if(existing) return {kind:'conflict',resourceId:existing.id,reason:'active_source_follow_up_exists'};
      const [row]=await database.insert(followUpTasks).values({id:input.id,tenantId:input.tenantId,institutionId:input.institutionId,customerId:input.customerId,
        customerDisplayName:customer.displayName,journeyId:input.journeyId,stage:input.stage,status:input.status??'scheduled',dueAt:new Date(input.dueAt),suggestedAction:input.suggestedAction,
        riskLevel:input.riskLevel,sourceTreatmentSummaryId:input.sourceTreatmentSummaryId,sourceSuggestionKey:input.sourceSuggestionKey}).onConflictDoNothing().returning();
      if(!row){ const concurrent=await findActiveSourceTask(database,input); return {kind:'conflict',resourceId:concurrent?.id??input.id,reason:'active_source_follow_up_exists'}; }
      const task=mapTaskRow(row,input.institutionId); return task?{kind:'created',task}:{kind:'not_found_or_not_owned'};
    },
    async createManualTask(input:Parameters<FollowUpCommandRepository['createManualTask']>[0]):Promise<CreateManualTaskResult>{
      const customer=await customerOwned(database,input); if(!customer) return {kind:'not_found_or_not_owned'};
      const [row]=await database.insert(followUpTasks).values({id:input.id,tenantId:input.tenantId,institutionId:input.institutionId,customerId:input.customerId,
        customerDisplayName:customer.displayName,journeyId:input.journeyId,stage:input.stage,status:input.status,dueAt:new Date(input.dueAt),suggestedAction:input.suggestedAction,
        riskLevel:input.riskLevel,sourceTreatmentSummaryId:null,sourceSuggestionKey:null}).onConflictDoNothing().returning();
      if(!row) return {kind:'conflict',resourceId:input.id,reason:'follow_up_task_conflict'};
      const task=mapTaskRow(row,input.institutionId); return task?{kind:'created',task}:{kind:'not_found_or_not_owned'};
    },
    async transitionTaskWithTimeline(input:Parameters<FollowUpCommandRepository['transitionTaskWithTimeline']>[0]):Promise<TransitionTaskResult>{
      const [current]=await database.select().from(followUpTasks).where(and(eq(followUpTasks.tenantId,input.tenantId),eq(followUpTasks.institutionId,input.institutionId),eq(followUpTasks.id,input.taskId)));
      if(!current) return {kind:'not_found_or_not_owned'};
      if(!(await customerOwned(database,{tenantId:input.tenantId,institutionId:input.institutionId,customerId:current.customerId}))) return {kind:'not_found_or_not_owned'};
      if(!isFollowUpTransitionAllowed(current.status,input.nextStatus)) return {kind:'invalid_transition',resourceId:current.id,from:current.status,to:input.nextStatus};
      const observedUpdatedAtCondition=current.updatedAt?eq(followUpTasks.updatedAt,current.updatedAt):isNull(followUpTasks.updatedAt);
      const [updated]=await database.update(followUpTasks).set({status:input.nextStatus,updatedBy:input.actorId,updatedAt:new Date(input.occurredAt)}).where(and(
        eq(followUpTasks.tenantId,input.tenantId),eq(followUpTasks.institutionId,input.institutionId),eq(followUpTasks.customerId,current.customerId),eq(followUpTasks.id,input.taskId),
        eq(followUpTasks.status,current.status),observedUpdatedAtCondition)).returning();
      if(!updated) return {kind:'conflict',resourceId:current.id,reason:'stale_transition'};
      const task=mapTaskRow(updated,input.institutionId); if(!task) return {kind:'not_found_or_not_owned'};
      const escalated=task.status==='escalated';
      await requireTimelineEvidence(database,{tenantId:input.tenantId,institutionId:input.institutionId,id:globalThis.crypto.randomUUID(),customerId:task.customerId,
        sourceType:'followup_task',sourceId:`${task.id}:${task.status}`,eventType:escalated?'followup_task_escalated':'followup_task_status_changed',
        eventTitle:escalated?'随访任务风险升级':'随访任务状态变化',safeSummary:`${task.stage} 已流转为 ${task.status}，仍需人工处理。`,riskLevel:escalated?task.riskLevel:null,
        occurredAt:input.occurredAt,safeActorRole:input.actorRole,safeReasonCode:escalated?'followup_task_escalated':'followup_task_status_changed',
        metadataJson:{status:task.status,riskLevel:task.riskLevel,requiresHumanHandling:true,forbidAutoReachOut:true}});
      return {kind:'updated',task};
    },
    async createPathEnrollmentBundle(input:Parameters<FollowUpCommandRepository['createPathEnrollmentBundle']>[0]):Promise<CreatePathEnrollmentBundleResult>{
      const customer=await customerOwned(database,{tenantId:input.tenantId,institutionId:input.institutionId,customerId:input.enrollment.customerId});
      if(!customer) return {kind:'not_found_or_not_owned'};
      if(!(await treatmentSummaryOwned(database,{tenantId:input.tenantId,institutionId:input.institutionId,customerId:input.enrollment.customerId,treatmentSummaryId:input.enrollment.treatmentSummaryId}))) return {kind:'not_found_or_not_owned'};
      const existingEnrollment=await findActiveEnrollment(database,{tenantId:input.tenantId,institutionId:input.institutionId,customerId:input.enrollment.customerId,sourceId:input.enrollment.sourceId,templateKey:input.enrollment.templateKey});
      if(existingEnrollment) return {kind:'conflict',resourceId:existingEnrollment.id,reason:'active_follow_up_path_enrollment_exists'};
      for(const task of input.tasks){ const existingTask=await findActiveSourceTask(database,{tenantId:input.tenantId,institutionId:input.institutionId,customerId:task.customerId,sourceTreatmentSummaryId:task.sourceTreatmentSummaryId,sourceSuggestionKey:task.sourceSuggestionKey});
        if(existingTask) throw new CareFollowUpAtomicWriteError('active_source_follow_up_exists',existingTask.id); }
      const [enrollmentRow]=await database.insert(followUpPathEnrollments).values({id:input.enrollment.id,tenantId:input.tenantId,institutionId:input.institutionId,
        customerId:input.enrollment.customerId,treatmentSummaryId:input.enrollment.treatmentSummaryId,sourceType:'treatment_summary',sourceId:input.enrollment.sourceId,
        templateKey:input.enrollment.templateKey,templateVersion:input.enrollment.templateVersion,templateSnapshotJson:input.enrollment.templateSnapshotJson,status:'active',
        startedAt:new Date(input.enrollment.startedAt),completedAt:null,safeReasonCode:input.enrollment.safeReasonCode,metadataJson:input.enrollment.metadataJson}).onConflictDoNothing().returning();
      if(!enrollmentRow){ const concurrent=await findActiveEnrollment(database,{tenantId:input.tenantId,institutionId:input.institutionId,customerId:input.enrollment.customerId,sourceId:input.enrollment.sourceId,templateKey:input.enrollment.templateKey});
        return {kind:'conflict',resourceId:concurrent?.id??input.enrollment.id,reason:'active_follow_up_path_enrollment_exists'}; }
      const taskRows:FollowUpTaskRow[]=[];
      for(const task of input.tasks){ const [taskRow]=await database.insert(followUpTasks).values({id:task.id,tenantId:input.tenantId,institutionId:input.institutionId,customerId:task.customerId,
          customerDisplayName:customer.displayName,journeyId:task.journeyId,stage:task.stage,status:task.status,dueAt:new Date(task.dueAt),suggestedAction:task.suggestedAction,riskLevel:task.riskLevel,
          sourceTreatmentSummaryId:task.sourceTreatmentSummaryId,sourceSuggestionKey:task.sourceSuggestionKey}).onConflictDoNothing().returning();
        if(!taskRow){ const concurrent=await findActiveSourceTask(database,{tenantId:input.tenantId,institutionId:input.institutionId,customerId:task.customerId,sourceTreatmentSummaryId:task.sourceTreatmentSummaryId,sourceSuggestionKey:task.sourceSuggestionKey});
          throw new CareFollowUpAtomicWriteError('active_source_follow_up_exists',concurrent?.id??task.id); } taskRows.push(taskRow); }
      const expectedTaskIds=new Set(taskRows.map(row=>row.id));
      for(const stage of input.stages){ if(stage.enrollmentId!==enrollmentRow.id||(stage.followUpTaskId&&!expectedTaskIds.has(stage.followUpTaskId))) throw new CareFollowUpAtomicWriteError('path_bundle_write_failed',stage.id); }
      const stageRows=input.stages.length===0?[]:await database.insert(followUpPathStages).values(input.stages.map(stage=>({id:stage.id,tenantId:input.tenantId,institutionId:input.institutionId,
        enrollmentId:enrollmentRow.id,nodeKey:stage.nodeKey,stageKey:stage.stageKey,dueAt:new Date(stage.dueAt),status:stage.status,followUpTaskId:stage.followUpTaskId,handlerRole:stage.handlerRole,
        riskLevel:stage.riskLevel,safeMessage:stage.safeMessage,createdAt:new Date(stage.createdAt),updatedAt:new Date(stage.updatedAt)}))).returning();
      if(stageRows.length!==input.stages.length) throw new CareFollowUpAtomicWriteError('path_bundle_write_failed',enrollmentRow.id);
      const mappedStages=stageRows.flatMap(row=>{const mapped=mapStageRow(row,input.institutionId);return mapped?[mapped]:[];});
      if(mappedStages.length!==stageRows.length) throw new CareFollowUpAtomicWriteError('path_bundle_write_failed',enrollmentRow.id);
      await requireTimelineEvidence(database,{tenantId:input.tenantId,institutionId:input.institutionId,id:globalThis.crypto.randomUUID(),customerId:enrollmentRow.customerId,
        sourceType:'path_enrollment',sourceId:enrollmentRow.id,eventType:'followup_path_enrolled',eventTitle:'纳入随访路径',
        safeSummary:`${customer.displayName} 已纳入 ${enrollmentRow.templateKey}，阶段 ${mappedStages.length} 个，任务 ${taskRows.length} 个。`,riskLevel:null,occurredAt:input.occurredAt,
        safeActorRole:input.actorRole,safeReasonCode:'followup_path_enrolled',metadataJson:{templateKey:enrollmentRow.templateKey,status:enrollmentRow.status,stageCount:mappedStages.length,taskCount:taskRows.length,forbidAutoReachOut:true}});
      await requireTimelineEvidence(database,{tenantId:input.tenantId,institutionId:input.institutionId,id:globalThis.crypto.randomUUID(),customerId:enrollmentRow.customerId,
        sourceType:'path_enrollment',sourceId:`${enrollmentRow.id}:tasks_generated`,eventType:'followup_tasks_generated',eventTitle:'生成阶段随访任务',
        safeSummary:`已按 ${enrollmentRow.templateKey} 生成 ${taskRows.length} 个人工随访任务，不会自动联系客户。`,riskLevel:null,occurredAt:input.occurredAt,
        safeActorRole:input.actorRole,safeReasonCode:'followup_tasks_generated',metadataJson:{templateKey:enrollmentRow.templateKey,stageCount:mappedStages.length,taskCount:taskRows.length,forbidAutoReachOut:true}});
      const enrollment=mapEnrollmentRow({row:enrollmentRow,customer,stages:mappedStages});
      if(!enrollment) throw new CareFollowUpAtomicWriteError('path_bundle_write_failed',enrollmentRow.id);
      return {kind:'created',enrollment};
    },
    async cancelPathEnrollmentWithTimeline(input:Parameters<FollowUpCommandRepository['cancelPathEnrollmentWithTimeline']>[0]):Promise<CancelPathEnrollmentResult>{
      const [current]=await database.select().from(followUpPathEnrollments).where(and(eq(followUpPathEnrollments.tenantId,input.tenantId),
        eq(followUpPathEnrollments.institutionId,input.institutionId),eq(followUpPathEnrollments.id,input.enrollmentId)));
      if(!current) return {kind:'not_found_or_not_owned'};
      const customer=await customerOwned(database,{tenantId:input.tenantId,institutionId:input.institutionId,customerId:current.customerId});
      if(!customer) return {kind:'not_found_or_not_owned'};
      if(current.status!=='active') return {kind:'conflict',resourceId:current.id,reason:'follow_up_path_enrollment_not_active'};
      const occurredAt=new Date(input.occurredAt);
      const [updated]=await database.update(followUpPathEnrollments).set({status:'cancelled',completedAt:occurredAt,updatedAt:occurredAt}).where(and(
        eq(followUpPathEnrollments.tenantId,input.tenantId),eq(followUpPathEnrollments.institutionId,input.institutionId),eq(followUpPathEnrollments.customerId,current.customerId),
        eq(followUpPathEnrollments.id,input.enrollmentId),eq(followUpPathEnrollments.status,'active'),eq(followUpPathEnrollments.updatedAt,current.updatedAt))).returning();
      if(!updated) return {kind:'conflict',resourceId:current.id,reason:'follow_up_path_enrollment_not_active'};
      await requireTimelineEvidence(database,{tenantId:input.tenantId,institutionId:input.institutionId,id:globalThis.crypto.randomUUID(),customerId:updated.customerId,
        sourceType:'path_enrollment',sourceId:updated.id,eventType:'followup_path_cancelled',eventTitle:'取消随访路径',safeSummary:`${customer.displayName} 已取消 ${updated.templateKey}。`,
        riskLevel:null,occurredAt:input.occurredAt,safeActorRole:input.actorRole,safeReasonCode:'followup_path_cancelled',metadataJson:{templateKey:updated.templateKey,status:updated.status,forbidAutoReachOut:true}});
      const stageRows=await database.select().from(followUpPathStages).where(and(eq(followUpPathStages.tenantId,input.tenantId),eq(followUpPathStages.institutionId,input.institutionId),eq(followUpPathStages.enrollmentId,updated.id)));
      const stages=stageRows.flatMap(row=>{const mapped=mapStageRow(row,input.institutionId);return mapped?[mapped]:[];});
      const enrollment=mapEnrollmentRow({row:updated,customer,stages});
      return enrollment?{kind:'cancelled',enrollment}:{kind:'not_found_or_not_owned'};
    },
    async recordTimelineEvidence(input:Parameters<FollowUpCommandRepository['recordTimelineEvidence']>[0]){ return recordTimelineEvidenceInternal(database,input); },
  });
}
