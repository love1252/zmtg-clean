# Phase 23 HIS 连接配置状态 service audit reason v1 计划

> 本文档是 Phase 23 Plan Mode。当前 PR 只新增和同步 Markdown，规划后续 HIS 连接配置状态 service 的 repository 非 ok 结果到 denied audit reason 的映射，不实现 service 代码，不新增 API route，不修改 parser、repository、权限、audit domain、query whitelist、audit repository、schema、migration、凭证管理、测试连接或真实 HIS adapter。

## 目标

只规划 HIS 连接配置状态 service denied audit reason 映射，收敛 `conflict`、`validation_failed`、`invalid_state_transition`、`not_found` 和 thrown error 的审计边界，让后续状态 service 最小实现可以直接使用既有 audit reason。

## 背景说明

当前系统已完成 HIS 连接配置只读链路、create / update repository、状态流转 repository、create / update parser、写入权限、create / update service、service denied audit、create / update route Plan Mode、状态 API Plan Mode、状态权限 Plan Mode、状态权限最小实现和状态 service Plan Mode。

前序状态 service Plan Mode 已明确状态 service 的函数、输入、事务、allowed audit、DTO 和测试拆分，但 `conflict` 与 `validation_failed` 的 denied audit reason 尚未收敛。本 PR 只补齐这个实现前置决策，不改运行时代码。

## 技术范围

当前 PR 只涉及 Markdown。

本 PR 允许修改：

- `docs/superpowers/specs/*.md`
- `docs/superpowers/plans/*.md`
- `docs/devlog/2026-06-04.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`

本 PR 禁止修改：

- `src/**`
- API route 文件。
- service 文件。
- parser 文件。
- repository 文件。
- 权限实现或权限测试文件。
- audit domain / reason / query whitelist 文件。
- audit repository 文件。
- schema / migration 文件。
- `package.json` 或 lockfile。
- `.env*`。
- `.codex`。
- Superpowers 缓存目录或技能文件。

## 只读检查记录

已执行基础检查：

```bash
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
git status --short
```

检查结论：

- 当前 main commit 为 `5bd226807f304950e6c7b04ef83644f80101486c`。
- 建分支前工作区干净。
- 当前分支为 `docs/phase23-his-connection-status-service-audit-reason-plan`。

已只读检查：

- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/domain/audit-event-query.ts`
- `src/modules/audit/tests/AuditEventsDomain.test.ts`
- `src/modules/audit/tests/AuditEventQueryParser.test.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/modules/institution/server/his-connection-write-service.ts`
- `src/modules/institution/tests/HisConnectionWriteService.test.ts`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-service-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-service-v1.md`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-api-v1-design.md`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-permission-v1-design.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-04.md`

已执行指定 reason 搜索：

```bash
grep -R "invalid_transition\|not_found_or_not_owned\|invalid_his_connection_payload\|his_connection_name_conflict\|conflict\|validation_failed" src/modules/audit src/modules/institution docs/superpowers --exclude-dir=node_modules || true
```

只读结论：

- 当前 audit reason 已包含 `invalid_transition`、`not_found_or_not_owned`、`invalid_his_connection_payload` 和 `his_connection_name_conflict`。
- 当前 PR 不需要新增 audit reason 或 query whitelist。
- 当前 repository 状态方法稳定结果为 `ok`、`not_found`、`conflict`、`invalid_state_transition`、`validation_failed`，未知异常以 thrown error 进入 service catch。
- 当前 create / update service 已有可复用模式：repository `validation_failed` 写 `invalid_his_connection_payload`，update `not_found` 写 `not_found_or_not_owned`，repository thrown error 不写 denied audit。
- 当前状态 service Plan Mode 的 `conflict` 与 `validation_failed` denied reason 仍需本 PR 收敛。

## 当前 PR 文件职责

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-service-audit-reason-v1-design.md`
  - 记录状态 service audit reason 映射设计、既有 reason 使用范围、不新增项、敏感信息禁区、后续测试要求和拆分顺序。
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-service-audit-reason-v1.md`
  - 记录当前 docs-only PR 的检查结论、执行清单、验证命令和停止条件。
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-service-v1-design.md`
  - 轻量同步前序状态 service 规划中的 denied audit reason 未收敛项，指向本次收敛结论。
- `README.md`
  - 标注状态 service audit reason 映射已规划。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 标注状态 service 实现前置 reason 已收敛。
- `docs/devlog/2026-06-04.md`
  - 追加本分支、目标、完成项、边界和验证命令。

## 当前 PR 执行清单

### 一、创建状态 service audit reason 设计文档

修改文件：

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-service-audit-reason-v1-design.md`

待完成事项：

- [x] 写明当前 PR 是 Plan Mode，只规划状态 service denied audit reason 映射，不实现代码。
- [x] 明确 repository 稳定结果：`ok`、`not_found`、`conflict`、`invalid_state_transition`、`validation_failed`、thrown error。
- [x] 明确 service 稳定结果：`paused`、`resumed`、`revoked`、`deleted`、`not_found`、`conflict`、`invalid_transition`、`validation_failed`、`service_unavailable`。
- [x] 明确 `not_found -> not_found_or_not_owned`。
- [x] 明确 `invalid_state_transition -> invalid_transition`。
- [x] 明确 `validation_failed -> invalid_his_connection_payload`。
- [x] 明确 `conflict -> invalid_transition`。
- [x] 明确 thrown error 返回 `service_unavailable` 且不写 denied audit。
- [x] 明确不新增状态专用 audit reason 或 audit action。
- [x] 明确后续 service 只能使用既有 reason。
- [x] 明确 allowed audit 不受影响。
- [x] 明确 denied audit 敏感信息禁区。
- [x] 明确后续 service tests 必须覆盖 reason 映射。
- [x] 明确后续拆分。

### 二、创建当前计划文档

修改文件：

- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-service-audit-reason-v1.md`

待完成事项：

- [x] 记录目标、背景和范围。
- [x] 记录只读检查文件和结论。
- [x] 记录当前 PR 文件职责。
- [x] 记录执行清单。
- [x] 记录验证命令。
- [x] 记录停止条件。

### 三、轻量同步既有文档

修改文件：

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-service-v1-design.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-04.md`

待完成事项：

- [x] 前序状态 service spec 标注 reason 已由本 PR 收敛。
- [x] README 标注状态 service audit reason 映射已规划。
- [x] roadmap 标注状态 service 实现前置 reason 已收敛。
- [x] devlog 追加本分支、目标、完成项、边界和验证命令。

### 四、验证 docs-only diff

运行命令：

```bash
git status --short
git diff --name-only origin/main...HEAD
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

同时执行：

```bash
git diff --name-only origin/main...HEAD | grep -E '^(src/|package-lock\.json|package\.json|\.env|\.codex/)' && exit 1 || true
```

必须满足：

- changed files 只包含允许的 Markdown 文件。
- 不包含 `src/**`。
- 不包含 API route、service、repository、parser、权限、audit domain、audit repository、schema / migration。
- 不包含 `package.json`、lockfile、`.env*`、`.codex`、Superpowers 缓存目录或技能文件。
- 空白检查通过。

## 后续拆分建议

建议后续独立 PR 顺序：

1. 状态 service 最小实现。
2. pause / resume route。
3. revoke / delete route。
4. 状态 API route tests。
5. 如 reason 不足，再进入 audit reason / query whitelist 增强。

## 停止条件

出现以下任一情况，当前 PR 必须停止并回报：

- 必须写 TypeScript 代码。
- 必须改测试。
- 必须修改 `src/**`。
- 必须新增 API route。
- 必须修改现有 GET / POST / PATCH。
- 必须新增或修改 service。
- 必须新增或修改 parser。
- 必须新增或修改 repository。
- 必须改 schema 或 migration。
- 必须真正修改权限、认证或租户隔离实现。
- 必须修改 audit domain / reason / query whitelist。
- 必须修改 audit repository。
- 必须新增 audit reason。
- 必须新增 audit action。
- 必须处理凭证管理。
- 必须做测试连接。
- 必须接真实 HIS、机构系统、企微、AI、RAG、Agent 或自动触达。
- 必须保存或返回真实凭证。
- 必须保存或返回 raw HIS payload。
- 必须保存完整病历、完整治疗正文或咨询全文。
- 必须自动创建治疗摘要或随访任务。
- 必须修改 demo seed 数据。
- 必须修改 package.json 或 lockfile。
- 必须修改 `.env*`。
- 必须修改 `.codex`、Superpowers 缓存目录或技能文件。
