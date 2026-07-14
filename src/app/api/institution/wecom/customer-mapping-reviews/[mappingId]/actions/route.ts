import { createWeComCustomerMappingReviewActionsPostHandler } from './handler';
import { weComCustomerMappingReviewActionMockRuntime } from '@/modules/institution/server/wecom-customer-mapping-review-action-mock-runtime';

export const POST = createWeComCustomerMappingReviewActionsPostHandler({
  runtime: weComCustomerMappingReviewActionMockRuntime,
});
