import type {
  CapabilityStatusDecisionV1,
} from '@/modules/institution-contracts/v1/institution-capability';
import type {
  InstitutionCapabilityDefinitionV1,
  InstitutionCapabilityKeyV1,
  InstitutionCapabilityKindV1,
  InstitutionDiagnosticTargetCapabilityKeyV1,
} from '@/modules/institution-contracts/v1/institution-capability-registry';
import type { InstitutionSourceReadinessV1 } from '@/modules/institution-contracts/v1/institution-source';

type InstitutionActionCapabilityDefinitionV1 = Extract<
  InstitutionCapabilityDefinitionV1,
  { kind: 'action' }
>;

type InstitutionDiagnosticCapabilityDefinitionV1 = Extract<
  InstitutionCapabilityDefinitionV1,
  { key: InstitutionDiagnosticTargetCapabilityKeyV1 }
>;

export type WorkbenchCapabilityVisibleDecision = Exclude<
  CapabilityStatusDecisionV1,
  'hidden'
>;

export type WorkbenchCapabilityDiagnosticTargetViewModel = Readonly<{
  key: InstitutionDiagnosticTargetCapabilityKeyV1;
  label: InstitutionDiagnosticCapabilityDefinitionV1['label'];
  href: InstitutionDiagnosticCapabilityDefinitionV1['href'];
}>;

type WorkbenchCapabilitySummaryBaseViewModel = Readonly<{
  key: InstitutionCapabilityKeyV1;
  kind: InstitutionCapabilityKindV1;
  label: InstitutionCapabilityDefinitionV1['label'];
  decision: WorkbenchCapabilityVisibleDecision;
  safeSummary: string;
  diagnosticTarget: WorkbenchCapabilityDiagnosticTargetViewModel | null;
}>;

export type WorkbenchCapabilitySummaryViewModel =
  | (WorkbenchCapabilitySummaryBaseViewModel &
      Readonly<{
        dataStatus: 'current';
        observedAt: null;
      }>)
  | (WorkbenchCapabilitySummaryBaseViewModel &
      Readonly<{
        dataStatus: 'stale';
        decision: 'read_only';
        observedAt: string;
      }>);

export type WorkbenchQuickCreateItemViewModel = Readonly<{
  key: InstitutionActionCapabilityDefinitionV1['key'];
  label: InstitutionActionCapabilityDefinitionV1['label'];
  href: InstitutionActionCapabilityDefinitionV1['href'];
}>;

export type WorkbenchQuickCreateMenuViewModel = Readonly<{
  label: '新建';
  items: readonly WorkbenchQuickCreateItemViewModel[];
}>;

export type WorkbenchCapabilityProjectedReadiness = Exclude<
  InstitutionSourceReadinessV1,
  'denied' | 'disabled'
>;

export type WorkbenchCapabilityProjection =
  | Readonly<{
      status: 'blocked';
      summaries: readonly [];
      quickCreateMenu: null;
    }>
  | Readonly<{
      status: 'projected';
      sourceReadiness: WorkbenchCapabilityProjectedReadiness;
      summaries: readonly WorkbenchCapabilitySummaryViewModel[];
      quickCreateMenu: WorkbenchQuickCreateMenuViewModel | null;
    }>;
