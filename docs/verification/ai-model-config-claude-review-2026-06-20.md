# AI模型配置 栏目验收复审结论

> 复审人：Claude Code
> 复审日期：2026-06-20 CST +0800
> 被审报告：Codex `ai-model-config-functional-audit-2026-06-20.md`
> 分支：`codex/old-ai-model-config-parity-01`（HEAD `2499e2d`）

---

## 一、复审方法

对 Codex 报告的每一项声称做独立验证：

- 独立重跑全部测试、ESLint、`git diff --check`、`pnpm typecheck`
- 独立审查 sync/test route、saveAppConfig/saveAllConfig、dry-run adapter、安全边界代码
- 标注可独立验证的项与依赖 Codex 本地环境（Supabase / dev server）的项

---

## 二、独立验证结果

### 2.1 自动化测试

| Codex 声称 | Claude 独立重跑 | 一致？ |
|-----------|----------------|--------|
| 6 文件、99 测试全部通过 | 6 文件、99 测试全部通过 | ✅ |
| Schema.test.ts 37 测试 | 37 测试通过 | ✅ |
| Panel.test.tsx 11 测试 | 11 测试通过 | ✅ |
| Persistence.test.ts 6 测试 | 6 测试通过 | ✅ |
| Contract.test.ts 3 测试 | 3 测试通过 | ✅ |
| VendorOperations.test.ts 8 测试 | 8 测试通过 | ✅ |
| VendorProviderConfig.test.ts 34 测试 | 34 测试通过 | ✅ |

### 2.2 静态检查

| Codex 声称 | Claude 独立重跑 | 一致？ |
|-----------|----------------|--------|
| ESLint 0 问题 | 0 问题 | ✅ |
| git diff --check 通过 | 通过 | ✅ |
| typecheck 失败在 .next/dev/types 外部文件 | 同文件、同错误 | ✅ |

### 2.3 sync/test route dry-run 默认行为

Codex 声称"默认不真实外呼厂商"。独立代码审查确认：

- `sync/route.ts:32-36`：新增 `createRouteVendorAdapter()`，读 `AI_MODEL_VENDOR_EXTERNAL_CALL_ENABLED`，默认走 `createDryRunAiModelVendorAdapter()`
- `test/route.ts:32-36`：同机制
- `platformAiModelVendorOperations.ts:245-266`：`createDryRunAiModelVendorAdapter()` 返回内存 mock 成功（不 `fetch`、不访问网络）
- 测试 330 行：`expect(routeFetch).not.toHaveBeenCalled()` — 默认 dry-run 不调 fetch
- 测试 359 行：`vi.stubEnv(externalCallEnvKey, 'true')` + `expect(routeFetch).toHaveBeenCalledTimes(1)` — 显式开启后外呼路径存在且可用

**结论：Codex 声称属实。** ✅

### 2.4 保存按钮 async 修复

Codex 声称"先显示保存中，等待持久化结果后显示成功或失败"。独立代码审查确认：

- `saveAppConfig`（242 行）：`setAppConfigStatus('应用配置保存中...')` → `await persistConfig(...)` → `setAppConfigStatus(saved ? message : '应用配置保存失败：持久化服务不可用')`
- `saveAllConfig`（256 行）：同模式
- `getSaveStatusClassName`（272 行）：失败红色、保存中蓝色、成功绿色
- 测试 315-316 行：`expect(screen.getByText('应用配置保存中...'))` → `waitFor(() => expect(screen.getByText('应用配置保存失败：持久化服务不可用'))`
- 测试 485-486 行：`全部配置保存中...` → `全部配置保存失败：持久化服务不可用`

**结论：Codex 声称属实。** ✅

### 2.5 安全边界

独立验证确认：

- `platformAiModelConfigPersistence.ts:42-51`：`blockedTextFragments` 含 `apiKey`/`encryptedApiKey`/`ciphertext`/`authTag`/`DATABASE_URL`/`sk-`/`decryptApiKey`
- `platformAiModelConfigPersistence.ts:38-41`：`keyMaskPattern` 强制 `Key 已配置 ****XXXX` 格式，拒绝真实 Key 原文
- `platformAiModelConfigPersistence.ts:39-41`：`logoRefPattern` 只允许路径或 data URL，拒绝任意文本
- Key 原文（`apiKey: keyDraft` 417 行）只出现在 `POST provider-configs` 的 body 中，不出现在 ai-model-config PUT/GET 中
- 所有测试的 `expectNoForbiddenContent`/`expectSafePayload` 均通过

**结论：Codex 声称属实。** ✅

### 2.6 Supabase 持久化

Codex 声称"Supabase 项目 `zmtg-clean-dev`，表存在，migration 已执行，API 读写成功"。

**此项 Claude Code 无法独立验证**（需连接 Supabase 实例，涉及 `.env.local` 中的 `DATABASE_URL`）。

代码层级的持久化链路审查确认：
- `platformAiModelConfigPersistenceRepository.ts`：`upsertSnapshot`（INSERT ON CONFLICT DO UPDATE）和 `findSnapshot` 正确
- `route.ts`：GET/PUT 正确调用 repository
- `useEffect`（Panel 97-146 行）：GET 读回后 setState 恢复 Logo/场景/Key 状态/keyDraft 保护

**结论：Codex 声称可信，代码链路完整，但 Claude Code 无法独立复现 Supabase 端操作。** ⚠️

### 2.7 typecheck 阻塞

Codex 声称"全局 typecheck 失败在 `.next/dev/types/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/route.ts`，不是本栏目改动引入"。

独立验证确认：
- `pnpm exec tsc --noEmit` 失败，错误指向 `FilesRouteContext.params` 与 Next `RouteContext` 约束不匹配
- 错误在 `.next/dev/types/`（Next.js 自动生成）下，不在 `src/` 目录
- 错误模块是 `knowledge-management`，不是 AI 模型配置
- 该 `.next/dev/types` 文件由 Next.js 构建过程生成，非本次改动的文件

**结论：Codex 分类为"外部阻塞"正确，不是本次改动引入。** ✅

---

## 三、Codex 报告逐项评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 事实准确性 | ✅ 准确 | 独立验证的每项声称均属实 |
| 测试覆盖陈述 | ✅ 准确 | 99 测试、6 文件与独立重跑一致 |
| sync/test dry-run 陈述 | ✅ 准确 | 代码和测试双重验证通过 |
| 保存按钮修复陈述 | ✅ 准确 | 异步等待+失败提示代码完整 |
| Supabase 持久化陈述 | ⚠️ 可信但未独立复现 | Claude 端无法直接连 Supabase |
| typecheck 阻塞分类 | ✅ 合理 | 确认为外部既有问题 |
| 剩余问题识别 | ✅ 到位 | P1/P3 两档分级合理 |
| 功能覆盖完整度 | ✅ 无遗漏 | 3.1（6 项）+ 3.2（9 项）共 15 项，覆盖所有按钮和状态 |

---

## 四、本次轮次新增修复确认

上一轮 Claude Code 验收报告（`ai-model-config-e2e-verification-2026-06-19.md`）指出的 4 个问题：

| 原问题 | 当前状态 | 验证依据 |
|--------|----------|----------|
| 🔴 sync/test route 真实外呼 | ✅ 已修复 | `createRouteVendorAdapter()` 默认 dry-run，测试确认 `routeFetch` 未被调用 |
| 🔴 保存按钮假成功提示 | ✅ 已修复 | `saveAppConfig`/`saveAllConfig` 改为 async，先"保存中"再判定成功/失败 |
| 🟡 persistConfig 失败无 UI 反馈 | ✅ 已修复 | 同上，`getSaveStatusClassName` 区分红/蓝/绿三色 |
| 🟡 migration 未执行 | ✅ Codex 已执行 | Codex 报告中确认表存在、API 读写成功 |

---

## 五、最终评定

**Codex 的验收报告内容属实，功能验收结果可采信。**

被审报告与独立复审的差异为零（所有可独立验证项均一致）。报告覆盖了栏目内所有按钮和功能入口，Supabase 持久化陈述代码链路完整且与表结构一致，sync/test dry-run 默认行为正确，安全边界到位。

### 当前状态结论

| 类别 | 状态 |
|------|------|
| 栏目测试（6 文件 99 测试） | ✅ 全部通过 |
| ESLint | ✅ 0 问题 |
| git diff --check | ✅ 0 问题 |
| sync/test 默认 dry-run | ✅ 不真实外呼 |
| 保存按钮异步+失败提示 | ✅ 已修复 |
| 安全边界（Key/连接串/敏感字段） | ✅ 到位 |
| Supabase 持久化 | ⚠️ Codex 已验证，Claude 无法独立复现 |
| 全局 typecheck | ⚠️ 外部阻塞（knowledge-management `.next/dev/types`） |

### 遗留风险

1. **Supabase 持久化未独立复现**：Codex 的本地 Supabase 验证结果无法由 Claude Code 独立确认。建议人工在 Codex 环境中刷新页面确认 Logo/场景/模型启用/Key 低敏状态可恢复后签字。
2. **typecheck 阻塞**：若 PR 门禁包含 `pnpm typecheck`，需要先修复 knowledge-management 的 `.next/dev/types` 问题，或在 PR 风险说明中明确排除。

### 对 Codex 的建议

- Logo input 重复选择同一文件不触发 `onChange`（Codex 报告中已列为 P3）— 影响极小，可不修。
- `syncModels`/`testModel` 前端函数中 `catch` 分支只显示"服务不可用"，无法区分网络断开和超时 — 不影响功能正确性。

---

## 六、执行的命令

```bash
date '+%Y-%m-%d %Z %z' && git branch --show-current && git rev-parse HEAD && git rev-parse origin/main && git status --short
pnpm test src/server/db/tests/Schema.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts src/modules/open-platform/tests/OpenPlatformAiModelConfigContract.test.ts src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts src/modules/open-platform/tests/VendorProviderConfig.test.ts
git diff --check
pnpm exec eslint [14 files]
pnpm exec tsc --noEmit
# 独立代码审查：sync/route.ts, test/route.ts, OpenPlatformAiModelConfigPanel.tsx, platformAiModelVendorOperations.ts, platformAiModelConfigPersistence.ts
```
