## .ds_store (10)
- .DS_Store
- .claude/.DS_Store
- .gitnexus/.DS_Store
- docs/.DS_Store
- docs/design/.DS_Store
- docs/superpowers/.DS_Store
- drizzle/.DS_Store
- public/.DS_Store
- src/.DS_Store
- var/.DS_Store

## .gitignore (2)
- .gitignore
- .gitnexus/.gitignore

## 2026-07-06-v06-kb-end-to-end-acceptance-04a.md (2)
- docs/product/acceptance/2026-07-06-v06-kb-end-to-end-acceptance-04a.md
- docs/product/plans/2026-07-06-v06-kb-end-to-end-acceptance-04a.md

## _shared.ts (2)
- src/app/api/v1/open-platform/homepage-brand/_shared.ts
- src/app/api/v1/open-platform/plan-catalog/_shared.ts

## customer-import.ts (2)
- src/modules/institution/domain/customer-import.ts
- src/modules/institution/server/customer-import.ts

## handler.ts (2)
- src/app/api/institution/wecom/customer-mapping-candidates/handler.ts
- src/app/api/institution/wecom/customer-mapping-reviews/[mappingId]/actions/handler.ts

## index.json (2)
- .gitnexus/parse-cache/index.json
- .gitnexus/parsedfile-cache/index.json

## lbug (5)
- .gitnexus/branches/feat_v08-05a-production-channel-readiness-guard-01-27a36bfd/lbug
- .gitnexus/branches/feat_v08-05b-b2-mock-provider-contract-01-caeb6fa6/lbug
- .gitnexus/branches/feat_v08-05c-e1-wecom-customer-mapping-mock-domain-20260713-1f2f7b61/lbug
- .gitnexus/branches/main-0d6e4079/lbug
- .gitnexus/lbug

## meta.json (5)
- .gitnexus/branches/feat_v08-05a-production-channel-readiness-guard-01-27a36bfd/meta.json
- .gitnexus/branches/feat_v08-05b-b2-mock-provider-contract-01-caeb6fa6/meta.json
- .gitnexus/branches/feat_v08-05c-e1-wecom-customer-mapping-mock-domain-20260713-1f2f7b61/meta.json
- .gitnexus/branches/main-0d6e4079/meta.json
- .gitnexus/meta.json

## page.tsx (6)
- src/app/(auth)/login/page.tsx
- src/app/(auth)/platform-login/page.tsx
- src/app/(marketing)/page.tsx
- src/app/hospital/[...slug]/page.tsx
- src/app/hospital/page.tsx
- src/app/open-platform/page.tsx

## readme.md (3)
- README.md
- docs/devlog/README.md
- docs/product/README.md

## route.ts (146)
- src/app/api/auth/login/route.ts
- src/app/api/auth/logout/route.ts
- src/app/api/auth/session/route.ts
- src/app/api/institution/ai-service-usage/route.ts
- src/app/api/institution/appointments/route.ts
- src/app/api/institution/audit-events/route.ts
- src/app/api/institution/customers/[customerId]/followup-feedback/route.ts
- src/app/api/institution/customers/[customerId]/followup-overview/route.ts
- src/app/api/institution/customers/[customerId]/followup-timeline/route.ts
- src/app/api/institution/customers/[customerId]/timeline/route.ts
- src/app/api/institution/customers/[customerId]/treatment-summaries/route.ts
- src/app/api/institution/customers/[customerId]/wecom-reachout-safety/route.ts
- src/app/api/institution/customers/import/route.ts
- src/app/api/institution/customers/route.ts
- src/app/api/institution/dashboard-stats/route.ts
- src/app/api/institution/entitlement-usage/route.ts
- src/app/api/institution/follow-up-path-analysis/route.ts
- src/app/api/institution/followup-message-drafts/[draftId]/approve/route.ts
- src/app/api/institution/followup-message-drafts/[draftId]/mark-sent/route.ts
- src/app/api/institution/followup-message-drafts/[draftId]/reject/route.ts
- src/app/api/institution/followup-message-drafts/[draftId]/route.ts
- src/app/api/institution/followup-message-drafts/[draftId]/wecom-controlled-reachout/route.ts
- src/app/api/institution/followup-message-drafts/[draftId]/wecom-customer-broadcast-task/route.ts
- src/app/api/institution/followup-message-drafts/route.ts
- src/app/api/institution/followup-message-templates/route.ts
- src/app/api/institution/followup-operations/dashboard/route.ts
- src/app/api/institution/followup-paths/enrollments/[enrollmentId]/cancel/route.ts
- src/app/api/institution/followup-paths/enrollments/[enrollmentId]/route.ts
- src/app/api/institution/followup-paths/enrollments/route.ts
- src/app/api/institution/followup-paths/templates/route.ts
- src/app/api/institution/followups/route.ts
- src/app/api/institution/his-connections/[connectionId]/credentials/clear/route.ts
- src/app/api/institution/his-connections/[connectionId]/credentials/revoke/route.ts
- src/app/api/institution/his-connections/[connectionId]/credentials/rotate/route.ts
- src/app/api/institution/his-connections/[connectionId]/credentials/route.ts
- src/app/api/institution/his-connections/[connectionId]/pause/route.ts
- src/app/api/institution/his-connections/[connectionId]/resume/route.ts
- src/app/api/institution/his-connections/[connectionId]/revoke/route.ts
- src/app/api/institution/his-connections/[connectionId]/route.ts
- src/app/api/institution/his-connections/[connectionId]/test-connection/route.ts
- src/app/api/institution/his-connections/route.ts
- src/app/api/institution/knowledge-management/ai-call/route.ts
- src/app/api/institution/knowledge-management/ai-call/usage/route.ts
- src/app/api/institution/knowledge-management/answer/route.ts
- src/app/api/institution/knowledge-management/indexing-jobs/[jobId]/cancel/route.ts
- src/app/api/institution/knowledge-management/indexing-jobs/[jobId]/route.ts
- src/app/api/institution/knowledge-management/indexing-jobs/route.ts
- src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/download/route.ts
- src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/embeddings/route.ts
- src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/chunks/route.ts
- src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/route.ts
- src/app/api/institution/knowledge-management/items/[knowledgeId]/files/route.ts
- src/app/api/institution/knowledge-management/items/route.ts
- src/app/api/institution/knowledge-management/qa/audits/route.ts
- src/app/api/institution/knowledge-management/qa/route.ts
- src/app/api/institution/knowledge-management/retrieval/route.ts
- src/app/api/institution/knowledge-management/search/route.ts
- src/app/api/institution/knowledge-management/upload/route.ts
- src/app/api/institution/knowledge-management/vector-search/route.ts
- src/app/api/institution/opportunities/route.ts
- src/app/api/institution/real-channel-preflight/evaluate/route.ts
- src/app/api/institution/real-channel-preflight/route.ts
- src/app/api/institution/safety-switch/route.ts
- src/app/api/institution/treatment-summaries/[summaryId]/follow-up-suggestions/route.ts
- src/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route.ts
- src/app/api/institution/treatment-summaries/[summaryId]/route.ts
- src/app/api/institution/treatment-summaries/[summaryId]/void/route.ts
- src/app/api/institution/treatment-summaries/route.ts
- src/app/api/institution/wecom-customer-contact-precheck/route.ts
- src/app/api/institution/wecom-customer-contact-readonly-proof-mock/route.ts
- src/app/api/institution/wecom-customer-contact-readonly-proof/route.ts
- src/app/api/institution/wecom-customer-mapping/route.ts
- src/app/api/institution/wecom-official-dry-run-config/evaluate/route.ts
- src/app/api/institution/wecom-official-dry-run-config/route.ts
- src/app/api/institution/wecom-official-dry-run-snapshot/route.ts
- src/app/api/institution/wecom-official-dry-run/evaluate/route.ts
- src/app/api/institution/wecom-official-dry-run/route.ts
- src/app/api/institution/wecom-official-internal-message-proof/route.ts
- src/app/api/institution/wecom-official-secret-precheck/route.ts
- src/app/api/institution/wecom/customer-mapping-candidates/route.ts
- src/app/api/institution/wecom/customer-mapping-reviews/[mappingId]/actions/route.ts
- src/app/api/institution/wecom/external-contacts/route.ts
- src/app/api/open-platform/ai-credit-metering-rules/[id]/route.ts
- src/app/api/open-platform/ai-credit-metering-rules/route.ts
- src/app/api/open-platform/ai-usage-credits/route.ts
- src/app/api/open-platform/audit-events/route.ts
- src/app/api/open-platform/tenants/route.ts
- src/app/api/open-platform/wecom/customer-data-governance/route.ts
- src/app/api/v1/institution/ai-models/route.ts
- src/app/api/v1/knowledge-base/demo-readonly/route.ts
- src/app/api/v1/knowledge-base/runtime/documents/route.ts
- src/app/api/v1/knowledge-base/runtime/documents/upload/route.ts
- src/app/api/v1/knowledge-base/runtime/index-jobs/route.ts
- src/app/api/v1/knowledge-base/runtime/index-jobs/run/route.ts
- src/app/api/v1/knowledge-base/runtime/search/route.ts
- src/app/api/v1/open-platform/ai-model-config/route.ts
- src/app/api/v1/open-platform/ai-model-config/sync/route.ts
- src/app/api/v1/open-platform/ai-model-config/test/route.ts
- src/app/api/v1/open-platform/ai-readonly/route.ts
- src/app/api/v1/open-platform/ai-runtime/provider-config/route.ts
- src/app/api/v1/open-platform/ai-runtime/smoke/route.ts
- src/app/api/v1/open-platform/ai-runtime/status/route.ts
- src/app/api/v1/open-platform/ai-usage/route.ts
- src/app/api/v1/open-platform/homepage-brand/assets/route.ts
- src/app/api/v1/open-platform/homepage-brand/draft/route.ts
- src/app/api/v1/open-platform/homepage-brand/publish/route.ts
- src/app/api/v1/open-platform/homepage-brand/rollback/route.ts
- src/app/api/v1/open-platform/homepage-brand/route.ts
- src/app/api/v1/open-platform/homepage-brand/versions/route.ts
- src/app/api/v1/open-platform/knowledge-management/capabilities/route.ts
- src/app/api/v1/open-platform/knowledge-management/directories/[directoryId]/route.ts
- src/app/api/v1/open-platform/knowledge-management/directories/reorder/route.ts
- src/app/api/v1/open-platform/knowledge-management/directories/route.ts
- src/app/api/v1/open-platform/knowledge-management/embeddings/route.ts
- src/app/api/v1/open-platform/knowledge-management/files/route.ts
- src/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/[fileId]/download/route.ts
- src/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/chunks/route.ts
- src/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/route.ts
- src/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/[fileId]/route.ts
- src/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/route.ts
- src/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/visibility/route.ts
- src/app/api/v1/open-platform/knowledge-management/items/route.ts
- src/app/api/v1/open-platform/knowledge-management/qa/audits/route.ts
- src/app/api/v1/open-platform/knowledge-management/qa/route.ts
- src/app/api/v1/open-platform/knowledge-management/route.ts
- src/app/api/v1/open-platform/knowledge-management/search/route.ts
- src/app/api/v1/open-platform/knowledge-management/vector-search/route.ts
- src/app/api/v1/open-platform/package-ai-quota/route.ts
- src/app/api/v1/open-platform/plan-catalog/[planId]/versions/route.ts
- src/app/api/v1/open-platform/plan-catalog/route.ts
- src/app/api/v1/open-platform/plan-catalog/versions/[versionId]/publish/route.ts
- src/app/api/v1/open-platform/plan-catalog/versions/[versionId]/retire/route.ts
- src/app/api/v1/open-platform/plan-catalog/versions/[versionId]/route.ts
- src/app/api/v1/open-platform/provider-configs/route.ts
- src/app/api/v1/open-platform/provider-configs/smoke/route.ts
- src/app/api/v1/open-platform/tenant-plan-options/route.ts
- src/app/api/v1/open-platform/tenants/[tenantId]/account/route.ts
- src/app/api/v1/open-platform/tenants/[tenantId]/commercial-records/route.ts
- src/app/api/v1/open-platform/tenants/[tenantId]/entitlement-usage/route.ts
- src/app/api/v1/open-platform/tenants/[tenantId]/plan-change-preview/route.ts
- src/app/api/v1/open-platform/tenants/[tenantId]/plan-change/route.ts
- src/app/api/v1/open-platform/tenants/route.ts
- src/app/api/v1/open-platform/trial-data-reset/route.ts
- src/app/api/v1/workspace-dashboard/readonly-aggregation/route.ts
- src/app/api/version/route.ts
- src/app/uploads/homepage-brand/[kind]/[filename]/route.ts

## skill.md (3)
- .claude/skills/zmtg-pr-gatekeeper/SKILL.md
- .claude/skills/zmtg-secret-migration-guard/SKILL.md
- .claude/skills/zmtg-ui-test-reviewer/SKILL.md

## treatment-followup-suggestions.ts (2)
- src/modules/institution/domain/treatment-followup-suggestions.ts
- src/modules/institution/server/treatment-followup-suggestions.ts

## wecom-customer-mapping-candidates-reader.ts (2)
- src/modules/institution/server/wecom-customer-mapping-candidates-reader.ts
- src/modules/institution/view-models/wecom-customer-mapping-candidates-reader.ts
