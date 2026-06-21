# 冲突支线清理任务计划

> **给智能体执行者：**执行本计划前必须使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`，并逐项勾选任务。涉及删除分支、schema/migration、队列/worker、外部系统、凭证或生产配置时，必须先取得用户在当前任务中的明确批准。

**目标：**把 19 条仍未合并到 `origin/main` 的冲突或高风险支线逐条收口，明确每条支线是废弃、重做、拆分 PR，还是在独立审批后合并。

**架构：**本任务先做审计与清理决策，不直接做 runtime 实现。清理过程采用小批次、中文 PR、单主题验证，每个 PR 只处理同一类支线，避免把早期底座、HIS 补偿、租户持久化和平台 UI 混在一起。

**技术栈：**Git、GitHub CLI、Next.js、React、TypeScript、Vitest、ESLint、Drizzle。

---

## 当前基线

- 日期：`2026-06-21 CST +0800`
- 基线分支：`main`
- 基线 HEAD：`3e789b04c9c11224fee3583d578177dc2f168e22`
- `origin/main`：`3e789b04c9c11224fee3583d578177dc2f168e22`
- 工作区要求：开始每个子任务前必须为干净状态。
- 本计划不是：不运行 migration、不读取 `.env` / `.env.local`、不输出密钥、不外呼第三方、不直接删除分支、不直接合并高风险支线。

## 中文 PR 规范

所有相关 PR、提交、PR 标题、PR 内容说明必须使用中文。

推荐格式：

```text
PR 标题：清理：收口 <支线类别> 冲突支线

提交标题：
- docs: 记录 <主题> 冲突支线清理结论
- chore: 收口 <主题> 过期支线
- test: 补充 <主题> 回归验证
- feat: 重建 <主题> 最小可合并边界

PR 内容：
## 变更摘要
- ...

## 未纳入范围
- ...

## 风险与回滚
- ...

## 验证
- ...
```

禁止使用纯英文标题，例如 `chore: cleanup branches`。如需保留技术名词，可以中英文混写，例如 `清理：收口 homepage CMS contract 支线`。

## 剩余 19 条支线清单

| 类别 | 支线 | 初步处理建议 |
| --- | --- | --- |
| 早期应用底座 | `codex/app-foundation` | 先审计是否已被后续主线覆盖，覆盖则申请废弃；未覆盖则拆成新 PR |
| Demo 登录 | `codex/auth-demo-session` | 与当前登录/后台入口冲突，禁止直接合并，需重做设计 |
| Demo 登录重复压缩支线 | `codex/auth-demo-session-local-squash-20260529` | 与 `codex/auth-demo-session` 重复，优先申请删除或归档 |
| 机构工作台分类 | `codex/classify-workbench-sections-by-sidebar` | 先比对当前侧栏实现，可能已过期 |
| Phase21 随访审计 | `codex/phase21-duplicate-followup-audit-link` | 需要单独功能审查和测试后重建 |
| Phase21 随访 API | `codex/phase21-followup-path-analysis-api` | 涉及 API route，需单独审批后重建 |
| 平台 demo UI | `codex/platform-demo-ui-polish-v1` | 与近期平台端大改冲突，建议只提取仍有效的 UI 点 |
| 租户持久化 Phase3 | `codex/tenant-persistence-phase3-plan` | 涉及 DB、schema、依赖、API，必须单独审批 |
| 视觉底座 | `codex/visual-foundation` | 多数内容可能已被近期首页与品牌工作覆盖，先审计后决定废弃或摘取素材 |
| HIS operation repository | `feat/phase23-his-connection-compensation-operation-repository-min` | HIS runtime，需单独审批与测试 |
| HIS job queue repository | `feat/phase23-his-credential-compensation-job-queue-repository-min` | 涉及 queue，必须单独审批 |
| HIS job queue schema | `feat/phase23-his-credential-compensation-job-queue-schema-min` | 涉及 migration/schema，必须单独审批 |
| HIS retry policy | `feat/phase23-his-credential-compensation-retry-policy-helper-min` | 可作为最小 runtime PR 重建，但需避开队列联动 |
| HIS worker stale recovery | `feat/phase23-his-credential-compensation-worker-claim-lock-stale-recovery-min` | 涉及 worker，必须单独审批 |
| HIS worker no-op provider | `feat/phase23-his-credential-compensation-worker-test-provider-noop-execution-min` | 涉及 worker/test provider，必须单独审批 |
| HIS outbox/job queue 计划 | `plan/phase23-his-credential-compensation-outbox-job-queue` | 文档计划但与 queue 主题相关，建议并入统一 HIS 计划或废弃 |
| HIS retry/requeue 计划 | `plan/phase23-his-credential-compensation-retry-requeue-backoff-runtime` | 文档计划但与 runtime 主题相关，建议并入统一 HIS 计划或废弃 |
| HIS worker stale recovery 计划 | `plan/phase23-his-credential-compensation-worker-claim-lock-stale-recovery` | 文档计划但与 worker 主题相关，建议并入统一 HIS 计划或废弃 |
| HIS worker no-op provider 计划 | `plan/phase23-his-credential-compensation-worker-test-provider-noop-execution` | 文档计划但与 worker 主题相关，建议并入统一 HIS 计划或废弃 |

## 停止条件

执行者遇到以下情况必须停止并请用户确认：

- 需要删除本地或远端分支。
- 需要修改或新增 `drizzle/**`、schema、migration。
- 需要运行 migration。
- 需要修改队列、worker、scheduler、cron。
- 需要读取 `.env`、`.env.local` 或任何凭证。
- 需要外呼第三方系统或真实 HIS。
- 需要合并包含大量冲突的 runtime 分支。
- 工作区出现非本任务改动。

## 任务 1：建立最新审计快照

**文件：**
- 读取：Git 分支与 diff 元数据。
- 修改：无。

- [x] **步骤 1：确认启动状态**

```bash
date '+%Y-%m-%d %Z %z'
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

期望：日期为当天，分支为清理任务分支或 `main`，`HEAD` 与 `origin/main` 基线明确，工作区干净。

- [x] **步骤 2：重新列出未合并分支**

```bash
git branch --no-merged origin/main --format='%(refname:short)'
```

期望：只剩本计划列出的 19 条支线；如果数量变化，先更新本计划再继续。

- [x] **步骤 3：记录每条支线风险**

```bash
git branch --no-merged origin/main --format='%(refname:short)' | while IFS= read -r branch; do
  echo "=== ${branch} ==="
  git diff --name-only origin/main..."${branch}"
done
```

期望：只输出文件路径，不读取文件内容，不输出 secret。

## 任务 2：处理重复或过期底座支线

**文件：**
- 读取：`README.md`、`docs/devlog/*.md`、相关 `src/modules/auth/**`、`src/modules/workspace/**` diff。
- 修改：先不修改；如需重建，另开 PR。

- [x] **步骤 1：审计以下支线是否已被主线覆盖**

```text
codex/app-foundation
codex/auth-demo-session
codex/auth-demo-session-local-squash-20260529
codex/classify-workbench-sections-by-sidebar
codex/visual-foundation
```

- [x] **步骤 2：输出中文结论**

每条支线给出一种结论：

```text
保留重建：还有未进入 main 的有效能力，需要单独新建 PR。
申请废弃：能力已过期或已被 main 覆盖，等待用户确认删除分支。
人工复核：无法判断，需用户指定业务取舍。
```

- [x] **步骤 3：如需删除，先请求确认**

不得直接执行 `git branch -D` 或删除远端分支。必须让用户输入明确确认。

## 任务 3：处理 Phase21 随访支线

**文件：**
- 候选读取：`src/modules/institution/domain/followup-path-analysis.ts`
- 候选读取：`src/app/api/institution/follow-up-path-analysis/route.ts`
- 候选读取：`src/modules/institution/tests/**`

- [x] **步骤 1：审计两条支线**

```text
codex/phase21-duplicate-followup-audit-link
codex/phase21-followup-path-analysis-api
```

- [x] **步骤 2：判断是否仍符合当前架构**

只允许给出设计判断，不直接合并。若需要 API route 或 server repository 改动，先请求用户批准 runtime 范围。

- [x] **步骤 3：规划新 PR**

如果仍有价值，拆为一个中文 PR：

```text
PR 标题：随访：重建路径分析与审计关联最小边界
```

验证至少包含对应 Vitest route/domain 测试。

### 任务 3 执行记录

- `2026-06-21`：两条 Phase21 支线经 `git cherry -v origin/main <branch>` 确认等价 patch 已进入 `origin/main`。
- `2026-06-21`：已运行 `pnpm test src/modules/institution/tests/FollowUpPathAnalysis.test.ts src/modules/institution/tests/FollowUpPathAnalysisApiRoutes.test.ts`，2 个测试文件、16 个用例通过。
- `2026-06-21`：经用户确认后，已删除以下本地旧支线；未删除远端分支。

```text
codex/phase21-duplicate-followup-audit-link
codex/phase21-followup-path-analysis-api
```

## 任务 4：处理平台 demo UI 支线

**文件：**
- 候选读取：`src/modules/open-platform/components/**`
- 候选读取：`src/modules/workspace/components/PlatformConsole.tsx`
- 候选读取：`src/modules/open-platform/tests/**`

- [x] **步骤 1：审计 `codex/platform-demo-ui-polish-v1`**

只摘取仍适用于当前平台端白色主题、首页与品牌、AI 模型配置、知识库管理的 UI 经验。

- [x] **步骤 2：避免直接合并旧 UI**

该支线与近期平台端页面冲突，禁止整支线合并。

- [x] **步骤 3：如有必要，重建小 PR**

```text
PR 标题：平台端：补齐 demo UI 遗留细节
```

必须附截图或浏览器验收说明。

执行结论：本次审计无需重建小 PR。`git cherry -v origin/main codex/platform-demo-ui-polish-v1` 标记为 `-`，说明等价 patch 已在 `origin/main`；当前平台相关回归测试也已通过。该本地支线建议经用户确认后删除，远端分支另行确认。

### 任务 4 执行记录

- `2026-06-21`：审计 `codex/platform-demo-ui-polish-v1`，确认不适合整支线合并。
- `2026-06-21`：`git cherry -v origin/main codex/platform-demo-ui-polish-v1` 显示该支线等价 patch 已进入 `origin/main`。
- `2026-06-21`：已运行以下平台端相关回归测试，5 个测试文件、87 个用例通过。

```bash
pnpm test src/modules/open-platform/tests/OpenPlatformAuditEventsPanel.test.tsx src/modules/open-platform/tests/OpenPlatformGovernancePanel.test.tsx src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

- 本次未删除 `codex/platform-demo-ui-polish-v1` 本地分支，等待用户明确确认。

## 任务 5：隔离租户持久化 Phase3

**文件：**
- 候选读取：`drizzle/**`
- 候选读取：`src/server/db/**`
- 候选读取：`src/app/api/**`
- 候选读取：`package.json`

- [x] **步骤 1：只做风险结论**

支线：

```text
codex/tenant-persistence-phase3-plan
```

该支线涉及 DB、schema、依赖、API、真实落库，不得在普通清理任务中合并。

- [x] **步骤 2：输出审批需求**

如需继续，必须单独让用户批准：

```text
批准进入租户持久化 Phase3 重建任务：允许修改 schema/migration/API/repository/测试；不读取 env，不运行 migration，除非再次单独批准。
```

### 任务 5 执行记录

- `2026-06-21`：复查 `codex/tenant-persistence-phase3-plan`，确认仍有非等价提交，但该支线涉及 schema/migration、数据库连接、租户 API、依赖和鉴权相关 runtime。
- `2026-06-21`：确认该支线不能直接合并；如仍需能力，必须基于当前 `origin/main` 另开单独目标任务重建。

## 任务 6：隔离 HIS Phase23 支线

**文件：**
- 候选读取：`src/modules/institution/server/his-connection-credential-compensation-*.ts`
- 候选读取：`src/modules/institution/tests/HisConnectionCredentialCompensation*.test.ts`
- 候选读取：`drizzle/**`
- 候选读取：`docs/superpowers/plans/2026-06-0*-phase23-*.md`

- [x] **步骤 1：把 HIS 支线分成三组**

```text
计划文档组：
plan/phase23-his-credential-compensation-outbox-job-queue
plan/phase23-his-credential-compensation-retry-requeue-backoff-runtime
plan/phase23-his-credential-compensation-worker-claim-lock-stale-recovery
plan/phase23-his-credential-compensation-worker-test-provider-noop-execution

可重建 helper/repository 组：
feat/phase23-his-connection-compensation-operation-repository-min
feat/phase23-his-credential-compensation-retry-policy-helper-min

高风险 schema/queue/worker 组：
feat/phase23-his-credential-compensation-job-queue-repository-min
feat/phase23-his-credential-compensation-job-queue-schema-min
feat/phase23-his-credential-compensation-worker-claim-lock-stale-recovery-min
feat/phase23-his-credential-compensation-worker-test-provider-noop-execution-min
```

- [ ] **步骤 2：计划文档组先合并成一份中文总计划**

不得把四条旧计划直接合并进主线；应重写成一份当前日期的新计划，避免过期 README/devlog/roadmap 冲突。

- [ ] **步骤 3：helper/repository 组可单独评估重建**

如仍有价值，必须使用中文 PR：

```text
PR 标题：HIS：重建凭证补偿 repository 与 retry policy 最小边界
```

- [ ] **步骤 4：schema/queue/worker 组必须等待批准**

禁止在本清理任务中合并。需要用户明确批准后另开任务。

### 任务 6 执行记录

- `2026-06-21`：复查剩余 HIS Phase23 支线，确认 5 条等价 patch 已进入 `origin/main`，建议经用户确认后删除本地旧支线。
- `2026-06-21`：确认 operation repository、job queue repository、schema、retry policy helper、worker stale recovery 仍有非等价提交，但均不能直接合并，只能按 runtime/schema/worker 边界另开审批任务重建。
- `2026-06-21`：当前主线 HIS 凭证补偿 4 个 runtime 测试文件共 112 个用例通过；`Schema.test.ts` 有 1 个既有失败，原因是迁移 SQL 中存在 `"metadata" jsonb`，与安全字段断言冲突。

## 任务 7：最终收口报告

**文件：**
- 新增或修改：`docs/verification/<当天日期>-conflict-branch-cleanup-report.md`

- [x] **步骤 1：输出最终表格**

每条支线必须有结论：

```text
已合并 / 已重建 / 等待审批 / 建议废弃 / 已确认删除
```

- [x] **步骤 2：输出剩余风险**

必须列出未处理分支原因，以及是否需要用户批准。

- [x] **步骤 3：验证**

如果只改文档：

```bash
git diff --check
```

如果改 runtime：

```bash
pnpm test <相关测试文件>
pnpm exec eslint <相关文件>
```

---

## 执行建议

建议先执行任务 1、任务 2 和任务 7，形成“废弃/保留/重建”的第一版清理报告。不要一口气处理 HIS 和租户持久化，它们属于高风险长期支线，应该拆成独立目标任务。

## 执行记录

- `2026-06-21 CST +0800`：已完成任务 1、任务 2 和任务 7，输出 `docs/verification/2026-06-21-conflict-branch-cleanup-report.md`。
- `2026-06-21 CST +0800`：经用户确认，已删除 5 条本地旧支线：`codex/app-foundation`、`codex/auth-demo-session`、`codex/auth-demo-session-local-squash-20260529`、`codex/classify-workbench-sections-by-sidebar`、`codex/visual-foundation`。
- 远端旧支线未删除；如需删除 `origin/codex/app-foundation`、`origin/codex/auth-demo-session`、`origin/codex/visual-foundation`，必须再次取得用户明确批准。
- `2026-06-21 CST +0800`：已完成任务 3 Phase21 随访支线审计；`codex/phase21-duplicate-followup-audit-link` 与 `codex/phase21-followup-path-analysis-api` 的等价 patch 已在 `origin/main`，当前主线相关测试通过，结论为无需重建、建议确认后删除本地旧支线。
- `2026-06-21 CST +0800`：经用户确认，已删除剩余 12 条本地未合并旧支线；本地未合并列表只剩当前清理 PR 分支 `codex/conflict-branch-cleanup-plan-20260621`。
- `2026-06-21 CST +0800`：已在执行报告中整理后续中文重建任务建议，包括租户持久化重建、HIS repository 差异复核、HIS schema 安全修复、retry policy 复核和 worker stale recovery 重建。
