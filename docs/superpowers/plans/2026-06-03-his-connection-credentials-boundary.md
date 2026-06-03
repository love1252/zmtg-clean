# HIS 连接配置与凭证边界实施计划

> **给自动化执行者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐步执行本计划。步骤使用复选框（`- [ ]`）语法跟踪。

**目标：** 只做连接配置与凭证边界 Plan Mode，明确未来接入真实 HIS / 机构系统前连接配置、凭证类型、凭证展示、加密 / 轮换 / 撤销、安全审计、错误降级和权限可见性应如何规划。

**架构：** 当前 PR 不改系统架构，只新增和同步 Markdown。后续真实 HIS adapter 必须在连接配置、凭证管理、健康检查、Webhook / 同步、身份匹配和人工复核边界完成后，才能使用受控连接上下文进入 Phase 22 mapper；adapter 不得绕过 mapper 直接写治疗摘要、随访任务或运营分析。

**技术栈：** 当前 PR 只涉及 Markdown。后续如单独批准实现，才可能涉及 TypeScript、Vitest、Drizzle、连接配置 API、凭证加密、健康检查、Webhook 或同步任务。

---

## 0. 当前 PR 范围

新增：

- `docs/superpowers/specs/2026-06-03-his-connection-credentials-boundary-design.md`
- `docs/superpowers/plans/2026-06-03-his-connection-credentials-boundary.md`

轻量修改：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-03.md`

当前 PR 不做：

- 不写代码。
- 不改测试。
- 不新增 API。
- 不改现有 API。
- 不改数据库 schema。
- 不新增 migration。
- 不改权限、认证或租户隔离。
- 不接真实 HIS。
- 不接机构系统。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做 AI 解析。
- 不做自动触达。
- 不导入真实客户数据。
- 不保存 raw HIS payload。
- 不保存任何真实凭证。
- 不保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 不做患者身份匹配。
- 不自动创建治疗摘要。
- 不自动创建随访任务。
- 不修改 demo seed 数据。
- 不做经营智能中心、图表或导出。
- 不做测试连接实现。

验证命令：

```bash
git diff --check
git diff --cached --check
```

本 PR 不需要跑 Vitest、typecheck 或 Next build，除非误改了代码或测试。

## 1. 只读检查结论

本次按要求只读检查了：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/README.md`
- `docs/devlog/2026-06-03.md`
- `docs/superpowers/specs/2026-06-03-real-his-adapter-preflight-design.md`
- `docs/superpowers/plans/2026-06-03-real-his-adapter-preflight.md`
- `docs/superpowers/specs/2026-06-03-phase22-his-treatment-event-mapper-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase22-his-treatment-event-mapper-v1.md`

并只读搜索了：

- `credential`
- `secret`
- `apiKey`
- `oauth`
- `connection`
- `audit`
- `tenant`
- `permission`

为确认当前平台配置 / 审计 / 权限边界，额外只读查看了：

- `src/modules/audit/domain/audit-events.ts`
- `src/modules/open-platform/domain/governance.ts`
- `src/modules/auth/domain/session.ts`
- `src/modules/security/domain/access-control.ts`

已确认：

- 当前 main HEAD 为 `e88cdf1420b7998f3772fe847411731c85a5013d`。
- 当前工作区开始时干净，本 PR 从 `docs/his-connection-credentials-boundary-plan` 分支执行。
- Phase 22 mapper 最小闭环已完成，真实 HIS adapter 尚未进入实现。
- 真实 HIS adapter 前置评估已把连接配置与凭证边界列为后续独立 PR。
- 当前已有 `open_connection` 治理语义，但不是连接配置 / 凭证管理真实实现。
- 当前审计模型和文档已有禁止 token、secret、连接串、SQL、stack、`DATABASE_URL` 等敏感内容进入审计 / 错误展示的传统。
- 当前租户隔离坚持 `tenantId` 从服务端 access context 推导，机构端不接受前端 `tenantId` 切换租户。

因此本 PR 不需要改 TypeScript、测试、API、schema、migration、权限、认证或租户隔离。

## 2. 文件职责规划

- `docs/superpowers/specs/2026-06-03-his-connection-credentials-boundary-design.md`
  - 说明本 PR 定位、非目标、连接配置建议字段、一租户多连接 / 外部系统多租户边界、凭证类型、凭证明文展示边界、凭证生命周期、权限可见性、审计事件、错误降级、与真实 HIS adapter 的关系和后续 PR 拆分。
- `docs/superpowers/plans/2026-06-03-his-connection-credentials-boundary.md`
  - 说明本 docs-only PR 的范围、只读检查结论、文件职责、执行步骤、验收清单、验证命令和停止条件。
- `README.md`
  - 轻量同步连接配置与凭证边界 Plan Mode 状态，明确仍未进入真实 HIS adapter 或凭证存储实现。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步路线图：连接配置与凭证边界已规划，但 schema / API、加密、健康检查、Webhook / 同步和真实 adapter PoC 仍需单独 PR。
- `docs/devlog/2026-06-03.md`
  - 记录本 PR 范围、边界和验证命令。

## 3. 执行步骤

### 任务 1：新增设计文档

**文件：**

- 新增：`docs/superpowers/specs/2026-06-03-his-connection-credentials-boundary-design.md`

- [ ] 写明本 PR 是连接配置与凭证边界规划，不是实现。
- [ ] 写明不连接真实 HIS、不保存真实凭证、不处理真实客户数据。
- [ ] 规划 `connectionId`、`tenantId` 来源、`connectionName`、`sourceSystem`、`vendorType` / `systemType`、`status`、`createdBy` / `updatedBy`、`createdAt` / `updatedAt`、`lastCheckedAt`、`lastHealthStatus`。
- [ ] 规划一租户多连接、一个外部系统绑定多租户、删除、停用、恢复、撤销边界。
- [ ] 评估 API Key、Basic Auth、OAuth token、签名密钥、mTLS / 专线、IP 白名单、SFTP / 文件导入和厂商专用凭证。
- [ ] 写明凭证明文永不返回前端、永不写审计、永不写日志、永不进入错误信息、永不进入 PR / 文档示例 / demo seed。
- [ ] 规划凭证创建、测试连接、启用、暂停、轮换、过期、撤销、删除、连接失败降级和泄露应急。
- [ ] 规划权限与可见性、平台管理员和机构管理员边界、机构人员 / 平台人员默认不能看到凭证明文。
- [ ] 规划审计事件、审计允许记录和审计禁止记录。
- [ ] 规划错误降级和前端展示边界。
- [ ] 写明连接配置与凭证边界是后续真实 HIS adapter 前置条件。
- [ ] 给出后续 PR A-G 拆分建议。

### 任务 2：新增计划文档

**文件：**

- 新增：`docs/superpowers/plans/2026-06-03-his-connection-credentials-boundary.md`

- [ ] 记录当前 PR 范围和非目标。
- [ ] 记录只读检查文件、关键词和结论。
- [ ] 规划文件职责。
- [ ] 列出执行步骤、验收清单和停止条件。
- [ ] 明确 docs-only 验证命令。

### 任务 3：轻量同步项目文档

**文件：**

- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-06-03.md`

- [ ] README 增加连接配置与凭证边界 Plan Mode 状态。
- [ ] roadmap 增加连接配置与凭证边界完成状态，并保留真实 adapter、schema / API、凭证存储和健康检查未实现的边界。
- [ ] devlog 记录分支、目标、完成项、边界和验证命令。

### 任务 4：验证 docs-only diff

**命令：**

```bash
git diff --check
git diff --cached --check
```

预期：

- 两个命令均退出码为 0。
- 没有 whitespace error。

## 4. 后续 PR 拆分

建议后续拆分为：

- PR A：连接配置与凭证边界 Plan Mode（当前 PR）。
- PR B：连接配置 schema / API Plan Mode。
- PR C：凭证加密与密钥管理 Plan Mode。
- PR D：连接健康检查 / 测试连接 Plan Mode。
- PR E：Webhook / 同步任务 Plan Mode。
- PR F：真实 HIS adapter PoC Plan Mode。
- PR G：真实外部系统接入 PoC，必须另行批准。

PR G 之前不得接真实 HIS，不得保存 raw payload，不得处理真实客户数据，不得保存真实凭证，不得自动摘要、自动任务或自动触达。

## 5. 验收清单

- 设计文档明确本 PR 是连接配置与凭证边界规划，不是连接配置实现、凭证存储实现、测试连接实现或 HIS adapter 实现。
- 设计文档明确不连接任何真实 HIS，不保存任何真实凭证，不处理真实客户数据。
- 设计文档明确不新增 API、不改 schema、不改权限。
- 设计文档覆盖连接配置建议字段和状态机边界。
- 设计文档覆盖凭证类型、明文禁止项、展示边界和生命周期。
- 设计文档覆盖权限与可见性。
- 设计文档覆盖审计事件、允许记录和禁止记录。
- 设计文档覆盖错误降级和展示边界。
- 设计文档说明连接配置与凭证边界和真实 HIS adapter 的关系。
- 计划文档列出后续 PR A-G 拆分建议。
- README、roadmap、devlog 只做轻量状态同步。
- 没有代码、测试、API、schema、migration、权限、认证、租户隔离或 demo seed 变更。
- `git diff --check` 通过。
- `git diff --cached --check` 通过。

## 6. 停止条件

当前 PR 或后续执行中出现以下情况，必须停止并回报：

- 必须写代码才能完成当前 docs-only PR。
- 必须改测试。
- 必须新增 API 或修改现有 API。
- 必须改数据库 schema 或新增 migration。
- 必须改权限、认证或租户隔离。
- 必须接真实 HIS、机构系统、企微或其他外部系统。
- 必须接 AI / RAG / Agent。
- 必须自动触达客户。
- 必须导入真实客户数据。
- 必须保存 raw HIS payload。
- 必须保存任何真实凭证。
- 必须保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 必须做患者身份匹配。
- 必须自动创建治疗摘要。
- 必须自动创建随访任务。
- 必须修改 demo seed 数据。
- 必须做经营智能中心、图表或导出。
