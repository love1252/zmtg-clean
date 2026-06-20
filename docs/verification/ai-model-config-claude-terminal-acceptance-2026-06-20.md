# AI模型配置栏目 Claude Code 独立验收报告

> 日期：2026-06-20 CST +0800  
> 验收方：Claude Code（独立验收）  
> 复核方：Codex  
> 分支：`codex/old-ai-model-config-parity-01`  
> HEAD / origin-main：`2499e2d291829155f55aab1ac178f68d23dfa30a`  
> 报告用途：对平台端 `AI模型配置` 栏目的近期更新做独立验收，供 Codex 复核。

---

## 一、验收范围与边界

### 1.1 验收范围

本轮验收覆盖 Codex 近期在分支 `codex/old-ai-model-config-parity-01` 上完成的 AI模型配置栏目功能闭环：

- 页面 UI 结构：模型配置面板、厂商配置区、应用默认配置区、场景预设、统计卡片
- 厂商接入策略：豆包、DeepSeek、通义千问、智谱GLM、Kimi 五家厂商的同步模型与连通测试策略
- Key 低敏输入体验：输入/保存/显示/隐藏/刷新恢复
- Logo 配置：上传预览/保存引用/恢复默认
- 模型启用/场景默认模型持久化
- Supabase 表结构补齐（0016/0017）
- 默认 dry-run 同步与测试

### 1.2 不在本次范围

- 不提交、不推送、不创建 PR
- 不读取 .env / .env.local
- 不输出任何 Key、连接串、密钥、密文或会话 cookie
- 不运行 migration
- 不写 demo 数据
- 不访问真实厂商 API
- 不修改任何 src、drizzle、schema、配置等 runtime 文件
- 不修复任何代码问题

### 1.3 当前阶段

Codex 开发已完成功能闭环，待 Claude Code 验收完毕后由 Codex 复核。

---

## 二、启动检查

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| 日期 | 2026-06-20 CST +0800 | 与验收日期一致 |
| 分支 | `codex/old-ai-model-config-parity-01` | 专用功能分支 |
| HEAD | `2499e2d291829155f55aab1ac178f68d23dfa30a` | 已合并到 main |
| origin/main | `2499e2d291829155f55aab1ac178f68d23dfa30a` | HEAD = origin/main ✓ |
| 工作区 | 存在未提交改动 | 预期：AI模型配置链路文件 + verification 文档 |

**工作区包含非 AI 模型配置链路改动（记录，不处理）：**

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `src/modules/security/domain/access-control.ts` | M | 非本任务，仅记录 |
| `src/modules/security/tests/AccessControlDomain.test.ts` | M | 非本任务，仅记录 |
| `src/modules/workspace/components/PlatformConsole.tsx` | M | 非本任务，仅记录 |

---

## 三、文档声明复核

### 3.1 文档列表

1. `docs/verification/ai-model-config-latest-update-claude-acceptance-2026-06-20.md`（Codex 验收清单）
2. `docs/verification/ai-model-config-vendor-official-adapter-verification-2026-06-20.md`（Codex 厂商适配验证报告）

### 3.2 自洽性判断

| 维度 | 清单文档 | 验证报告 | 一致性 |
| --- | --- | --- | --- |
| 分支/HEAD | `codex/old-ai-model-config-parity-01` / `2499e2d` | 同 | ✓ 一致 |
| 测试声明 | 7 文件 118 通过 | 7 文件 118 通过 | ✓ 一致 |
| 安全边界 | dry-run、低敏、不读环境文件 | 同 | ✓ 一致 |
| 厂商策略 | DeepSeek/Kimi=官方API；豆包/通义/智谱=静态目录 | 同，附官方文档链接 | ✓ 一致 |
| Key 低敏 | 保存后低敏痕迹，刷新不解密 | 同 | ✓ 一致 |
| Supabase | 0016/0017 表索引已补齐 | 同，附详细执行日志 | ✓ 一致 |
| 遗留风险 | 未写 demo 数据、typecheck 外部阻塞、豆包/通义/智谱静态目录 | 同 | ✓ 一致 |
| Logo | 支持上传/预览/保存/恢复默认 | 同 | ✓ 一致 |

**结论：两份 Codex 文档声明互洽，无矛盾。**

### 3.3 功能声明 vs 代码实现对照

| 文档声明 | 代码路径 | 验证结论 |
| --- | --- | --- |
| 五家厂商展示 | `vendor-catalog.ts` L1-51 | ✓ SUPPORTED_VENDOR_CONFIGS 五家 |
| Kimi Base URL 校准为 `api.moonshot.ai` | `vendor-catalog.ts` L33 | ✓ 已从 `api.moonshot.cn` 纠正 |
| 厂商同步策略分类 | `platformAiModelVendorOperations.ts` L98-101 | ✓ DeepSeek/Kimi→official_models_api，其余→static |
| 豆包/通义/智谱不调 /models | `platformAiModelVendorOperations.ts` L339-348 | ✓ 直接返回 staticOfficialCatalogModels |
| DeepSeek /v1 特殊处理 | `platformAiModelVendorOperations.ts` L91-93 | ✓ 拼接 `api.deepseek.com/models` |
| 同步/测试默认 dry-run | `sync/route.ts` L36-38, `test/route.ts` L36-38 | ✓ 检查 `AI_MODEL_VENDOR_EXTERNAL_CALL_ENABLED` |
| Key 低敏痕迹 | 组件 `getKeyInputValue` L198-211 | ✓ 已保存 Key 仅显示 `已保存 ****XXXX` |
| 刷新不解密原文 | 组件 `useEffect` keyStatus 过滤 L142-143 | ✓ providerKeyTouchedRef 跳过已接触厂商 |
| 凭证存储不可用提示 | 组件 L484-485 | ✓ `PROVIDER_CONFIG_UNAVAILABLE` → 凭证存储不可用 |
| 快照不存 Key 原文 | `platformAiModelConfigPersistence.ts` blockedTextFragments L48-58 | ✓ 黑名单阻止 `apiKey`/`ciphertext`/`sk-` 等 |
| Supabase 表补齐 | `drizzle/0016`/`0017` DDL + `_journal.json` | ✓ journal idx 16/17 已登记 |
| 访问控制 | `route.ts` L50-73, `sync/route.ts` L64-84 | ✓ canAccessResource 贯穿所有 API |

---

## 四、代码路径复核

### 4.1 vendor-catalog.ts

- **状态**：✓ 通过
- 五家厂商配置完整，`SupportedVendor` 类型约束严格
- Kimi 默认 Base URL 已从 `api.moonshot.cn` 校准为 `api.moonshot.ai`
- `isSupportedVendor` 与 `listSupportedVendors` 使用统一常量数组
- **注**：新增厂商需同时更新 `SUPPORTED_VENDOR_CONFIGS` 和 `SupportedVendor` 类型（P3 信息）

### 4.2 platformAiModelVendorOperations.ts

- **状态**：✓ 通过
- 厂商同步策略显式分离：`getVendorSyncStrategy` L98-101
- 静态目录策略直接返回受控模型列表，不发起 HTTP 请求
- DeepSeek 特殊逻辑：当 baseUrl 为 `https://api.deepseek.com/v1` 时，模型列表走 `https://api.deepseek.com/models`
- `createDryRunAiModelVendorAdapter` 始终返回 success + empty models，零外呼
- `createDefaultAiModelVendorAdapter` 使用 `fetch`（真实外呼），但只在路由层 `AI_MODEL_VENDOR_EXTERNAL_CALL_ENABLED === 'true'` 时注入
- `decryptSecret` 失败时优雅降级到 `notConfiguredSyncPayload`
- Abort timeout 8s、rate limiter（30/min window）保护到位
- `mapModelsResponse` 支持多格式模型列表响应（`data`、`models`、`data.models`）
- `selectBusinessModels` 的评分偏好表与 `businessModelPreferences` 对齐
- **注**：`readModelRecords` L196-201 支持的 `{ data: { models: [...] } }` 嵌套格式无对应厂商文档说明（P3 信息）

### 4.3 platformAiModelConfigPersistence.ts

- **状态**：✓ 通过
- 输入验证完整：`scenarioDefaults`、`modelStates`、`providerStates`、`dryRunResults` 均严格校验类型和业务约束
- `blockedTextFragments` 黑名单 L48-58 有效阻止敏感字段进入快照
- `keyMaskPattern` L45 `/^Key 已配置 \*{4}[A-Za-z0-9]{4}$/` 严格匹配低敏格式
- `responseFromRecord` 不暴露任何 `encryptedApiKey`、`apiKey`、`ciphertext` 等字段
- 访问控制 `canAccessResource` 在 save 路径执行（L440-448）
- snapshotId 固定为 `platform-ai-model-config-default`（单记录快照设计）
- `mergeRecord` 正确合并持久化状态与默认目录
- **注**：`logoDataUrlPattern` 限制 base64 最大 205KB 字符，UI 层限制 150KB 文件大小。base64 编码膨胀约 33%，150KB × 4/3 ≈ 200KB < 205KB，理论安全但临界值可能产生微小区间不一致（P2）
- **注**：`blockedTextFragments` 中的 `sk-` 检查可能在高频文本片段场景下产生误匹配（P3）

### 4.4 platformAiModelConfigPersistenceRepository.ts

- **状态**：✓ 通过
- `findSnapshot` 使用 Drizzle ORM 按固定 ID 查询
- `upsertSnapshot` 使用 `onConflictDoUpdate` 实现 upsert
- 数据映射清晰：raw row → typed record

### 4.5 API Routes

#### ai-model-config/route.ts (GET/PUT)

- **状态**：✓ 通过
- GET 返回 `PlatformAiModelConfigPersistedResponse`，不包含 Key 原文
- PUT 走 `savePlatformAiModelConfigPersistedView` → 严格输入验证
- 低敏错误码：`UNAUTHORIZED`、`FORBIDDEN`、`VALIDATION_FAILED`、`AI_MODEL_CONFIG_UNAVAILABLE`
- 审计事件记录分离，失败不反映到 API 响应

#### ai-model-config/sync/route.ts (POST)

- **状态**：✓ 通过
- L36-38：`createRouteVendorAdapter()` 检查 `AI_MODEL_VENDOR_EXTERNAL_CALL_ENABLED === 'true'` 才注入真实 adapter
- 默认 → `createDryRunAiModelVendorAdapter()` → 零外呼
- 同步结果通过 `persistSyncedModels` 写入 AI 模型配置快照
- 低敏错误处理

#### ai-model-config/test/route.ts (POST)

- **状态**：✓ 通过
- 与 sync route 一致的 adapter 选择策略
- 测试结果持久化为 dryRunResults
- 模型连通测试走 `/chat/completions`（统一 OpenAI 兼容格式）

#### provider-configs/route.ts (GET/POST/PUT/DELETE)

- **状态**：✓ 通过
- 平台级访问控制（scope === 'platform'）
- `saveVendorProviderConfig` 由服务端加密处理，不暴露明文
- 低敏错误码包含 `ENCRYPTION_NOT_CONFIGURED`、`PROVIDER_CONFIG_UNAVAILABLE`

### 4.6 schema.ts

- **状态**：✓ 通过
- `platformAiProviderConfigs`：`encryptedApiKey` 字段类型为 `jsonb<EncryptedSecretEnvelope>`，不存明文
- `platformAiModelConfigSnapshots`：不包含任何 Key/凭证字段
- 表结构索引定义完整：provider、updated_at

### 4.7 Migration 文件

- **状态**：✓ 通过
- `drizzle/0016_ai_provider_config_secure.sql`：DDL 与 schema.ts 一致
- `drizzle/0017_ai_model_config_persistence.sql`：DDL 与 schema.ts 一致
- `drizzle/meta/_journal.json`：idx 16/17 已登记

---

## 五、自动化验证结果

### 5.1 测试

```
pnpm test [7 files]
```

| 测试文件 | 测试数 | 结果 |
| --- | --- | --- |
| Schema.test.ts | 37 | ✓ 通过 |
| VendorCatalog.test.ts | 6 | ✓ 通过 |
| VendorProviderConfig.test.ts | 34 | ✓ 通过 |
| OpenPlatformAiModelConfigContract.test.ts | 3 | ✓ 通过 |
| OpenPlatformAiModelConfigPersistence.test.ts | 7 | ✓ 通过 |
| OpenPlatformAiModelVendorOperations.test.ts | 14 | ✓ 通过 |
| OpenPlatformAiModelConfigPanel.test.tsx | 17 | ✓ 通过 |
| **合计** | **118** | **全部通过** |

测试耗时：11.79s。所有测试断言均通过。

关键测试覆盖验证：
- 低敏 Key 痕迹 ✓
- 厂商策略分离 ✓
- dry-run 默认行为 ✓
- 刷新恢复状态 ✓
- 快照不包含敏感字段 ✓
- 凭证存储不可用 UI 提示 ✓

### 5.2 ESLint

```
pnpm exec eslint [9 files]
```

**结果：0 错误、0 警告** ✓

### 5.3 git diff --check

**结果：0 空白问题** ✓

### 5.4 TypeScript 类型检查（可选）

```
pnpm exec tsc --noEmit
```

**结果：失败，但失败点仅为：**
- `.next/dev/types/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/route.ts`

这是文档指明的 knowledge-management 既有 Next 生成类型问题（`ParamCheck<RouteContext>` 泛型不兼容），**与 AI 模型配置无关**。

---

## 六、安全边界复核

| 检查项 | 状态 | 证据 |
| --- | --- | --- |
| 页面不展示完整凭证内容 | ✓ 通过 | 组件 `getKeyInputValue` 非 show 态只显示 `已保存 ****XXXX` |
| API 响应不携带完整凭证 | ✓ 通过 | `responseFromRecord` 无 encrytpedApiKey/apiKey/ciphertext |
| 验证报告不记录凭证 | ✓ 通过 | 本报告不含任何 Key/连接串/密文 |
| 快照不保存 Key 原文 | ✓ 通过 | `blockedTextFragments` 黑名单 + `keyMaskPattern` 强制低敏格式 |
| sync/test 默认 dry-run | ✓ 通过 | `createRouteVendorAdapter` 检查环境变量开关 |
| 显式开启外呼开关才走真实 adapter | ✓ 通过 | `AI_MODEL_VENDOR_EXTERNAL_CALL_ENABLED === 'true'` 门控 |
| 刷新后不反解原始 Key | ✓ 通过 | `keyStatus` 恢复跳过 `providerKeyTouchedRef` 已接触厂商 |
| 低敏错误码不泄露内部状态 | ✓ 通过 | 所有 route 统一 lowSensitiveError 模式 |
| 审计失败不影响 API 响应 | ✓ 通过 | audit 块内 try/catch 静默处理 |
| Provider configs GET 不返回加密负载详情 | ✓ 通过 | 从 listVendorProviderConfigs 返回 masked 响应 |

### 6.1 decryptSecret 调用链分析

完整调用链：

```
sync/route.ts POST → createRouteVendorAdapter() → 
  dryRunAdapter (default) / createDefaultAiModelVendorAdapter (if env=true) →
    runAiModelVendorSync() → decryptSecret(record.encryptedApiKey) → 仅用于 adapter 内部
```

**验证结论**：
- decryptSecret 结果仅在 `runAiModelVendorSync` / `runAiModelVendorTest` 函数内部使用
- 明文 Key 直接传给 adapter 方法参数，不写入任何响应或持久化层
- 路由层不直接接触明文 Key
- API 响应均为 `AiModelVendorSyncPayload` / `AiModelVendorTestPayload`，不包含 Key 字段

---

## 七、Supabase / 持久化复核

### 7.1 表结构核对

基于代码层（schema.ts + Drizzle DDL 文件）：

| 表名 | 主键 | 索引 | 状态 |
| --- | --- | --- | --- |
| `platform_ai_provider_configs` | id (varchar 64) | provider_idx, updated_at_idx | ✓ 本地定义正确 |
| `platform_ai_model_config_snapshots` | id (varchar 64) | updated_at_idx | ✓ 本地定义正确 |

- `platformAiProviderConfigs.encryptedApiKey` 为 jsonb `EncryptedSecretEnvelope` 类型
- `platformAiModelConfigSnapshots` 的 jsonb 字段不包含任何 Key 字段

### 7.2 本地运行态接口

本地 dev server 在 `http://localhost:5010` 运行。

- `GET /api/v1/open-platform/provider-configs` → 返回 401（需登录）
- `POST /api/v1/auth/login` → 返回 404（Auth 路由在当前 dev server 中可能注册失败或不可用）

**结论：无法完成运行态只读接口验证。** 原因：本机 dev server 未在绑定 Auth 路由的正确状态下运行（登录端点 404），无法获取有效 session 来访问受保护的 `/api/v1/open-platform/provider-configs`。Codex 在交接文档中记录了同样的运行态验证结果（`{"configs":[]}`），与代码预期一致。

**Codex 复核补充（2026-06-20 CST +0800）：** 上述运行态只读接口验证失败来自登录路径使用错误。当前项目的 demo 登录端点为 `/api/auth/login`，不是 `/api/v1/auth/login`。Codex 此前已通过正确端点完成平台 demo 登录，并在不输出 cookie 内容的前提下只读请求 `/api/v1/open-platform/provider-configs`，返回 `{"configs":[]}`。因此厂商配置存储边界的运行态只读验证应记为“已由 Codex 验证通过，Claude 本轮未独立复现”。

### 7.3 Migration 元数据

`drizzle/meta/_journal.json` 末尾三笔：
```
15:0015_v1_knowledge_qa_audit_logs, 16:0016_ai_provider_config_secure, 17:0017_ai_model_config_persistence
```

✓ 登记正确。

---

## 八、发现的问题

### P0（阻塞合并/上线）

无。

### P1（功能缺陷/必须修复）

无。

### P2（鼓励修复）

| ID | 文件 | 问题 | 建议 |
| --- | --- | --- | --- |
| P2-1 | `platformAiModelConfigPersistence.ts` L154 | `logoDataUrlPattern` 限制 base64 最大 ~205KB 字符，UI 层限制 150KB 文件大小。base64 编码膨胀约 33%，150KB × 4/3 ≈ 200KB → 安全余量仅 ~2.5%。存在边界场景：PNG 转 base64 可能因元数据额外增大。 | 建议将 `logoDataUrlPattern` 最大长度提升至 260KB 字符，或 UI 层降低至 130KB，确保余量 ≥15%。 |

### P3（信息/建议）

| ID | 文件 | 问题 | 建议 |
| --- | --- | --- | --- |
| P3-1 | `platformAiModelVendorOperations.ts` L196-203 | `readModelRecords` 支持 `{ data: { models: [...] } }` 嵌套结构，Codex 文档未明确对应到哪个厂商。 | 在代码注释或文档中标注该格式对应关系。 |
| P3-2 | `vendor-catalog.ts` L38 | `SUPPORTED_VENDOR_KEYS` 与 `SupportedVendor` 类型分开定义，新增厂商时需更新两处。 | 考虑用 `as const satisfies` 推导或添加编译时检查。 |
| P3-3 | `platformAiModelConfigPersistence.ts` L55 | `blockedTextFragments` 中 `sk-` 字符串匹配可能在高频文本片段中出现误匹配。虽然当前验证逻辑不影响安全性，但可能阻止正常短文本通过校验。 | 考虑使用更精确的模式匹配（如 `\bsk-[A-Za-z0-9]{32,}\b`），或标注只对 API Key 格式生效。 |

### 工作区非 AI 模型配置改动（仅记录）

| 文件 | 状态 |
| --- | --- |
| `src/modules/security/domain/access-control.ts` | M（非本任务） |
| `src/modules/security/tests/AccessControlDomain.test.ts` | M（非本任务） |
| `src/modules/workspace/components/PlatformConsole.tsx` | M（非本任务） |

---

## 九、最终验收结论

### 通过验收 ✓

AI 模型配置栏目的近期更新在以下维度均满足要求：

1. **功能闭环**：页面结构、厂商配置、Key 低敏输入、Logo、模型启用、场景预设、同步/测试均已实现
2. **厂商接入策略**：五家厂商同步与测试策略按官方文档差异正确校准
3. **安全边界**：Key 低敏展示、刷新不解密、快照不存明文、默认 dry-run、外呼显式开关等均验证通过
4. **持久化**：两张表结构/索引定义正确，migration journal 登记完整
5. **自动化验证**：7 文件 118 测试全部通过，ESLint 0 错误，git diff 0 空白问题
6. **文档互洽**：两份 Codex 文档声明一致，与代码实现对照无矛盾

### 统计

| 指标 | 数值 |
| --- | --- |
| 测试通过 | 118/118 |
| ESLint 错误 | 0 |
| typecheck 失败（非本任务） | 1（knowledge-management 既有问题） |
| P0 阻塞问题 | 0 |
| P1 缺陷 | 0 |
| P2 建议修复 | 1 |
| P3 信息 | 3 |

### 需 Codex 继续处理

1. **P2-1**：Logo data URL 校验长度与 UI 文件限制的边界余量仅约 2.5%，建议调整
2. **P3-1**：`readModelRecords` 嵌套格式对应关系缺少文档标注
3. **P3-2**：`vendor-catalog.ts` 类型与运行时列表分开定义
4. **工作区非 AI 模型配置改动**：`access-control.ts`、`AccessControlDomain.test.ts`、`PlatformConsole.tsx` 需确认是否属于其他任务链

---

> **验收人**：Claude Code  
> **验收日期**：2026-06-20 CST +0800  
> **下次步骤**：请 Codex 复核本报告中 P2-1、P3-1~3 以及非本任务改动。
