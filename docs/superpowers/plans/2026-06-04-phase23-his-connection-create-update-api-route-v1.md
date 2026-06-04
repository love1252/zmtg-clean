# Phase 23 HIS 连接配置创建更新 API route 计划

> 本文档是 Plan Mode。当前 PR 只新增和同步 Markdown，规划后续 `POST /api/institution/his-connections` 与 `PATCH /api/institution/his-connections/[connectionId]` 的 route 接入边界，不新增 API route，不修改 `src/**`。

## 目标

规划 HIS 连接配置 create / update API route 的最小接入顺序，明确 access context、权限判断、parser、service result 映射、route denied audit、DTO、错误响应、测试覆盖和后续拆分。

## 背景说明

Phase 23 已完成写入 repository、payload parser、写入权限、写入 service、审计 reason 和 service denied audit。当前只读 route 已存在，create / update route 尚未实现。为了避免后续 route 一次性混入凭证、测试连接、真实 HIS、状态流转、UI 或外部系统，本 PR 先完成 route 层的文档拆分。

## 技术范围

当前 PR 只涉及 Markdown。

本 PR 允许修改：

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-create-update-api-route-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-create-update-api-route-v1.md`
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

- `src/app/api/institution/his-connections/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/route.ts`
- `src/modules/institution/server/his-connection-write-input.ts`
- `src/modules/institution/server/his-connection-write-service.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
- `src/modules/institution/tests/HisConnectionWriteInput.test.ts`
- `src/modules/institution/tests/HisConnectionWriteService.test.ts`
- `src/modules/security/domain/access-control.ts`
- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/server/audit-event-repository.ts`
- 邻近治疗摘要和客户写入 route。
- 既有 Phase 23 parser、权限、service、reason 和 denied audit 文档。

只读结论：

- 当前 main commit 为 `8eed4e90a8932c656f26b0aabded7a09415fbdd0`。
- 建分支前工作区干净。
- 现有 HIS 连接配置 route 只有 list / detail 只读能力。
- create / update route 尚未实现。
- 写入 parser 已存在并只接受四个安全元数据字段。
- 写入 service 已存在并返回 `{ ok: true }` 最小成功 DTO。
- service 已实现成功 allowed audit 和 repository 失败 denied audit。
- route 层仍需规划权限拒绝 audit、parser 失败 audit、HTTP 映射和 route 测试。

## 文件职责

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-create-update-api-route-v1-design.md`
  - 记录 route 接入顺序、权限边界、parser 边界、service result 映射、route denied audit、DTO、错误响应、测试规划和后续拆分。
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-create-update-api-route-v1.md`
  - 记录当前 docs-only PR 的只读检查、执行清单、验证命令和停止条件。
- `README.md`
  - 轻量同步 Phase 23 service denied audit 与 create / update API route Plan Mode 状态。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步 roadmap 中的当前能力和剩余缺口。
- `docs/devlog/2026-06-04.md`
  - 追加本分支、目标、完成项、边界和验证命令。

## 执行清单

### 一、创建 route 设计文档

修改文件：

- `docs/superpowers/specs/2026-06-04-phase23-his-connection-create-update-api-route-v1-design.md`

待完成事项：

- [x] 写明当前 PR 是 Plan Mode，只规划 route，不实现代码。
- [x] 记录当前 read route、parser、service、权限、reason 和 denied audit 现状。
- [x] 规划 `POST /api/institution/his-connections` 接入顺序。
- [x] 规划 `PATCH /api/institution/his-connections/[connectionId]` 接入顺序。
- [x] 明确 `tenantId` 只能来自 access context。
- [x] 明确 body / query / header / localStorage tenantId 不可信。
- [x] 明确 route 不接收或传递凭证、raw payload、完整请求体、完整响应体、SQL、stack 或 `DATABASE_URL`。
- [x] 明确权限拒绝 audit 使用 `role_denied`、`missing_tenant`、`cross_tenant_denied`。
- [x] 明确 parser 失败 audit 使用 `invalid_his_connection_payload`。
- [x] 明确 route 不重复 service repository failure audit。
- [x] 明确 HTTP 映射、DTO 边界、错误响应边界和测试规划。

### 二、创建当前计划文档

修改文件：

- `docs/superpowers/plans/2026-06-04-phase23-his-connection-create-update-api-route-v1.md`

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

- [x] README 追加 Phase 23 route Plan Mode 状态。
- [x] roadmap 追加 route 规划状态和剩余缺口。
- [x] devlog 追加本分支、目标、完成项、边界和验证命令。

### 四、验证 docs-only diff

运行命令：

```bash
git status --short
git diff --name-only origin/main...HEAD
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

同时执行中文化残留检查和禁止范围检查。

必须满足：

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

1. route 最小实现。
   - 接入 POST / PATCH。
   - 完成 access context、权限、parser、service result 到 HTTP 映射。
   - 不做 UI，不接真实 HIS。
2. route 测试补强。
   - 覆盖成功、401、403、400、409、404、503、DTO 和敏感字段禁区。
3. route permission / parser denied audit。
   - 覆盖权限拒绝和 parser 失败 audit。
   - 不重复 service repository failure audit。
4. smoke / 文档收尾。
   - 确认 read API 与 write API 边界共存。
   - 确认无凭证、测试连接、真实 HIS 或自动触达。

## 停止条件

出现以下任一情况，当前 PR 必须停止并回报：

- 必须写代码。
- 必须修改 `src/**`。
- 必须新增 API route。
- 必须修改现有 API route。
- 必须修改 service。
- 必须修改 parser。
- 必须修改 repository。
- 必须修改权限实现或权限测试。
- 必须修改 audit domain / reason / query whitelist。
- 必须修改 audit repository。
- 必须修改 schema / migration。
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
