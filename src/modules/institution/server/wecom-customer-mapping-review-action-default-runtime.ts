import {
  readWeComCustomerMappingCandidateReference,
} from '@/modules/institution/server/wecom-customer-mapping-candidates-reader';
import {
  createWeComCustomerMappingReviewActionMockRuntime,
  type WeComCustomerMappingReviewMockFixture,
} from '@/modules/institution/server/wecom-customer-mapping-review-action-mock-runtime';

const candidateProjectionFixtures: readonly WeComCustomerMappingReviewMockFixture[] = [
  ['trial-tenant-yunlan', 'trial-inst-yunlan', 'mock-wecom-mapping-yunlan-001'],
  ['trial-tenant-baiyue', 'trial-inst-baiyue', 'mock-wecom-mapping-baiyue-001'],
  ['starter-tenant-xinghe', 'starter-inst-xinghe', 'mock-wecom-mapping-xinghe-001'],
  ['starter-tenant-yubai', 'starter-inst-yubai', 'mock-wecom-mapping-yubai-001'],
  ['growth-tenant-chengxing', 'growth-inst-chengxing', 'mock-wecom-mapping-pending-001'],
  ['growth-tenant-qingmang', 'growth-inst-qingmang', 'mock-wecom-mapping-qingmang-001'],
].map(([tenantId, institutionId, mappingId]) => Object.freeze({
  mappingId,
  tenantId,
  institutionId,
  state: 'pending_review' as const,
  version: 0,
  candidateReference:
    readWeComCustomerMappingCandidateReference(tenantId)!,
}));

const defaultWeComCustomerMappingReviewMockFixtures:
readonly WeComCustomerMappingReviewMockFixture[] = Object.freeze([
  ...candidateProjectionFixtures,
  Object.freeze({
    mappingId: 'mock-wecom-mapping-conflict-001',
    tenantId: 'growth-tenant-chengxing',
    institutionId: 'growth-inst-chengxing',
    state: 'conflict',
    version: 1,
  }),
  Object.freeze({
    mappingId: 'mock-wecom-mapping-disabled-001',
    tenantId: 'growth-tenant-chengxing',
    institutionId: 'growth-inst-chengxing',
    state: 'disabled',
    version: 1,
  }),
]);

export const weComCustomerMappingReviewActionMockRuntime =
  createWeComCustomerMappingReviewActionMockRuntime({
    fixtures: defaultWeComCustomerMappingReviewMockFixtures,
  });
