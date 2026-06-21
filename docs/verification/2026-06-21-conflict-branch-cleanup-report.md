# 冲突支线清理第一批执行报告

> 日期：`2026-06-21 CST +0800`  
> 执行分支：`codex/conflict-branch-cleanup-plan-20260621`  
> 基线：`origin/main` = `3e789b04c9c11224fee3583d578177dc2f168e22`  
> 范围：执行《冲突支线清理任务计划》的任务 1、任务 2、任务 3、任务 4、任务 7。
> 边界：不删除分支、不合并冲突支线、不运行 migration、不读取 `.env` / `.env.local`、不外呼第三方、不修改 runtime。

---

## 一、启动检查

| 项目 | 结果 |
| --- | --- |
| 日期 | `2026-06-21 CST +0800` |
| 当前分支 | `codex/conflict-branch-cleanup-plan-20260621` |
| 当前 HEAD | `abc99f1421c978d802cba26428d6f17d7583f31d` |
| `origin/main` | `3e789b04c9c11224fee3583d578177dc2f168e22` |
| 工作区 | 执行前干净 |
| 计划 PR | `#351 文档：制定冲突支线清理任务计划` |

说明：当前执行分支本身尚未合并，因此 `git branch --no-merged origin/main` 会额外列出 `codex/conflict-branch-cleanup-plan-20260621`。它是本次执行分支，不计入 19 条遗留冲突支线。

---

## 二、任务 1：最新审计快照

遗留冲突/高风险支线仍为 19 条：

```text
codex/app-foundation
codex/auth-demo-session
codex/auth-demo-session-local-squash-20260529
codex/classify-workbench-sections-by-sidebar
codex/phase21-duplicate-followup-audit-link
codex/phase21-followup-path-analysis-api
codex/platform-demo-ui-polish-v1
codex/tenant-persistence-phase3-plan
codex/visual-foundation
feat/phase23-his-connection-compensation-operation-repository-min
feat/phase23-his-credential-compensation-job-queue-repository-min
feat/phase23-his-credential-compensation-job-queue-schema-min
feat/phase23-his-credential-compensation-retry-policy-helper-min
feat/phase23-his-credential-compensation-worker-claim-lock-stale-recovery-min
feat/phase23-his-credential-compensation-worker-test-provider-noop-execution-min
plan/phase23-his-credential-compensation-outbox-job-queue
plan/phase23-his-credential-compensation-retry-requeue-backoff-runtime
plan/phase23-his-credential-compensation-worker-claim-lock-stale-recovery
plan/phase23-his-credential-compensation-worker-test-provider-noop-execution
```

风险观察：

- `codex/tenant-persistence-phase3-plan` 涉及 `drizzle/**`、`src/server/db/**`、依赖、API route，必须单独审批。
- `feat/phase23-his-credential-compensation-job-queue-schema-min` 涉及 schema/migration，必须单独审批。
- 多条 `feat/phase23-*worker*` 与 `plan/phase23-*worker*` 涉及 worker/queue，必须单独审批。
- 多条早期底座支线基于旧主线，若直接合并会产生大量回退或删除当前文档/实现的风险。

---

## 三、任务 2：早期/重复底座支线结论

| 支线 | 结论 | 判断依据 | 建议动作 |
| --- | --- | --- | --- |
| `codex/app-foundation` | 已确认删除本地 | 当前主线已存在 `AuthRole` / `AuthSession`、`DemoSessionGate`、`demo-session`、`institution-dashboard`、`platform-dashboard` 等能力；该支线相对当前主线会尝试回退大量文件。 | 已删除本地分支；远端 `origin/codex/app-foundation` 未删除，需单独批准。 |
| `codex/auth-demo-session` | 已确认删除本地 | 当前主线已经有 `/api/auth/login`、`/api/auth/logout`、`/api/auth/session`、`DemoSessionGate`、`LogoutButton`，且当前实现包含签名 cookie 和生产 secret 缺失保护；旧支线会覆盖较新的登录与品牌配置链路。 | 已删除本地分支；远端 `origin/codex/auth-demo-session` 未删除，需单独批准。 |
| `codex/auth-demo-session-local-squash-20260529` | 已确认删除本地 | 该支线是 `codex/auth-demo-session` 的压缩重复支线，文件范围与能力高度重复；继续保留会增加误合并风险。 | 已删除本地分支；未发现对应远端分支。 |
| `codex/classify-workbench-sections-by-sidebar` | 已确认删除本地 | 当前主线的机构工作台已有 `institutionNavItems` 和稳定 `InstitutionViewId`；旧支线只改 `InstitutionWorkspace.tsx` 与入口测试，直接合并会冲突当前更完整页面。 | 已删除本地分支；未发现对应远端分支。若仍需要该能力，基于当前主线重建。 |
| `codex/visual-foundation` | 已确认删除本地 | 当前主线已存在 `LuxuryLoginShell`、品牌图片、首页背景图、`MarketingHome` 和首页品牌配置；旧支线相对当前主线会回退登录页和首页品牌管理能力。 | 已删除本地分支；远端 `origin/codex/visual-foundation` 未删除，需单独批准。 |

本批已在用户确认后删除上述 5 条本地分支。未删除任何远端分支。

---

## 四、剩余 12 条本地未合并支线状态

| 支线 | 当前结论 | 原因 | 后续要求 |
| --- | --- | --- | --- |
| `codex/platform-demo-ui-polish-v1` | 建议废弃 / 无需重建 | `git cherry -v origin/main codex/platform-demo-ui-polish-v1` 显示等价 patch 已在 `origin/main`；当前平台端相关回归测试通过。 | 本地分支尚未删除；建议用户确认后删除本地旧支线。 |
| `codex/tenant-persistence-phase3-plan` | 等待单独审批 | 涉及 DB、schema、依赖、API、真实落库。 | 必须独立目标任务批准。 |
| `feat/phase23-his-connection-compensation-operation-repository-min` | 等待审批/重建 | HIS runtime repository。 | 独立 HIS 补偿任务处理。 |
| `feat/phase23-his-credential-compensation-job-queue-repository-min` | 等待单独审批 | 涉及 job queue repository。 | 必须明确批准 queue 范围。 |
| `feat/phase23-his-credential-compensation-job-queue-schema-min` | 等待单独审批 | 涉及 Drizzle migration/schema。 | 必须明确批准 schema/migration。 |
| `feat/phase23-his-credential-compensation-retry-policy-helper-min` | 可评估重建 | retry helper 相对独立，但仍属于 HIS 补偿链路。 | 可拆最小 PR，但先做设计确认。 |
| `feat/phase23-his-credential-compensation-worker-claim-lock-stale-recovery-min` | 等待单独审批 | 涉及 worker。 | 必须明确批准 worker 范围。 |
| `feat/phase23-his-credential-compensation-worker-test-provider-noop-execution-min` | 等待单独审批 | 涉及 worker/test provider。 | 必须明确批准 worker/test provider。 |
| `plan/phase23-his-credential-compensation-outbox-job-queue` | 等待文档整合 | 旧计划与 README/devlog/roadmap 冲突。 | 不直接合并，重写为当前日期统一 HIS 计划。 |
| `plan/phase23-his-credential-compensation-retry-requeue-backoff-runtime` | 等待文档整合 | 旧计划与 runtime 主题绑定。 | 不直接合并，纳入统一 HIS 计划。 |
| `plan/phase23-his-credential-compensation-worker-claim-lock-stale-recovery` | 等待文档整合 | 旧计划与 worker 主题绑定。 | 不直接合并，纳入统一 HIS 计划。 |
| `plan/phase23-his-credential-compensation-worker-test-provider-noop-execution` | 等待文档整合 | 旧计划与 worker/test provider 主题绑定。 | 不直接合并，纳入统一 HIS 计划。 |

---

## 五、建议的下一批动作

### 5.1 远端旧支线确认

如需彻底清理远端，请用户单独确认是否删除以下远端旧支线：

```text
origin/codex/app-foundation
origin/codex/auth-demo-session
origin/codex/visual-foundation
```

如果确认删除远端，建议单独执行并记录：

```bash
git push origin --delete <branch>
```

### 5.2 Phase21 本地旧支线清理结果

Phase21 两条支线已确认无需重建，并已在用户确认后删除本地旧支线：

```text
codex/phase21-duplicate-followup-audit-link
codex/phase21-followup-path-analysis-api
```

远端仍保留，未执行远端删除：

```text
origin/codex/phase21-duplicate-followup-audit-link
origin/codex/phase21-followup-path-analysis-api
```

### 5.3 平台 demo UI 本地旧支线确认

`codex/platform-demo-ui-polish-v1` 已审计完成，等价 patch 已进入 `origin/main`，当前无需重建小 PR。建议下一步请用户确认是否删除该本地旧支线；本报告不删除远端分支。

### 5.4 后续批次

1. 如用户确认，删除 `codex/platform-demo-ui-polish-v1` 本地旧支线。
2. HIS 与租户持久化必须另开目标任务，不进入普通清理。

---

## 六、Phase21 审计验证补充

本次补充审计执行：

```bash
git cherry -v origin/main codex/phase21-duplicate-followup-audit-link
git cherry -v origin/main codex/phase21-followup-path-analysis-api
pnpm test src/modules/institution/tests/FollowUpPathAnalysis.test.ts src/modules/institution/tests/FollowUpPathAnalysisApiRoutes.test.ts
```

结果：

- `codex/phase21-duplicate-followup-audit-link`：`git cherry` 标记为 `-`，等价 patch 已进入 `origin/main`。
- `codex/phase21-followup-path-analysis-api`：`git cherry` 标记为 `-`，等价 patch 已进入 `origin/main`。
- `FollowUpPathAnalysis.test.ts`：11 个用例通过。
- `FollowUpPathAnalysisApiRoutes.test.ts`：5 个用例通过。
- 总计：2 个测试文件、16 个用例通过。

---

## 七、平台 demo UI 审计验证补充

本次补充审计执行：

```bash
git cherry -v origin/main codex/platform-demo-ui-polish-v1
pnpm test src/modules/open-platform/tests/OpenPlatformAuditEventsPanel.test.tsx src/modules/open-platform/tests/OpenPlatformGovernancePanel.test.tsx src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

结果：

- `codex/platform-demo-ui-polish-v1`：`git cherry` 标记为 `-`，等价 patch 已进入 `origin/main`。
- 平台端审计、治理、租户管理、工作台入口相关测试通过。
- 总计：5 个测试文件、87 个用例通过。
- 结论：不需要从该旧支线重建小 PR；该本地支线建议用户确认后删除。

---

## 八、验证计划

本批文档改动的格式验证命令：

```bash
git diff --check
```

本批未运行 lint，原因是本次提交只修改文档。功能测试已在 Phase21 与平台 demo UI 审计环节按对应支线范围运行，结果见第六、七节。

---

## 九、剩余 12 条未合并支线复查

复查时间：`2026-06-21 CST +0800`

复查命令：

```bash
git branch --no-merged origin/main --format='%(refname:short)' | grep -v '^codex/conflict-branch-cleanup-plan-20260621$'
git cherry -v origin/main <branch>
git diff --name-status origin/main...<branch>
git merge-tree --write-tree origin/main <branch>
```

复查结论：

| 支线 | 覆盖状态 | 冲突状态 | 处理建议 |
| --- | --- | --- | --- |
| `codex/platform-demo-ui-polish-v1` | `git cherry` 标记为 `-`，等价 patch 已进入 `origin/main`。 | 与当前平台端 UI 文件冲突，且直接对比会回退大量当前主线文件。 | 建议确认后删除本地旧支线，不重建。 |
| `codex/tenant-persistence-phase3-plan` | 仍有非等价提交，但主线已存在租户持久化相关计划、schema 和数据库文件。 | 涉及 `drizzle/**`、`src/server/db/**`、auth route、租户 API、package/lockfile，直接合并会冲突并回退大量后续迁移。 | 不合并旧支线；如仍需要租户持久化能力，必须另开单独目标任务重建。 |
| `feat/phase23-his-connection-compensation-operation-repository-min` | 主线已存在 operation repository 文件和测试，但旧支线仍有非等价 patch。 | 与 README、devlog、roadmap、operation repository、Schema 等冲突。 | 不直接合并；如需补差异，单独比较当前主线实现后重建最小补丁。 |
| `feat/phase23-his-credential-compensation-job-queue-repository-min` | 主线已存在 job queue repository 文件和测试，但旧支线仍有非等价 patch。 | 与 README、devlog、roadmap、job queue repository 相关内容冲突。 | 不直接合并；如需补差异，单独重建小 PR。 |
| `feat/phase23-his-credential-compensation-job-queue-schema-min` | 主线已存在 `0008_phase23_his_connection_credential_compensation_job_queue_schema_min.sql`、schema 和 Schema 测试。 | 涉及 Drizzle migration、`_journal.json`、`src/server/db/schema.ts`，直接合并高风险。 | 不直接合并；schema/migration 只能在单独审批后处理。 |
| `feat/phase23-his-credential-compensation-retry-policy-helper-min` | 主线已存在 retry policy helper 和测试，但旧支线仍有非等价 patch。 | 与 README、devlog、roadmap、worker/operation repository 相关文件冲突。 | 不直接合并；若需要，只重建 helper 差异补丁。 |
| `feat/phase23-his-credential-compensation-worker-claim-lock-stale-recovery-min` | 主线已存在 worker runtime 和测试，但旧支线仍有非等价 patch。 | 涉及 worker runtime，直接合并会和当前 worker 实现冲突。 | 不直接合并；worker/stale recovery 必须另开 runtime 审批任务。 |
| `feat/phase23-his-credential-compensation-worker-test-provider-noop-execution-min` | `git cherry` 标记为 `-`，等价 patch 已进入 `origin/main`。 | 仍会与 README、devlog、roadmap、worker 文件冲突。 | 建议确认后删除本地旧支线，不重建。 |
| `plan/phase23-his-credential-compensation-outbox-job-queue` | `git cherry` 标记为 `-`，等价文档已进入 `origin/main`。 | README、devlog、roadmap 仍冲突。 | 建议确认后删除本地旧支线，不重建。 |
| `plan/phase23-his-credential-compensation-retry-requeue-backoff-runtime` | `git cherry` 标记为 `-`，等价文档已进入 `origin/main`。 | README、devlog、roadmap 仍冲突。 | 建议确认后删除本地旧支线，不重建。 |
| `plan/phase23-his-credential-compensation-worker-claim-lock-stale-recovery` | `git cherry` 标记为 `-`，等价文档已进入 `origin/main`。 | README、devlog、roadmap 仍冲突。 | 建议确认后删除本地旧支线，不重建。 |
| `plan/phase23-his-credential-compensation-worker-test-provider-noop-execution` | `git cherry` 标记为 `-`，等价文档已进入 `origin/main`。 | README、devlog、roadmap 仍冲突。 | 建议确认后删除本地旧支线，不重建。 |

### 9.1 可确认删除的本地旧支线

以下 6 条支线已由 `git cherry` 确认为等价 patch 已进入 `origin/main`，建议用户确认后删除本地旧支线；本报告不删除远端：

```text
codex/platform-demo-ui-polish-v1
feat/phase23-his-credential-compensation-worker-test-provider-noop-execution-min
plan/phase23-his-credential-compensation-outbox-job-queue
plan/phase23-his-credential-compensation-retry-requeue-backoff-runtime
plan/phase23-his-credential-compensation-worker-claim-lock-stale-recovery
plan/phase23-his-credential-compensation-worker-test-provider-noop-execution
```

### 9.2 不能直接合并的高风险支线

以下 6 条支线仍有非等价提交，但都不能直接合并：

```text
codex/tenant-persistence-phase3-plan
feat/phase23-his-connection-compensation-operation-repository-min
feat/phase23-his-credential-compensation-job-queue-repository-min
feat/phase23-his-credential-compensation-job-queue-schema-min
feat/phase23-his-credential-compensation-retry-policy-helper-min
feat/phase23-his-credential-compensation-worker-claim-lock-stale-recovery-min
```

原因：

- 它们的 merge-base 均早于当前平台端、知识库、AI 模型、首页品牌等大量主线工作。
- 直接合并会删除或回退大量当前主线文件，尤其是 `drizzle/0009` 到 `0018`、知识库 runtime、AI 模型配置、首页品牌 runtime 等。
- `tenant-persistence` 涉及 schema/migration/API/依赖。
- HIS schema、queue、worker 涉及本项目必须单独审批的高风险边界。

### 9.3 复查测试结果

本次针对当前主线已有 HIS 凭证补偿能力运行：

```bash
pnpm test src/modules/institution/tests/HisConnectionCredentialCompensationOperationRepository.test.ts src/modules/institution/tests/HisConnectionCredentialCompensationJobQueueRepository.test.ts src/modules/institution/tests/HisConnectionCredentialCompensationRetryPolicy.test.ts src/modules/institution/tests/HisConnectionCredentialCompensationWorker.test.ts src/server/db/tests/Schema.test.ts
```

结果：

- `HisConnectionCredentialCompensationOperationRepository.test.ts`：20 个用例通过。
- `HisConnectionCredentialCompensationJobQueueRepository.test.ts`：17 个用例通过。
- `HisConnectionCredentialCompensationRetryPolicy.test.ts`：16 个用例通过。
- `HisConnectionCredentialCompensationWorker.test.ts`：59 个用例通过。
- `Schema.test.ts`：36 个用例通过，1 个用例失败。

失败项：

```text
数据库结构 > 迁移不包含真实个人信息字段名
expected migration SQL not to contain '"metadata" jsonb'
```

判断：该失败来自当前主线迁移内容与 schema 安全测试之间的既有不一致，本次复查未修改 runtime，未引入该失败。后续如果要收口 HIS/schema 类支线，应先单独处理这个 schema 测试问题，避免把旧支线清理和 schema 修复混在一个 PR。
