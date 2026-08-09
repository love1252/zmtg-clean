export const followUpCommandStatuses = [
  'scheduled', 'due', 'in_progress', 'escalated', 'completed', 'cancelled',
] as const;
export type FollowUpCommandStatus = (typeof followUpCommandStatuses)[number];
export const followUpCommandRiskLevels = ['normal', 'watch', 'urgent'] as const;
export type FollowUpCommandRiskLevel = (typeof followUpCommandRiskLevels)[number];
export const followUpTimelineSourceTypes = ['path_enrollment','followup_task','message_draft','manual_note'] as const;
export type FollowUpTimelineSourceType = (typeof followUpTimelineSourceTypes)[number];
export const followUpTimelineEventTypes = [
  'followup_path_enrolled','followup_path_cancelled','followup_tasks_generated',
  'followup_task_status_changed','followup_task_escalated','message_draft_created',
  'message_draft_updated','message_draft_approved','message_draft_rejected',
  'message_draft_marked_sent','manual_feedback_recorded',
] as const;
export type FollowUpTimelineEventType = (typeof followUpTimelineEventTypes)[number];

export type CareFollowUpAttribution = Readonly<{ tenantId: string; institutionId: string }>;
export type FollowUpTaskCommandRecord = CareFollowUpAttribution & Readonly<{
  id:string; customerId:string; customerDisplayName:string; journeyId:string; stage:string;
  status:FollowUpCommandStatus; dueAt:string; suggestedAction:string; riskLevel:FollowUpCommandRiskLevel;
  updatedBy:string|null; updatedAt:string|null; source:'treatment_summary'|null;
  sourceTreatmentSummaryId:string|null; sourceSuggestionKey:string|null;
  requiresHumanHandling:true; forbidAutoReachOut:true;
}>;
export type FollowUpPathStageCommandRecord = CareFollowUpAttribution & Readonly<{
  id:string; enrollmentId:string; nodeKey:string; stageKey:string; dueAt:string; status:FollowUpCommandStatus;
  followUpTaskId:string|null; handlerRole:string; riskLevel:FollowUpCommandRiskLevel; safeMessage:string;
  createdAt:string; updatedAt:string;
}>;
export type FollowUpPathEnrollmentCommandRecord = CareFollowUpAttribution & Readonly<{
  id:string; customerId:string; customerDisplayName:string; treatmentSummaryId:string; sourceType:'treatment_summary';
  sourceId:string; templateKey:string; templateVersion:string; status:'active'|'completed'|'cancelled';
  startedAt:string; completedAt:string|null; safeReasonCode:string; metadataJson:Record<string,unknown>;
  stageCount:number; taskCount:number; dueAt:string|null; safeMessage:string; taskIds:string[];
  stages:FollowUpPathStageCommandRecord[]; createdAt:string; updatedAt:string;
}>;
export type FollowUpTimelineCommandRecord = CareFollowUpAttribution & Readonly<{
  id:string; customerId:string; sourceType:FollowUpTimelineSourceType; sourceId:string;
  eventType:FollowUpTimelineEventType; eventTitle:string; safeSummary:string;
  riskLevel:FollowUpCommandRiskLevel|null; occurredAt:string; safeActorRole:string|null;
  safeReasonCode:string; metadataJson:Record<string,unknown>; createdAt:string; updatedAt:string;
}>;

export type CreateTreatmentSourceTaskResult =
  | {kind:'created'; task:FollowUpTaskCommandRecord} | {kind:'not_found_or_not_owned'}
  | {kind:'conflict'; resourceId:string; reason:'active_source_follow_up_exists'};
export type CreateManualTaskResult =
  | {kind:'created'; task:FollowUpTaskCommandRecord} | {kind:'not_found_or_not_owned'}
  | {kind:'conflict'; resourceId:string; reason:'follow_up_task_conflict'};
export type TransitionTaskResult =
  | {kind:'updated'; task:FollowUpTaskCommandRecord} | {kind:'not_found_or_not_owned'}
  | {kind:'invalid_transition'; resourceId:string; from:FollowUpCommandStatus; to:FollowUpCommandStatus}
  | {kind:'conflict'; resourceId:string; reason:'stale_transition'};
export type CreatePathEnrollmentBundleResult =
  | {kind:'created'; enrollment:FollowUpPathEnrollmentCommandRecord} | {kind:'not_found_or_not_owned'}
  | {kind:'conflict'; resourceId:string; reason:'active_follow_up_path_enrollment_exists'};
export type CancelPathEnrollmentResult =
  | {kind:'cancelled'; enrollment:FollowUpPathEnrollmentCommandRecord} | {kind:'not_found_or_not_owned'}
  | {kind:'conflict'; resourceId:string; reason:'follow_up_path_enrollment_not_active'};
export type RecordTimelineEvidenceResult =
  | {kind:'created'; event:FollowUpTimelineCommandRecord} | {kind:'exists'; event:FollowUpTimelineCommandRecord}
  | {kind:'not_found_or_not_owned'};

export type CreateTreatmentSourceTaskCommand = Readonly<{ attribution:CareFollowUpAttribution; task:Readonly<{
  id:string; customerId:string; journeyId:string; stage:string; status?:Extract<FollowUpCommandStatus,'scheduled'|'due'>;
  dueAt:string; suggestedAction:string; riskLevel:FollowUpCommandRiskLevel;
  sourceTreatmentSummaryId:string; sourceSuggestionKey:string;
}> }>;
export type CreateManualTaskCommand = Readonly<{ attribution:CareFollowUpAttribution; task:Readonly<{
  id:string; customerId:string; journeyId:string; stage:string; status:FollowUpCommandStatus;
  dueAt:string; suggestedAction:string; riskLevel:FollowUpCommandRiskLevel;
}> }>;
export type TransitionTaskCommand = Readonly<{ attribution:CareFollowUpAttribution; taskId:string;
  nextStatus:FollowUpCommandStatus; actorId:string; actorRole:string; occurredAt:string }>;
export type CreatePathEnrollmentBundleCommand = Readonly<{
  attribution:CareFollowUpAttribution; actorRole:string; occurredAt:string;
  enrollment:Readonly<{ id:string; customerId:string; treatmentSummaryId:string; sourceType:'treatment_summary';
    sourceId:string; templateKey:string; templateVersion:string; templateSnapshotJson:Record<string,unknown>;
    startedAt:string; safeReasonCode:string; metadataJson:Record<string,unknown> }>;
  tasks:readonly Readonly<{ id:string; customerId:string; journeyId:string; stage:string;
    status:Extract<FollowUpCommandStatus,'scheduled'|'due'>; dueAt:string; suggestedAction:string;
    riskLevel:FollowUpCommandRiskLevel; sourceTreatmentSummaryId:string; sourceSuggestionKey:string }>[];
  stages:readonly Readonly<{ id:string; enrollmentId:string; nodeKey:string; stageKey:string; dueAt:string;
    status:Extract<FollowUpCommandStatus,'scheduled'|'due'>; followUpTaskId:string|null; handlerRole:string;
    riskLevel:FollowUpCommandRiskLevel; safeMessage:string; createdAt:string; updatedAt:string }>[];
}>;
export type CancelPathEnrollmentCommand = Readonly<{ attribution:CareFollowUpAttribution; enrollmentId:string;
  actorRole:string; occurredAt:string }>;
export type RecordTimelineEvidenceCommand = Readonly<{ attribution:CareFollowUpAttribution; event:Readonly<{
  id:string; customerId:string; sourceType:FollowUpTimelineSourceType; sourceId:string; eventType:FollowUpTimelineEventType;
  eventTitle:string; safeSummary:string; riskLevel:FollowUpCommandRiskLevel|null; occurredAt:string;
  safeActorRole:string|null; safeReasonCode:string; metadataJson:Record<string,unknown> }> }>;

export interface FollowUpCommandRepository {
  createTreatmentSourceTask(input:CareFollowUpAttribution & CreateTreatmentSourceTaskCommand['task']):Promise<CreateTreatmentSourceTaskResult>;
  createManualTask(input:CareFollowUpAttribution & CreateManualTaskCommand['task']):Promise<CreateManualTaskResult>;
  transitionTaskWithTimeline(input:CareFollowUpAttribution & Omit<TransitionTaskCommand,'attribution'>):Promise<TransitionTaskResult>;
  createPathEnrollmentBundle(input:CareFollowUpAttribution & Omit<CreatePathEnrollmentBundleCommand,'attribution'>):Promise<CreatePathEnrollmentBundleResult>;
  cancelPathEnrollmentWithTimeline(input:CareFollowUpAttribution & Omit<CancelPathEnrollmentCommand,'attribution'>):Promise<CancelPathEnrollmentResult>;
  recordTimelineEvidence(input:CareFollowUpAttribution & RecordTimelineEvidenceCommand['event']):Promise<RecordTimelineEvidenceResult>;
}

export class CareFollowUpCommandInputError extends Error {
  constructor(message:string){ super(message); this.name='CareFollowUpCommandInputError'; }
}
export class CareFollowUpAtomicWriteError extends Error {
  readonly code:'active_source_follow_up_exists'|'path_bundle_write_failed'|'required_timeline_evidence_failed';
  readonly resourceId:string;
  constructor(code:CareFollowUpAtomicWriteError['code'],resourceId:string){ super(code); this.name='CareFollowUpAtomicWriteError'; this.code=code; this.resourceId=resourceId; }
}

function requireExactIdentifier(value:unknown,field:string):string {
  if(typeof value!=='string'||value.length===0||value.trim()!==value) throw new CareFollowUpCommandInputError(`invalid_${field}`);
  return value;
}
function copyString(value:unknown,field:string):string {
  if(typeof value!=='string') throw new CareFollowUpCommandInputError(`invalid_${field}`);
  return value;
}
function requireIsoTimestamp(value:unknown,field:string):string {
  if(typeof value!=='string'||value.trim()!==value||value.length===0) throw new CareFollowUpCommandInputError(`invalid_${field}`);
  const parsed=new Date(value); if(Number.isNaN(parsed.getTime())||parsed.toISOString()!==value) throw new CareFollowUpCommandInputError(`invalid_${field}`);
  return value;
}
function requireStatus(value:unknown):FollowUpCommandStatus {
  if(typeof value!=='string'||!followUpCommandStatuses.includes(value as FollowUpCommandStatus)) throw new CareFollowUpCommandInputError('invalid_follow_up_status');
  return value as FollowUpCommandStatus;
}
function requireRisk(value:unknown):FollowUpCommandRiskLevel {
  if(typeof value!=='string'||!followUpCommandRiskLevels.includes(value as FollowUpCommandRiskLevel)) throw new CareFollowUpCommandInputError('invalid_follow_up_risk_level');
  return value as FollowUpCommandRiskLevel;
}
function requireTimelineSource(value:unknown):FollowUpTimelineSourceType {
  if(typeof value!=='string'||!followUpTimelineSourceTypes.includes(value as FollowUpTimelineSourceType)) throw new CareFollowUpCommandInputError('invalid_timeline_source_type');
  return value as FollowUpTimelineSourceType;
}
function requireTimelineEvent(value:unknown):FollowUpTimelineEventType {
  if(typeof value!=='string'||!followUpTimelineEventTypes.includes(value as FollowUpTimelineEventType)) throw new CareFollowUpCommandInputError('invalid_timeline_event_type');
  return value as FollowUpTimelineEventType;
}
function normalizeAttribution(a:CareFollowUpAttribution):CareFollowUpAttribution {
  return {tenantId:requireExactIdentifier(a?.tenantId,'tenant_id'),institutionId:requireExactIdentifier(a?.institutionId,'institution_id')};
}
function copyMetadata(value:Record<string,unknown>){
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new CareFollowUpCommandInputError('invalid_metadata');
  return {...value};
}
export function isFollowUpTransitionAllowed(from:FollowUpCommandStatus,to:FollowUpCommandStatus){
  const allowed:Record<FollowUpCommandStatus,readonly FollowUpCommandStatus[]>={
    scheduled:['due','cancelled'],due:['in_progress','escalated','cancelled'],in_progress:['completed','escalated','cancelled'],
    escalated:['in_progress','completed','cancelled'],completed:[],cancelled:[],
  };
  return allowed[from].includes(to);
}

export function createFollowUpCommandService(repository:FollowUpCommandRepository){
  return Object.freeze({
    async createTreatmentSourceTask(input:CreateTreatmentSourceTaskCommand){
      return repository.createTreatmentSourceTask({...normalizeAttribution(input.attribution),id:requireExactIdentifier(input.task.id,'task_id'),
        customerId:requireExactIdentifier(input.task.customerId,'customer_id'),journeyId:requireExactIdentifier(input.task.journeyId,'journey_id'),
        stage:copyString(input.task.stage,'stage'),status:input.task.status??'scheduled',dueAt:requireIsoTimestamp(input.task.dueAt,'due_at'),
        suggestedAction:copyString(input.task.suggestedAction,'suggested_action'),riskLevel:requireRisk(input.task.riskLevel),
        sourceTreatmentSummaryId:requireExactIdentifier(input.task.sourceTreatmentSummaryId,'source_treatment_summary_id'),
        sourceSuggestionKey:requireExactIdentifier(input.task.sourceSuggestionKey,'source_suggestion_key')});
    },
    async createManualTask(input:CreateManualTaskCommand){
      return repository.createManualTask({...normalizeAttribution(input.attribution),id:requireExactIdentifier(input.task.id,'task_id'),
        customerId:requireExactIdentifier(input.task.customerId,'customer_id'),journeyId:requireExactIdentifier(input.task.journeyId,'journey_id'),
        stage:copyString(input.task.stage,'stage'),status:requireStatus(input.task.status),dueAt:requireIsoTimestamp(input.task.dueAt,'due_at'),
        suggestedAction:copyString(input.task.suggestedAction,'suggested_action'),riskLevel:requireRisk(input.task.riskLevel)});
    },
    async transitionTaskWithTimeline(input:TransitionTaskCommand){
      return repository.transitionTaskWithTimeline({...normalizeAttribution(input.attribution),taskId:requireExactIdentifier(input.taskId,'task_id'),
        nextStatus:requireStatus(input.nextStatus),actorId:requireExactIdentifier(input.actorId,'actor_id'),actorRole:requireExactIdentifier(input.actorRole,'actor_role'),
        occurredAt:requireIsoTimestamp(input.occurredAt,'occurred_at')});
    },
    async createPathEnrollmentBundle(input:CreatePathEnrollmentBundleCommand){
      const attribution=normalizeAttribution(input.attribution);
      const enrollment={id:requireExactIdentifier(input.enrollment.id,'enrollment_id'),customerId:requireExactIdentifier(input.enrollment.customerId,'customer_id'),
        treatmentSummaryId:requireExactIdentifier(input.enrollment.treatmentSummaryId,'treatment_summary_id'),sourceType:input.enrollment.sourceType,
        sourceId:requireExactIdentifier(input.enrollment.sourceId,'source_id'),templateKey:requireExactIdentifier(input.enrollment.templateKey,'template_key'),
        templateVersion:requireExactIdentifier(input.enrollment.templateVersion,'template_version'),templateSnapshotJson:copyMetadata(input.enrollment.templateSnapshotJson),
        startedAt:requireIsoTimestamp(input.enrollment.startedAt,'started_at'),safeReasonCode:requireExactIdentifier(input.enrollment.safeReasonCode,'safe_reason_code'),
        metadataJson:copyMetadata(input.enrollment.metadataJson)};
      if(enrollment.sourceType!=='treatment_summary'||enrollment.sourceId!==enrollment.treatmentSummaryId) throw new CareFollowUpCommandInputError('invalid_path_source');
      const tasks=input.tasks.map(task=>{
        if(task.customerId!==enrollment.customerId||task.sourceTreatmentSummaryId!==enrollment.treatmentSummaryId) throw new CareFollowUpCommandInputError('invalid_path_task_reference');
        return {id:requireExactIdentifier(task.id,'task_id'),customerId:requireExactIdentifier(task.customerId,'customer_id'),journeyId:requireExactIdentifier(task.journeyId,'journey_id'),
          stage:copyString(task.stage,'stage'),status:task.status,dueAt:requireIsoTimestamp(task.dueAt,'task_due_at'),suggestedAction:copyString(task.suggestedAction,'suggested_action'),
          riskLevel:requireRisk(task.riskLevel),sourceTreatmentSummaryId:requireExactIdentifier(task.sourceTreatmentSummaryId,'source_treatment_summary_id'),
          sourceSuggestionKey:requireExactIdentifier(task.sourceSuggestionKey,'source_suggestion_key')};
      });
      const taskIds=new Set(tasks.map(task=>task.id));
      const stages=input.stages.map(stage=>{
        if(stage.enrollmentId!==enrollment.id) throw new CareFollowUpCommandInputError('invalid_path_stage_enrollment');
        if(stage.followUpTaskId&&!taskIds.has(stage.followUpTaskId)) throw new CareFollowUpCommandInputError('invalid_path_stage_task');
        return {id:requireExactIdentifier(stage.id,'stage_id'),enrollmentId:requireExactIdentifier(stage.enrollmentId,'enrollment_id'),nodeKey:requireExactIdentifier(stage.nodeKey,'node_key'),
          stageKey:requireExactIdentifier(stage.stageKey,'stage_key'),dueAt:requireIsoTimestamp(stage.dueAt,'stage_due_at'),status:stage.status,
          followUpTaskId:stage.followUpTaskId?requireExactIdentifier(stage.followUpTaskId,'follow_up_task_id'):null,handlerRole:requireExactIdentifier(stage.handlerRole,'handler_role'),
          riskLevel:requireRisk(stage.riskLevel),safeMessage:copyString(stage.safeMessage,'safe_message'),createdAt:requireIsoTimestamp(stage.createdAt,'stage_created_at'),
          updatedAt:requireIsoTimestamp(stage.updatedAt,'stage_updated_at')};
      });
      return repository.createPathEnrollmentBundle({...attribution,actorRole:requireExactIdentifier(input.actorRole,'actor_role'),occurredAt:requireIsoTimestamp(input.occurredAt,'occurred_at'),enrollment,tasks,stages});
    },
    async cancelPathEnrollmentWithTimeline(input:CancelPathEnrollmentCommand){
      return repository.cancelPathEnrollmentWithTimeline({...normalizeAttribution(input.attribution),enrollmentId:requireExactIdentifier(input.enrollmentId,'enrollment_id'),
        actorRole:requireExactIdentifier(input.actorRole,'actor_role'),occurredAt:requireIsoTimestamp(input.occurredAt,'occurred_at')});
    },
    async recordTimelineEvidence(input:RecordTimelineEvidenceCommand){
      return repository.recordTimelineEvidence({...normalizeAttribution(input.attribution),id:requireExactIdentifier(input.event.id,'timeline_event_id'),
        customerId:requireExactIdentifier(input.event.customerId,'customer_id'),sourceType:requireTimelineSource(input.event.sourceType),sourceId:requireExactIdentifier(input.event.sourceId,'source_id'),
        eventType:requireTimelineEvent(input.event.eventType),eventTitle:copyString(input.event.eventTitle,'event_title'),safeSummary:copyString(input.event.safeSummary,'safe_summary'),
        riskLevel:input.event.riskLevel===null?null:requireRisk(input.event.riskLevel),occurredAt:requireIsoTimestamp(input.event.occurredAt,'occurred_at'),
        safeActorRole:input.event.safeActorRole===null?null:requireExactIdentifier(input.event.safeActorRole,'safe_actor_role'),
        safeReasonCode:requireExactIdentifier(input.event.safeReasonCode,'safe_reason_code'),metadataJson:copyMetadata(input.event.metadataJson)});
    },
  });
}
