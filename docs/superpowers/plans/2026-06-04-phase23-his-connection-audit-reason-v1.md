# Phase 23 HIS 连接配置审计 reason 补强计划

> 本文档是 Plan Mode。当前 PR 只新增和同步 Markdown，规划后续 HIS 连接配置 create / update API 失败路径所需的审计 reason，不修改 `src/**`，不修改 audit domain / reason，不实现 denied audit，不新增 API route，不修改 service、parser、repository、权限、schema 或 migration。

## 目标

规划 HIS 连接配置 create / update 失败路径的审计 reason 补强边界，明确哪些 reason 可以复用、哪些 reason 需要新增或评审、denied audit 的敏感信息禁区，以及后续实现 PR 的最小拆分。

## 背景说明

Phase 23 已完成 HIS 连接配置只读链路、repository 写入链路、payload parser、写入权限和写入 service 最小实现。service 当前只写成功路径 allowed audit，失败路径 denied audit 尚未实现。由于 payload 非法、连接名冲突、repository validation_failed 等场景缺少 HIS 连接配置专用 reason，需要先完成 reason 规划，避免后续 API route 或 service 接入时出现随意命名或敏感信息进入审计。

## 技术范围

当前 PR 只涉及 Markdown。

本 PR 允许修改：

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-audit-reason-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-audit-reason-v1.md`
- `docs/devlog/2026-06-04.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`

本 PR 禁止修改：

- `src/**`
- API route 文件
- service 文件
- repository 文件
- parser 文件
- 权限文件
- audit domain / audit repository
- schema / migration 文件
- `package.json` 或 lockfile
- `.codex`
- Superpowers 缓存目录或技能文件

## 只读检查记录

已只读检查：

- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/domain/audit-event-query.ts`
- `src/modules/audit/server/audit-event-repository.ts`
- `src/modules/audit/tests/*`
- `src/modules/security/domain/access-control.ts`
- `src/modules/institution/server/his-connection-write-input.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/server/his-connection-write-service.ts`
- `src/modules/institution/tests/HisConnectionWriteInput.test.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/modules/institution/tests/HisConnectionWriteService.test.ts`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-write-service-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-write-service-v1.md`
- `docs/devlog/2026-06-04.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`

只读结论：

- 当前 main commit 为 `9fa9337eb3c2187e5b5ccc1e2a151485bc1eab90`。
- 建分支前工作区干净。
- audit domain 已支持 `open_connection` resource。
- audit domain 已支持 `create` / `update` action。
- `AuditReason` 已包含 access decision reason 和 `not_found_or_not_owned`。
- `AUDIT_REASON_VALUES` 是审计查询 reason 白名单，后续新增 reason 需要同步。
- HIS 写入 service 已实现成功 allowed audit。
- HIS 写入 service 尚未实现 denied audit。
- HIS 连接配置 payload 非法、连接名冲突、repository validation_failed 等专用 reason 尚未补强。

## 文件职责

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-audit-reason-v1-design.md`
  - 记录当前审计现状、reason 设计原则、候选 reason、可复用 reason、denied audit 边界和后续拆分。
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-audit-reason-v1.md`
  - 记录当前 docs-only PR 的只读检查、执行清单、验证命令和停止条件。
- `README.md`
  - 轻量同步 Phase 23 写入 service 最小实现已完成，以及审计 reason Plan Mode 进入规划。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步 roadmap 中的当前能力和剩余缺口。
- `docs/devlog/2026-06-04.md`
  - 追加本分支、目标、完成项、边界和验证命令。

## 执行清单

### 一、创建 reason 设计文档

修改文件：

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-audit-reason-v1-design.md`

待完成事项：

- [x] 写明当前 PR 是 Plan Mode，只规划 reason，不实现代码。
- [x] 记录当前 audit domain、query whitelist、repository 和 service 审计现状。
- [x] 明确成功 allowed audit 已由 service 实现。
- [x] 明确 denied audit 尚未实现。
- [x] 规划 `invalid_his_connection_payload`。
- [x] 规划 `his_connection_name_conflict`。
- [x] 评审 `invalid_his_connection_repository_result`。
- [x] 评审是否复用 `not_found_or_not_owned`。
- [x] 明确权限拒绝 reason 可复用 access decision reason。
- [x] 明确 denied audit 不记录 payload、凭证、raw HIS payload、SQL、stack 或 `DATABASE_URL`。
- [x] 规划后续 reason 实现 PR 和 denied audit 接入 PR 拆分。

### 二、创建当前计划文档

修改文件：

- `docs/superpowers/plans/2026-06-04-phase23-his-connection-audit-reason-v1.md`

待完成事项：

- [x] 记录目标、背景和范围。
- [x] 记录只读检查文件和结论。
- [x] 记录文件职责。
- [x] 记录执行清单。
- [x] 记录验证命令。
- [x] 记录停止条件。

### 三、轻量同步项目文档

修改文件：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-04.md`

待完成事项：

- [x] README 追加 Phase 23 审计 reason Plan Mode 状态。
- [x] roadmap 追加审计 reason 规划状态和剩余缺口。
- [x] devlog 追加本分支、目标、完成项、边界和验证命令。

### 四、验证 docs-only diff

运行命令：

```bash
git status --short
git diff --name-only origin/main...HEAD
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
按本 PR 要求执行中文化残留检查
```

预期结果以本 PR 实际输出为准，必须满足：

- changed files 只包含允许的 Markdown 文件。
- 不包含 `src/**`。
- 不包含 API route、service、repository、parser、权限文件。
- 不包含 audit domain / audit repository。
- 不包含 schema / migration。
- 不包含 `package.json`、lockfile、`.codex`、Superpowers 缓存目录或技能文件。
- 空白检查通过。
- 新增 spec / plan 不包含英文模板字段。

## 后续实现拆分

建议后续独立 PR 顺序：

1. audit reason 类型补强。
   - 修改 `AuditReason`。
   - 修改 `AUDIT_REASON_VALUES`。
   - 补充 audit domain 和 query parser tests。
   - 不接入 service denied audit。
2. service denied audit 接入。
   - create / update service 根据安全失败结果写 denied audit。
   - 覆盖 payload 非法、validation_failed、conflict、not_found。
   - 不记录 payload 原文或敏感内容。
3. API route denied audit 接入。
   - API route 接入权限拒绝、parser 失败、service result 到 HTTP 响应。
   - 未登录是否写安全审计单独评审。
4. API route tests。
   - 覆盖 reason、HTTP 状态、敏感字段不泄露和无外部调用。

## 停止条件

出现以下任一情况，当前 PR 必须停止并回报：

- 必须写代码。
- 必须修改 `src/**`。
- 必须修改 audit domain。
- 必须修改 audit reason union / type。
- 必须修改 audit query whitelist。
- 必须修改 audit repository。
- 必须修改 service。
- 必须修改 API route。
- 必须修改 parser。
- 必须修改 repository。
- 必须修改权限实现或权限测试。
- 必须修改 schema / migration。
- 必须实现 denied audit。
- 必须处理凭证管理。
- 必须做测试连接。
- 必须接真实 HIS、机构系统、企微、AI、RAG、Agent 或自动触达。
- 必须导入真实客户数据。
- 必须保存 raw HIS payload。
- 必须保存或返回真实凭证。
- 必须返回 `credentialRef` 给前端 DTO。
- 必须展示凭证明文。
- 必须保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 必须做患者身份匹配。
- 必须自动创建治疗摘要或随访任务。
- 必须修改 demo seed 数据。
- 必须做经营智能中心、图表或导出。
- 必须修改 `package.json` 或 lockfile。
- 必须修改 `.codex`、Superpowers 缓存目录或技能文件。
- 必须引入新的 npm 依赖。
