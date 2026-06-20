# AI模型配置 栏目端到端验收报告

> 分支：`codex/old-ai-model-config-parity-01`
> HEAD：`2499e2d291829155f55aab1ac178f68d23dfa30a`
> 日期：2026-06-19 CST +0800
> 验收人：Claude Code
> 目标接收人：Codex（用于任务修复）

---

## 一、验收范围

平台端侧栏「AI模型配置」菜单进入后的完整页面功能，覆盖：
- 信息结构（AI模型、AI 应用默认配置、模型厂商配置）
- 5 家厂商（豆包、DeepSeek、通义千问、智谱GLM、Kimi）折叠/展开
- 能力分组（深度思考、文本生成、视觉理解、向量模型）折叠/展开
- Logo 上传、预览、持久化、刷新恢复
- API Key 输入、显示/隐藏、保存、低敏掩码展示
- 模型启用勾选与计数联动
- 场景默认模型选择、场景预设应用
- Agent 继承关系展示
- 同步模型、模型测试（受控接口调用）
- 安全边界（不输出敏感字段、不返回 Key 原文、不泄露 credentialRef/encryptedApiKey/ciphertext）
- 访问控制（platform_admin 可读写，platform_operator 只读，租户端拒绝）

---

## 二、测试执行情况

### 2.1 自动化测试

| 测试文件 | 测试数 | 结果 |
|----------|--------|------|
| `OpenPlatformAiModelConfigPanel.test.tsx` | 11 | ✅ 全部通过 |
| `OpenPlatformAiModelConfigPersistence.test.ts` | 6 | ✅ 全部通过 |
| `OpenPlatformAiModelConfigContract.test.ts` | 3 | ✅ 全部通过 |
| `OpenPlatformAiModelVendorOperations.test.ts` | 7 | ✅ 全部通过 |
| `VendorProviderConfig.test.ts` | 34 | ✅ 全部通过 |
| **合计** | **61** | **全部通过** |

### 2.2 代码风格检查

```
pnpm exec eslint src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx \
  src/modules/open-platform/server/platformAiModelConfigPersistence.ts \
  src/modules/open-platform/server/platformAiModelConfigPersistenceRepository.ts \
  src/modules/open-platform/server/platformAiModelConfigPersistenceTypes.ts \
  src/modules/open-platform/server/platformAiModelVendorOperations.ts \
  src/modules/open-platform/server/platformAiModelConfigContract.ts \
  src/modules/open-platform/mock/platformAiModelConfig.ts \
  src/app/api/v1/open-platform/ai-model-config/route.ts \
  src/app/api/v1/open-platform/ai-model-config/sync/route.ts \
  src/app/api/v1/open-platform/ai-model-config/test/route.ts \
  src/modules/open-platform/tests/OpenPlatformAiModelConfigContract.test.ts \
  src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts \
  src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx \
  src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts
```

结果：✅ 零问题

### 2.3 git diff --check

结果：✅ 零问题

---

## 三、逐功能验收结果

### 3.1 信息结构（通过 ✅）

- 页面标题为"AI模型"，副标题为"配置平台AI模型提供商，支持豆包、DeepSeek、千问、Kimi"
- 三张摘要卡片：「已启用模型 10」「已配置厂商 5」「默认场景 8」
- 两个主区块：「AI 应用默认配置」和「模型厂商配置」
- **没有**「AI 配额边界」、**没有**「Quota Denied 占位」
- 侧栏「AI模型配置」与「AI用量与费用」已拆分为两个独立菜单项

### 3.2 厂商展示（通过 ✅）

- 5 家厂商全部出现：豆包、DeepSeek、通义千问、智谱GLM、Kimi
- 每个厂商行显示：默认文字 Logo、厂商名、已启用模型计数、Key 掩码状态
- 点击厂商行展开/收起，`aria-expanded` 正确切换
- ChevronRight 图标随展开状态旋转 90°

### 3.3 能力分组（通过 ✅）

- 每个厂商展开后有 4 个能力分组：深度思考、文本生成、视觉理解、向量模型
- 能力分组标题显示已启用/总数（如 `2/2 已启用`）
- 分组独立展开/收起，互不影响
- 展开后显示模型列表（模型 ID、上下文窗口、计费标签、测试按钮、启用勾选框）
- 能力分组收起时 `keepHeaderInPlace` 保持滚动位置

### 3.4 Logo 上传（通过 ✅，持久化恢复受环境阻塞 ⚠️）

| 验收点 | 结果 | 详情 |
|--------|------|------|
| 上传 PNG/JPG/WebP 后厂商头像立即变成图片 | ✅ | `FileReader.readAsDataURL` → setState → `<img src="data:image/...">` |
| `<img>` 标签 src 为 data URL | ✅ | 测试确认 `src` 属性为 `data:image/png;base64,...` |
| Logo 保存成功有明确提示 | ✅ | 显示 `"Logo 已保存：doubao-logo.png"` |
| Logo 保存 PUT 发送到正确接口 | ✅ | `PUT /api/v1/open-platform/ai-model-config`，body 含 `logoRef` data URL |
| Logo 保存失败有明确提示 | ✅ | 显示 `"Logo 保存失败：豆包 持久化服务不可用，刷新后不会保留。"` |
| Logo 保存失败时不会误提示已保存 | ✅ | 测试确认不存在 `Logo 已保存` 文本 |
| 上传超过 150KB 或非图片格式被阻断 | ✅ | 提示 `"Logo 上传失败：仅支持 150KB 内的 PNG、JPG、WebP。"` |
| Logo data URL 不在页面文本中暴露 | ✅ | `container.textContent` 不含 `data:image/png;base64` |
| **刷新后 Logo 恢复** | ⚠️ | 代码链路完整（GET → setLogoPreviewByProvider → renderProviderLogo → `<img>`），但迁移未执行，`platform_ai_model_config_snapshots` 表不存在，持久化功能在运行环境不生效 |

### 3.5 API Key（通过 ✅）

| 验收点 | 结果 | 详情 |
|--------|------|------|
| 输入框默认 type=password | ✅ | 测试确认 `<input type="password">` |
| 输入新 Key 后输入框保留输入痕迹 | ✅ | `keyDraftByProvider` 不在保存后清空 |
| 显示/关闭显示切换 | ✅ | `toggleKeyVisibility` 控制 `type="text"`/`"password"`，按钮文本在"显示"/"关闭显示"间切换 |
| 保存 Key 后有明确成功状态 | ✅ | 显示 `"Key 已保存：豆包"` |
| 保存成功后展示低敏状态 | ✅ | 显示 `"Key 已配置 ****3456"`（格式 `Key 已配置 ****` + 4 位尾号） |
| Key 原文只发到 provider-configs POST | ✅ | `POST /api/v1/open-platform/provider-configs` body 含 `apiKey` |
| Key 原文不发到 ai-model-config PUT | ✅ | `PUT /api/v1/open-platform/ai-model-config` body 只有 `keyStatus`（掩码），无原文 |
| 输入框为空时保存被拒绝 | ✅ | 提示 `"Key 保存失败：豆包 请输入新 Key"` |
| Key 原文不在页面文本中暴露 | ✅ | `container.textContent` 不含原始 Key 字符串 |
| 刷新后低敏状态恢复 | ⚠️ | 受持久化表未创建影响（同 Logo 问题） |

### 3.6 模型启用（通过 ✅）

| 验收点 | 结果 | 详情 |
|--------|------|------|
| 勾选/取消勾选改变启用计数 | ✅ | `toggleModelEnabled` → `setModelEnabledById` → 厂商行和能力分组计数联动更新 |
| 勾选状态在展开/收起间保持 | ✅ | 不因 UI 折叠而丢失状态（React state） |
| 已启用模型行显示绿色背景 | ✅ | `isModelEnabled ? 'bg-green-50' : 'bg-white'` |
| 已启用标签显示 | ✅ | 绿色 badge `"已启用"` |
| 刷新后模型启用状态恢复 | ⚠️ | 受持久化表未创建影响 |

### 3.7 AI 应用默认配置（通过 ✅）

| 验收点 | 结果 | 详情 |
|--------|------|------|
| 8 个业务场景显示 | ✅ | AI 客服、智能随访、预约助手、知识库问答、知识库训练、视觉/OCR、工作流决策、数据分析 |
| 场景默认模型下拉可选 | ✅ | `<select>` 只显示已启用且能力匹配的模型 |
| 切换模型后有状态提示 | ✅ | `"AI 客服 已选择 DeepSeek V4 Flash"` |
| 折叠/展开正常 | ✅ | `<details open>` 含 `<summary>`，ChevronRight 旋转 |
| Agent 继承关系展示 | ✅ | 3 个 Agent（护理、客服、预约），继承场景名和模型名 |
| 场景预设可用 | ✅ | "智能随访"和"运营分析"两个预设，点击后更新对应场景模型 |
| 应用预设后有状态提示 | ✅ | 显示 `"已应用预设：智能随访"` |
| 保存应用配置有成功状态 | ✅ | 显示 `"应用配置 dry-run 已保存"` |
| 刷新后场景配置恢复 | ⚠️ | 受持久化表未创建影响 |

### 3.8 同步模型 / 模型测试（通过 ✅，但有安全隐患 ⚠️）

| 验收点 | 结果 | 详情 |
|--------|------|------|
| 同步调本系统受控接口 | ✅ | `POST /api/v1/open-platform/ai-model-config/sync` |
| 测试调本系统受控接口 | ✅ | `POST /api/v1/open-platform/ai-model-config/test` |
| 显示成功状态 | ✅ | `"同步已完成：豆包"`、`"测试已完成：Seed Pro 2.0"` |
| 显示未配置状态 | ✅ | `"同步失败：豆包 未配置 Key"` |
| 显示超时状态 | ✅ | `"同步超时：豆包"` |
| 显示限流状态 | ✅ | `"同步限流：豆包"` |
| 显示厂商不可用状态 | ✅ | `"同步失败：豆包 厂商不可用"` |
| 按钮标注 `可执行`/`disabled`/`not_available` | ✅ | mock 数据中所有按钮均为 `dry_run` → 标注 `可执行` |
| 测试不访问真实厂商域名（测试文件验证） | ✅ | mock fetcher 域名为 `provider.example.test`，不含 `ark.cn-beijing`/`api.deepseek.com`/`dashscope`/`moonshot` |

### 3.9 安全边界（通过 ✅）

| 验收点 | 结果 | 详情 |
|--------|------|------|
| 不输出 `apiKey` | ✅ | 持久化层 `blockedTextFragments` 拦截 |
| 不输出 `encryptedApiKey` | ✅ | 同上 |
| 不输出 `ciphertext`/`authTag` | ✅ | 同上 |
| 不输出 `DATABASE_URL` | ✅ | 同上 |
| 不输出 `sk-` 前缀 | ✅ | 同上（mock Key 掩码为 `Key 已配置 ****9821`，不含 `sk-`） |
| `maskedLabel` 格式强制 | ✅ | 正则 `/^Key 已配置 \*{4}[A-Za-z0-9]{4}$/` |
| 非 `masked_configured`/`not_configured`/`disabled` 的 keyStatus 被拒绝 | ✅ | 校验层拦截 |
| platform_admin 可读写 | ✅ | `access-control.ts:82-84` |
| platform_operator 只读 | ✅ | `access-control.ts:92-94`，PUT 返回 403 |
| 租户端被拒绝 | ✅ | GET 返回 403 |
| 未登录被拒绝 | ✅ | GET 返回 401 |

### 3.10 保存全部配置（通过 ✅）

- 点击"保存全部配置"触发 `persistAllConfig`
- PUT body 包含：`scenarioDefaults`（场景默认模型映射）、`modelStates`（每个模型的启用状态）、`providerStates`（每个厂商的 logoRef/keyStatus/syncStatus）、`dryRunResults`
- 成功提示 `"全部配置 dry-run 已保存"`
- 持久化受表未创建影响（同 Logo/场景问题）

---

## 四、需要修复和完善的功能

以下问题按优先级排列，建议 Codex 按顺序修复。

### 🔴 高优先级

#### 问题 1：sync/test route 在生产环境可能真实外呼厂商 API

**文件：**
- `src/app/api/v1/open-platform/ai-model-config/sync/route.ts` 第 94 行
- `src/app/api/v1/open-platform/ai-model-config/test/route.ts` 第 96 行

**现状：**
```typescript
// sync/route.ts:94
const adapter = createDefaultAiModelVendorAdapter();
// test/route.ts:96
const adapter = createDefaultAiModelVendorAdapter();
```

`createDefaultAiModelVendorAdapter()` 内部使用真实 `fetch()`：
```typescript
// platformAiModelVendorOperations.ts:241-243
export function createDefaultAiModelVendorAdapter() {
  return createAiModelVendorAdapter({ fetcher: fetch, timeoutMs: 8_000 });
}
```

当 `platform_ai_provider_configs` 表中存在已配置的真实 API Key 时，点击页面"同步模型"或"测试"按钮会：
1. 服务端调用 `decryptSecret(record.encryptedApiKey)` 解密 Key
2. 通过 `fetch()` 向厂商真实公网 API 发起 HTTP 请求（如 `https://ark.cn-beijing.volces.com/api/v3/models`）

**期望行为：**
- 当前阶段（dry-run smoke），sync/test 不应真实外呼任何厂商 API
- 应通过环境变量或配置注入 mock adapter，测试环境和开发环境不发起真实外呼

**修改建议：**
- 方案 A：在 route 中判断环境，非生产环境注入 mock adapter（返回固定的 dry-run 响应）
- 方案 B：将 adapter 作为依赖注入参数传入 `runAiModelVendorSync`/`runAiModelVendorTest`，route 层通过工厂函数根据环境创建不同 adapter
- 方案 C：为 route 增加配置开关 `AI_MODEL_VENDOR_EXTERNAL_CALL_ENABLED`，默认关闭

**涉及文件：**
- `src/app/api/v1/open-platform/ai-model-config/sync/route.ts`
- `src/app/api/v1/open-platform/ai-model-config/test/route.ts`
- `src/modules/open-platform/server/platformAiModelVendorOperations.ts`（可能需要新增 mock adapter 工厂函数）

---

#### 问题 2：persistConfig 失败时调用方不展示失败提示

**文件：** `src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx`

**现状：**
```typescript
// 第 242-252 行
function persistAppConfig(message: string) {
  void persistConfig({...});  // 忽略返回值
}
// 第 254-266 行
function persistAllConfig(message: string) {
  void persistConfig({...});  // 忽略返回值
}
```

`persistConfig` 返回 `boolean`，但 `persistAppConfig` 和 `persistAllConfig` 都丢弃了返回值。
同时在调用点：
```typescript
// 第 537-543 行
onClick={() => {
  setAppConfigStatus('应用配置 dry-run 已保存');  // 先设置成功
  persistAppConfig('应用配置 dry-run 已保存');    // 再异步保存，不管结果
}}
```

**问题：** 先显示成功提示，再发送 PUT。如果 PUT 失败（例如迁移未执行导致表不存在），用户看到的是"已保存"但实际上没有持久化。

**期望行为：**
- 保存按钮点击后先显示"保存中…"
- PUT 成功后显示成功提示
- PUT 失败后显示失败原因

**修改建议：**
```typescript
async function saveAppConfig() {
  setAppConfigStatus('保存中...');
  const saved = await persistConfig({...});
  setAppConfigStatus(saved ? '应用配置已保存' : '保存失败：持久化服务不可用');
}
```

---

### 🟡 中优先级

#### 问题 3：添加 persistConfig 失败的 UI 提示

**文件：** `src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx`

`persistConfig` 函数本身在 catch 时静默返回 `false`（第 236-238 行）：
```typescript
} catch {
  return false;
}
```

这是合理的设计（保持乐观 UI），但调用方需要根据返回值展示不同提示。

**修改建议：** 改造三个保存入口（persistAppConfig/persistAllConfig/updateLogoPreview 中的 persistConfig 调用），使它们：
1. 先显示 `"保存中…"` 
2. 等待 `persistConfig` 完成
3. 根据返回值展示成功或失败

---

#### 问题 4：刷新后配置恢复依赖 migration 执行

**文件：**
- `drizzle/0017_ai_model_config_persistence.sql`
- `src/server/db/schema.ts`（`platformAiModelConfigSnapshots` 表定义，第 267-282 行）

**现状：**
- migration 文件已生成
- schema 已定义
- repository（`createPlatformAiModelConfigSnapshotRepository`）逻辑完整
- persistence service（`savePlatformAiModelConfigPersistedView`/`getPlatformAiModelConfigPersistedView`）逻辑完整
- 前端 `useEffect` load 逻辑完整（第 97-146 行）
- **但 migration 未执行，表不存在于数据库中**

**影响范围：** Logo 持久化、场景默认模型持久化、模型启用状态持久化、全部 dry-run 结果持久化 — 刷新后全部丢失，回到 mock 基线。

**解决方式：** 需要你批准后执行 `pnpm db:migrate`。

---

### 🟢 低优先级/建议

#### 建议 5：文件上传 input 缺少清除功能

**文件：** `src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx` 第 716-725 行

**现状：** Logo 上传 `<input type="file">` 选完文件后再次选择同一文件不会触发 `onChange`（因为 value 没变）。input 没有重置机制。

**建议：** 每次 `onChange` 后通过 ref 重置 input value，确保重复选择同一文件也能触发。

---

#### 建议 6：未配置 Key 时同步/测试按钮的交互可优化

**文件：** `src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx`

**现状：** 即使厂商 Key 未配置，同步/测试按钮仍然可以点击，服务端会返回 `not_configured` 状态。从 UX 角度这是可接受的（让用户知道需要先配 Key），但按钮的 `disabled` 属性只由 `operationStatusLabel[provider.syncStatus]` 决定，mock 数据中所有厂商都是 `dry_run`，所以所有按钮都可点击。

**建议：** 如果当前阶段所有能力都是 dry-run smoke，可以在低敏 note 中补充说明"同步和测试为受控 dry-run 执行，不发起真实厂商 API 调用"。

---

## 五、修复建议的代码示例

### 问题 1 修复示例（sync route）

```typescript
// src/app/api/v1/open-platform/ai-model-config/sync/route.ts

// 方案：从环境变量读取是否允许外呼
const AI_VENDOR_EXTERNAL_CALL_ENABLED =
  process.env.AI_VENDOR_EXTERNAL_CALL_ENABLED === 'true';

function createControlledVendorAdapter() {
  if (AI_VENDOR_EXTERNAL_CALL_ENABLED) {
    return createDefaultAiModelVendorAdapter();
  }
  // 返回 mock adapter：不发起真实外呼，返回 dry-run 成功
  return {
    syncModels: async (input: { vendor: SupportedVendor }) => ({
      ok: true,
      status: 'success' as const,
      vendor: input.vendor,
      syncedModels: [],
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
      errorCode: null,
    }),
    testModel: async (input: { vendor: SupportedVendor; modelId: string }) => ({
      ok: true,
      status: 'success' as const,
      vendor: input.vendor,
      modelId: input.modelId,
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
      errorCode: null,
    }),
  };
}
```

### 问题 2 修复示例（保存应用配置）

```typescript
// 当前代码（第 537-543 行）
<button onClick={() => {
  setAppConfigStatus('应用配置 dry-run 已保存');
  persistAppConfig('应用配置 dry-run 已保存');
}}>

// 建议改为
<button onClick={async () => {
  setAppConfigStatus('保存中...');
  const saved = await persistConfig({
    scenarioDefaults: getScenarioDefaultPatches(),
    dryRunResults: [{ targetType: 'app_config', targetId: 'application-defaults', status: 'dry_run', message: '应用配置已保存' }],
  });
  setAppConfigStatus(saved ? '应用配置已保存' : '应用配置保存失败：持久化不可用');
}}>
```

---

## 六、总结

| 分类 | 数量 |
|------|------|
| 测试通过 | 61/61 |
| ESLint | 0 问题 |
| git diff --check | 0 问题 |
| 功能验收通过项 | 28 |
| 受环境阻塞（migration 未执行） | 4（Logo 恢复、Key 低敏恢复、场景恢复、模型启用恢复） |
| 需修复项 | 4 个问题 + 2 个建议 |
| 需你批准的操作 | `pnpm db:migrate`（执行 0017 migration） |

**总体评价：** 前端面板逻辑正确，持久化链路代码完整，安全边界（低敏输出、访问控制、Key 掩码强制）到位。主要遗留问题是：（1）sync/test route 默认使用真实 fetch 可发起外呼；（2）保存按钮不等待异步结果、不展示失败状态；（3）迁移未执行导致持久化在运行环境不生效。建议 Codex 优先修复问题 1 和问题 2，再执行 migration 验证完整链路。
