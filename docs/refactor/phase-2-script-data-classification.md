# 第二阶段脚本与数据文件分类审计

- 日期：2026-07-25
- 分支：`refactor/low-risk-assets-20260725-215248`
- 基线：`41013403be4368806fc61d8c561f2513254575f4`
- 本报告只分类，不移动脚本、Seed、Fixture 或 Demo 文件。

## scripts 当前文件

- `scripts/db/guarded-migrate.d.mts`：database-guarded
- `scripts/db/guarded-migrate.mjs`：database-guarded
- `scripts/demo/seed-v06-low-sensitive-demo.test.ts`：seed
- `scripts/demo/seed-v06-low-sensitive-demo.ts`：seed
- `scripts/deploy-test-server.mjs`：deployment
- `scripts/dev/local-acceptance-db.sh`：development
- `scripts/run-next.mjs`：development
- `scripts/run-vitest.mjs`：testing
- `scripts/runtime-node.mjs`：development

## Seed、Fixture、Demo、Mock 候选

- `docs/product/demo/2026-07-07-v06-demo-data-and-pilot-script-01.md`
- `docs/product/demo/2026-07-07-v06-demo-seed-low-sensitive-01.md`
- `docs/product/handoffs/2026-06-12-v1-readonly-demo-internal-handoff-01.md`
- `docs/product/plans/v1-knowledge-base-demo-readonly-ui-plan-01.md`
- `docs/product/reviews/2026-06-12-v1-readonly-demo-release-candidate-review-01.md`
- `docs/product/zhimei-demo-readiness-playbook.md`
- `docs/product/zhimei-demo-rehearsal-checklist.md`
- `docs/product/zhimei-demo-script.md`
- `docs/product/zhimei-demo-seed-data-plan.md`
- `docs/product/zhimei-demo-ui-polish-and-rehearsal-plan.md`
- `docs/superpowers/plans/2026-06-02-demo-seed-data-v1.md`
- `docs/superpowers/plans/2026-06-22-demo-mock-runtime-data-cleanup-implementation-plan.md`
- `docs/superpowers/specs/2026-06-02-demo-seed-data-v1-design.md`
- `docs/superpowers/specs/2026-06-22-demo-mock-runtime-data-cleanup-design.md`
- `scripts/demo/seed-v06-low-sensitive-demo.test.ts`
- `scripts/demo/seed-v06-low-sensitive-demo.ts`
- `src/app/api/institution/wecom-customer-contact-readonly-proof-mock/route.ts`
- `src/app/api/v1/knowledge-base/demo-readonly/route.ts`
- `src/modules/auth/components/DemoSessionGate.tsx`
- `src/modules/auth/server/demo-session.ts`
- `src/modules/auth/tests/DemoAuthRoutes.test.ts`
- `src/modules/institution/domain/wecom-customer-contact-readonly-proof-mock.ts`
- `src/modules/institution/domain/wecom-reachout-mock.ts`
- `src/modules/institution/server/wecom-customer-broadcast-task-mock-provider.ts`
- `src/modules/institution/server/wecom-customer-mapping-review-action-mock-runtime.ts`
- `src/modules/institution/tests/WeComCustomerContactReadonlyProofMockApiRoute.test.ts`
- `src/modules/institution/tests/WeComCustomerContactReadonlyProofMockDomain.test.ts`
- `src/modules/knowledge-base/domain/v1-knowledge-base-demo-readonly-api-contract.ts`
- `src/modules/knowledge-base/domain/v1-knowledge-base-demo-readonly-facade.ts`
- `src/modules/knowledge-base/domain/v1-knowledge-base-demo-source-contract.ts`
- `src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyApiContract.test.ts`
- `src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyApiRoute.test.ts`
- `src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyFacade.test.ts`
- `src/modules/knowledge-base/tests/V1KnowledgeBaseDemoSourceContract.test.ts`
- `src/modules/open-platform/mock/platformAiModelConfig.ts`
- `src/modules/open-platform/mock/platformAiModelRegistry.ts`
- `src/modules/open-platform/mock/platformAiReadonly.ts`
- `src/modules/open-platform/mock/platformAiUsageCost.ts`
- `src/modules/open-platform/mock/platformKnowledge.ts`
- `src/modules/open-platform/tests/PlatformKnowledgeMockContract.test.ts`
- `src/modules/workspace/tests/V1ReadonlyDemoGateAcceptance.test.tsx`
- `src/server/db/seed-demo-data.ts`
- `src/server/db/seed-guard.ts`
- `src/server/db/tests/SeedGuard.test.ts`

## 本阶段结论

- `drizzle/` 和数据库保护脚本保持原位。
- Demo、Fixture、Seed 的迁移需单独检查调用方。
- 静态资源去重 PR 不混入脚本目录移动。
- 下一批只选择调用简单、测试覆盖明确的文件。
