# 真实 HIS adapter 前置评估计划

> **给自动化执行者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐步执行本计划。步骤使用复选框（`- [ ]`）语法跟踪。

**目标：** 只做真实 HIS adapter 的 Plan Mode 前置评估，明确未来接真实 HIS / 机构系统前必须先评估的边界、输入、凭证、安全、租户绑定、幂等、审计和 raw payload 处理策略。

**架构：** 当前 PR 不改系统架构，只新增和同步 Markdown。后续真实 HIS adapter 必须位于外部系统输入和 Phase 22 mapper 之间，adapter 只负责把外部输入转换为 mapper 可接受的安全输入，mapper 输出标准治疗事件；adapter 不绕过 mapper 写治疗摘要、随访任务或运营分析。

**技术栈：** 当前 PR 只涉及 Markdown。后续如单独批准实现，才可能涉及 TypeScript、Vitest、连接配置、Webhook、同步任务或数据库 schema。

---

## 0. 当前 PR 范围

新增：

- `docs/superpowers/specs/2026-06-03-real-his-adapter-preflight-design.md`
- `docs/superpowers/plans/2026-06-03-real-his-adapter-preflight.md`

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
- 不保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 不做患者身份匹配。
- 不自动创建治疗摘要。
- 不自动创建随访任务。
- 不修改 demo seed 数据。
- 不做经营智能中心、图表或导出。

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
- `docs/superpowers/specs/2026-06-03-phase22-his-treatment-event-mapper-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase22-his-treatment-event-mapper-v1.md`
- `docs/superpowers/plans/2026-06-03-phase22-standard-event-contract-gap-review.md`
- `src/modules/institution/domain/standard-treatment-event.ts`
- `src/modules/institution/server/standard-treatment-event-mapper.ts`
- `src/modules/institution/tests/StandardTreatmentEventMapper.test.ts`

已确认：

- 当前 main HEAD 为 `93d05423d43f0bb531af9c3c0904e9d368b35c91`。
- Phase 22 domain-only mapper 最小闭环已完成。
- `StandardTreatmentEvent` 已包含 `recoveryStage`、`rawSourceType` 和 `mappingWarnings`。
- mapper 输入白名单继续使用 `sourceSystem`、`sourceEventId`、`sourceCustomerId` 和 `appointmentRef`，不接受 `externalEventId`、`externalSource`、`customerExternalId` 或 `appointmentExternalId` 核心字段。
- `tenantId`、`eventId` 和 `receivedAt` 继续只来自 mapper context。
- mapper 已拒绝 raw payload、完整正文、PII、图片 / 文件原文、AI 内容、token、secret、SQL、stack、`DATABASE_URL` 和连接串。
- Phase 22 mapper 不调用外部系统、不写数据库、不创建治疗摘要或随访任务。

因此本 PR 不需要改 TypeScript、测试、API、schema 或权限。

## 2. 文件职责规划

- `docs/superpowers/specs/2026-06-03-real-his-adapter-preflight-design.md`
  - 说明真实 HIS adapter 前置评估的定位、非目标、与 Phase 22 mapper 的关系、未来需要评估的边界、raw payload 原则、安全字段边界和后续 PR 拆分。
- `docs/superpowers/plans/2026-06-03-real-his-adapter-preflight.md`
  - 说明本 docs-only PR 的范围、只读检查结论、任务步骤、验收清单、验证命令和停止条件。
- `README.md`
  - 轻量同步真实 HIS adapter 前置评估状态，明确不是 adapter 实现。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步路线图：前置评估完成，但真实 adapter、连接配置、凭证、Webhook、患者身份匹配、人工复核和 PoC 仍需单独 PR。
- `docs/devlog/2026-06-03.md`
  - 记录本 PR 范围、边界和验证命令。

## 3. 执行步骤

### 任务 1：新增设计文档

**文件：**

- 新增：`docs/superpowers/specs/2026-06-03-real-his-adapter-preflight-design.md`

- [ ] 写明本 PR 是真实 HIS adapter 前置评估，不是实现。
- [ ] 写明不连接真实 HIS、不保存真实 HIS payload、不导入真实客户数据。
- [ ] 写明与 Phase 22 mapper 的职责分界。
- [ ] 覆盖租户绑定、连接配置、凭证安全、输入方式、幂等、重试、错误降级、审计、raw payload、字段白名单、敏感字段拒绝、患者身份匹配、人工复核、自动摘要 / 自动任务禁止和自动触达禁止。
- [ ] 写明 raw payload 默认不保存，未来排障片段必须单独评估脱敏、保留时间、权限、审计和删除策略。
- [ ] 写明后续 PR A-G 拆分建议。

### 任务 2：新增计划文档

**文件：**

- 新增：`docs/superpowers/plans/2026-06-03-real-his-adapter-preflight.md`

- [ ] 记录当前 PR 范围和非目标。
- [ ] 记录只读检查文件和结论。
- [ ] 规划文件职责。
- [ ] 列出执行步骤、验收清单和停止条件。
- [ ] 明确 docs-only 验证命令。

### 任务 3：轻量同步项目文档

**文件：**

- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-06-03.md`

- [ ] README 增加真实 HIS adapter 前置评估状态。
- [ ] roadmap 增加前置评估完成状态，并保留真实 adapter 实现未开始的边界。
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

- PR A：真实 HIS adapter spec / plan。
- PR B：连接配置与凭证边界 Plan Mode。
- PR C：Webhook / 同步任务 Plan Mode。
- PR D：患者身份匹配 Plan Mode。
- PR E：人工复核 / 标准事件预览 Plan Mode。
- PR F：adapter domain-only 输入 DTO / parser。
- PR G：真实外部系统接入 PoC，必须另行批准。

PR G 之前不得接真实 HIS，不得保存 raw payload，不得处理真实客户数据。

## 5. 验收清单

- 设计文档明确本 PR 是前置评估，不是 HIS adapter 实现。
- 设计文档明确不连接任何真实 HIS，不保存任何真实 HIS payload，不导入真实客户数据。
- 设计文档明确不新增 API、不改 schema、不改权限。
- 设计文档明确不做自动摘要、自动任务或自动触达。
- 设计文档说明 HIS adapter 和 Phase 22 mapper 的关系。
- 设计文档覆盖租户绑定、外部系统连接配置、凭证安全、Webhook / 定时同步 / 手动导入、幂等键、重试策略、错误降级、审计事件、raw payload、字段白名单、敏感字段拒绝、患者身份匹配、人工复核、自动摘要 / 自动任务禁止和自动触达禁止。
- 设计文档明确 raw payload 默认不保存。
- 设计文档明确未来排障片段必须单独评估脱敏、保留时间、权限、审计和删除策略。
- 设计文档继续禁止手机号原文、身份证号、病历号原文、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文、AI prompt / completion、SQL、stack、token、secret、`DATABASE_URL`、连接串和外部系统凭证明文。
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
- 必须保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 必须做患者身份匹配。
- 必须自动创建治疗摘要。
- 必须自动创建随访任务。
- 必须修改 demo seed 数据。
- 必须做经营智能中心、图表或导出。
