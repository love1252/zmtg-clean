# 冲突支线清理第一批执行报告

> 日期：`2026-06-21 CST +0800`  
> 执行分支：`codex/conflict-branch-cleanup-plan-20260621`  
> 基线：`origin/main` = `3e789b04c9c11224fee3583d578177dc2f168e22`  
> 范围：执行《冲突支线清理任务计划》的任务 1、任务 2、任务 7。  
> 边界：不删除分支、不合并冲突支线、不运行 migration、不读取 `.env` / `.env.local`、不外呼第三方、不修改 runtime。

---

## 一、启动检查

| 项目 | 结果 |
| --- | --- |
| 日期 | `2026-06-21 CST +0800` |
| 当前分支 | `codex/conflict-branch-cleanup-plan-20260621` |
| 当前 HEAD | `4ecac6243a8081bef3bdac372cfbb1387a9cd3cc` |
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
| `codex/app-foundation` | 建议废弃 | 当前主线已存在 `AuthRole` / `AuthSession`、`DemoSessionGate`、`demo-session`、`institution-dashboard`、`platform-dashboard` 等能力；该支线相对当前主线会尝试回退大量文件。 | 不直接合并。等待用户确认后删除本地/远端旧支线；如仍需底座整理，基于当前 `main` 重建小 PR。 |
| `codex/auth-demo-session` | 建议废弃 | 当前主线已经有 `/api/auth/login`、`/api/auth/logout`、`/api/auth/session`、`DemoSessionGate`、`LogoutButton`，且当前实现包含签名 cookie 和生产 secret 缺失保护；旧支线会覆盖较新的登录与品牌配置链路。 | 不直接合并。保留当前主线实现；等待用户确认后删除旧支线。 |
| `codex/auth-demo-session-local-squash-20260529` | 建议废弃 | 该支线是 `codex/auth-demo-session` 的压缩重复支线，文件范围与能力高度重复；继续保留会增加误合并风险。 | 优先确认删除。不得与 `codex/auth-demo-session` 同时保留。 |
| `codex/classify-workbench-sections-by-sidebar` | 建议废弃，必要时重建 | 当前主线的机构工作台已有 `institutionNavItems` 和稳定 `InstitutionViewId`；旧支线只改 `InstitutionWorkspace.tsx` 与入口测试，直接合并会冲突当前更完整页面。 | 不直接合并。若仍需要“按侧栏分类工作区区块”，基于当前主线另开设计任务。 |
| `codex/visual-foundation` | 建议废弃，素材已被主线吸收 | 当前主线已存在 `LuxuryLoginShell`、品牌图片、首页背景图、`MarketingHome` 和首页品牌配置；旧支线相对当前主线会回退登录页和首页品牌管理能力。 | 不直接合并。若需提取未使用素材或视觉细节，进入“首页与品牌视觉精修”小 PR。 |

本批没有删除任何分支。上述“建议废弃”只代表审计结论，删除本地或远端分支前仍需用户明确确认。

---

## 四、剩余 14 条支线状态

| 支线 | 当前结论 | 原因 | 后续要求 |
| --- | --- | --- | --- |
| `codex/phase21-duplicate-followup-audit-link` | 等待审批/重建 | 涉及随访路径分析 domain 与测试。 | 单独做 Phase21 随访审计重建评估。 |
| `codex/phase21-followup-path-analysis-api` | 等待审批/重建 | 涉及 API route、server service、repository。 | 用户批准 runtime 后再重建。 |
| `codex/platform-demo-ui-polish-v1` | 等待 UI 摘取 | 与当前平台端 UI 大改冲突。 | 只摘取仍有效 UI 点，不整支线合并。 |
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

1. 先请用户确认是否删除 5 条早期/重复底座支线：

```text
codex/app-foundation
codex/auth-demo-session
codex/auth-demo-session-local-squash-20260529
codex/classify-workbench-sections-by-sidebar
codex/visual-foundation
```

2. 如果确认删除，建议只删除本地分支，远端分支再单独确认：

```bash
git branch -D <branch>
```

3. 再进入 Phase21 随访两条支线审计，判断是否重建。

4. HIS 与租户持久化必须另开目标任务，不进入普通清理。

---

## 六、验证计划

本批是 docs-only 执行报告，验证命令：

```bash
git diff --check
```

未运行测试、未运行 lint，原因是本批没有 runtime 改动。
