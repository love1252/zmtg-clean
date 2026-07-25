# 第六阶段：历史文档与纯测试文件归属确认

- 日期：2026-07-26
- 分支：`refactor/document-test-ownership-20260726-003947`
- 基线：`51495085b7943be05ecb41db2bab4dbe944234e4`
- 历史文档候选：14 个
- 纯测试候选：11 个
- 本阶段确认归属：25 个
- 本阶段移动文件：0 个

## 结论

- 14 个历史文档均确认继续保留在现有文档目录。
- 11 个纯测试文件均确认继续随所属模块或脚本目录保留。
- 不建立跨模块集中测试目录。
- 不将历史计划文档误判为运行时 Demo 文件。
- 所有候选的 `move_now` 均为 `no`。

## 历史文档归属汇总

| 归属区域 | 数量 | 保留策略 |
|---|---:|---|
| 产品交接资料 | 1 | 保留当前位置，作为历史记录 |
| 产品演示资料 | 7 | 保留当前位置，作为历史记录 |
| 产品规划资料 | 1 | 保留当前位置，作为历史记录 |
| 产品评审资料 | 1 | 保留当前位置，作为历史记录 |
| 历史实施计划 | 2 | 保留当前位置，作为历史记录 |
| 历史设计规格 | 2 | 保留当前位置，作为历史记录 |

## 历史文档逐文件确认

| 文件 | 归属区域 | 文档类型 |
|---|---|---|
| `docs/product/handoffs/2026-06-12-v1-readonly-demo-internal-handoff-01.md` | 产品交接资料 | 产品内部交接文档 |
| `docs/product/demo/2026-07-07-v06-demo-data-and-pilot-script-01.md` | 产品演示资料 | 产品演示历史文档 |
| `docs/product/demo/2026-07-07-v06-demo-seed-low-sensitive-01.md` | 产品演示资料 | 产品演示历史文档 |
| `docs/product/zhimei-demo-readiness-playbook.md` | 产品演示资料 | 智美天工演示运行资料 |
| `docs/product/zhimei-demo-rehearsal-checklist.md` | 产品演示资料 | 智美天工演示运行资料 |
| `docs/product/zhimei-demo-script.md` | 产品演示资料 | 智美天工演示运行资料 |
| `docs/product/zhimei-demo-seed-data-plan.md` | 产品演示资料 | 智美天工演示运行资料 |
| `docs/product/zhimei-demo-ui-polish-and-rehearsal-plan.md` | 产品演示资料 | 智美天工演示运行资料 |
| `docs/product/plans/v1-knowledge-base-demo-readonly-ui-plan-01.md` | 产品规划资料 | 产品实施规划文档 |
| `docs/product/reviews/2026-06-12-v1-readonly-demo-release-candidate-review-01.md` | 产品评审资料 | 产品评审与验收记录 |
| `docs/superpowers/plans/2026-06-02-demo-seed-data-v1.md` | 历史实施计划 | 历史开发实施计划 |
| `docs/superpowers/plans/2026-06-22-demo-mock-runtime-data-cleanup-implementation-plan.md` | 历史实施计划 | 历史开发实施计划 |
| `docs/superpowers/specs/2026-06-02-demo-seed-data-v1-design.md` | 历史设计规格 | 历史技术设计规格 |
| `docs/superpowers/specs/2026-06-22-demo-mock-runtime-data-cleanup-design.md` | 历史设计规格 | 历史技术设计规格 |

## 测试文件归属汇总

| 所属模块或目录 | 数量 | 保留策略 |
|---|---:|---|
| 工作台模块 | 1 | 随所属模块或脚本目录保留 |
| 开放平台模块 | 1 | 随所属模块或脚本目录保留 |
| 数据库边界 | 1 | 随所属模块或脚本目录保留 |
| 机构端模块 | 2 | 随所属模块或脚本目录保留 |
| 演示脚本测试 | 1 | 随所属模块或脚本目录保留 |
| 知识库模块 | 4 | 随所属模块或脚本目录保留 |
| 认证模块 | 1 | 随所属模块或脚本目录保留 |

## 测试文件逐文件确认

| 文件 | 所属模块或目录 | 测试类型 |
|---|---|---|
| `src/modules/workspace/tests/V1ReadonlyDemoGateAcceptance.test.tsx` | 工作台模块 | 验收测试 |
| `src/modules/open-platform/tests/PlatformKnowledgeMockContract.test.ts` | 开放平台模块 | 契约测试 |
| `src/server/db/tests/SeedGuard.test.ts` | 数据库边界 | 安全守卫测试 |
| `src/modules/institution/tests/WeComCustomerContactReadonlyProofMockApiRoute.test.ts` | 机构端模块 | API 路由测试 |
| `src/modules/institution/tests/WeComCustomerContactReadonlyProofMockDomain.test.ts` | 机构端模块 | 领域测试 |
| `scripts/demo/seed-v06-low-sensitive-demo.test.ts` | 演示脚本测试 | 演示脚本测试 |
| `src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyApiContract.test.ts` | 知识库模块 | 契约测试 |
| `src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyApiRoute.test.ts` | 知识库模块 | API 路由测试 |
| `src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyFacade.test.ts` | 知识库模块 | 模块行为测试 |
| `src/modules/knowledge-base/tests/V1KnowledgeBaseDemoSourceContract.test.ts` | 知识库模块 | 契约测试 |
| `src/modules/auth/tests/DemoAuthRoutes.test.ts` | 认证模块 | API 路由测试 |

## 后续边界

- 模块 Mock 仍需单独区分运行时调用和测试调用。
- Demo 认证、运行时 API 和运行时 Mock 保持原位。
- Seed 入口与 Seed 安全守卫保持数据库边界。
- 本阶段不修改测试文件内容或测试目录结构。

## 安全边界

- 未修改或移动任何历史文档原文件。
- 未修改或移动任何测试文件。
- 未修改 `src/`、`scripts/`、Schema 或 Migration。
- 未修改 `package.json` 或锁文件。
- 未执行数据库 Migration 或 Seed。
- 未连接数据库、HIS、企业微信或服务器。
- 未读取或输出 `.env.local` 或真实凭证。
