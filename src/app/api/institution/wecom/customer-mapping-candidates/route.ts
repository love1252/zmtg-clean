import { createWeComCustomerMappingCandidatesGetHandler } from './handler';
import { weComCustomerMappingReviewActionMockRuntime } from '@/modules/institution/server/wecom-customer-mapping-review-action-default-runtime';

export const GET = createWeComCustomerMappingCandidatesGetHandler({
  snapshotReader: weComCustomerMappingReviewActionMockRuntime,
});
