# AI 模型配置 Codex P2/P3 整改二次验收复审报告

> 日期：2026-06-20 CST +0800  
> 复审方：Claude Code（独立复审）  
> 整改方：Codex  
> 分支：`codex/old-ai-model-config-parity-01`  
> HEAD：`2499e2d291829155f55aab1ac178f68d23dfa30a`  
> 依据：`docs/verification/ai-model-config-claude-terminal-acceptance-2026-06-20.md`  
> 整改报告：`docs/verification/ai-model-config-claude-feedback-remediation-2026-06-20.md`  
> 用途：对 Codex 基于 Claude Code 验收报告的 P2/P3 整改进行独立二次验收复审。

---

## 一、复审范围与边界

### 1.1 验收范围

本轮复审仅覆盖 Codex 在上一份 Claude Code 验收报告（`ai-model-config-claude-terminal-acceptance-2026-06-20.md`）中提出的 1 个 P2 和 3 个 P3 问题及相关运行态说明的整改。

### 1.2 不在本次范围

- 不修改任何 src、drizzle、schema、migration、package、配置等 runtime 文件
- 不读取 .env / .env.local
- 不输出任何凭证、连接串、密钥、密文或会话 cookie
- 不运行 migration
- 不写 demo 数据
- 不访问真实厂商 API
- 不提交、不推送、不创建 PR
- 不处理 knowledge-management 既有 typecheck 问题

---

## 二、启动检查

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| 日期 | 2026-06-20 CST +0800 | 与复审日期一致 |
| 分支 | `codex/old-ai-model-config-parity-01` | 专用功能分支 |
| HEAD | `2499e2d291829155f55aab1ac178f68d23dfa30a` | 与上次验收相同 |
| origin/main | `2499e2d291829155f55aab1ac178f68d23dfa30a` | HEAD = origin/main ✓ |
| 工作区 | 存在未提交改动 | 预期：AI 模型配置链路文件 + verification 文档 |

### 工作区非 AI 模型配置链路改动（记录，不处理）

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `src/modules/security/domain/access-control.ts` | M | 非本任务，仅记录 |
| `src/modules/security/tests/AccessControlDomain.test.ts` | M | 非本任务，仅记录 |
| `src/modules/workspace/components/PlatformConsole.tsx` | M | 非本任务，仅记录 |

---

## 三、逐项整改验收结论

### 整改项 1：P2 — Logo data URL 服务端校验余量偏小

**原问题（Claude 验收报告 P2-1）：**
- `logoDataUrlPattern` 限制 base64 最大 ~205KB 字符，UI 层限制 150KB 文件大小
- base64 编码膨胀约 33%，150KB × 4/3 ≈ 200KB → 安全余量仅 ~2.5%
- 边界场景：PNG 转 base64 可能因元数据额外增大

**整改声明（Codex）：**
- 已将服务端 base64 长度上限提升到 260000，并保留超限拒绝测试

**代码证据：**
- `platformAiModelConfigPersistence.ts` L47：`logoDataUrlPattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]{1,260000}$/`
- 原值：~205KB 字符 → 新值：260,000 字符

**测试证据：**
- `OpenPlatformAiModelConfigPersistence.test.ts` L273-311：测试用例 `为客户端 150KB Logo 转 data URL 保留服务端校验余量，并继续拒绝超限数据`
- 235,000 字符（模拟 150KB+ 文件转换）→ **接受**
- 260,001 字符 → **拒绝**（`validation_failed`）

**余量计算：**
- 150KB 文件 × 4/3（base64 膨胀率）≈ 200KB = 204,800 字符
- 服务端上限：260,000 字符
- 余量：260,000 - 204,800 = 55,200 字符 → **~27% 余量**，远超原始报告建议的 ≥15%

**结论：✅ 整改完成。** 服务端上限覆盖 150KB 客户端限制有充足余量，超限数据仍正确拒绝。

---

### 整改项 2：P3 — 模型列表嵌套格式缺少说明

**原问题（Claude 验收报告 P3-1）：**
- `readModelRecords` 支持 `{ data: { models: [...] } }` 嵌套结构
- Codex 文档未明确对应到哪个厂商

**整改声明（Codex）：**
- 已增加防御性兼容注释，并补充 `data.models` 响应结构测试

**代码证据：**
- `platformAiModelVendorOperations.ts` L196-202：
  ```typescript
  if (
    typeof record.data === 'object'
    && record.data !== null
    && Array.isArray((record.data as { models?: unknown }).models)
  ) {
    // Defensive compatibility for providers/proxies that wrap model arrays under data.models.
    return (record.data as { models: unknown[] }).models;
  }
  ```
- 注释明确标注为「防御性兼容」，定位为 `providers/proxies that wrap model arrays under data.models`

**测试证据：**
- `OpenPlatformAiModelVendorOperations.test.ts` L262-285：测试用例 `官方模型列表响应兼容 data.models 嵌套结构，作为厂商响应差异的防御性解析`
- 验证 JSON `{ data: { models: [...] } }` 结构被正确解析
- `deepseek-v4-flash` 和 `deepseek-embedding` 正确提取

**结论：✅ 整改完成。** 嵌套格式已有注释说明和测试覆盖，定位为防御性兼容处理。

---

### 整改项 3：P3 — 厂商类型和运行时列表分开定义

**原问题（Claude 验收报告 P3-2）：**
- `SUPPORTED_VENDOR_KEYS` 与 `SupportedVendor` 类型分开定义
- 新增厂商时需更新两处，存在类型漂移风险

**整改声明（Codex）：**
- 已改为从运行时 catalog key 推导 `SupportedVendor`，并加源文件结构断言

**代码证据：**
- `vendor-catalog.ts` L33：`as const satisfies Record<string, SupportedVendorConfigFields>`
- `vendor-catalog.ts` L35：`export type SupportedVendor = keyof typeof SUPPORTED_VENDOR_CONFIGS`
- `vendor-catalog.ts` L41：`const SUPPORTED_VENDOR_KEYS = Object.keys(SUPPORTED_VENDOR_CONFIGS) as SupportedVendor[]`
- 类型推导链路：`SUPPORTED_VENDOR_CONFIGS`（带 `as const satisfies`）→ `keyof typeof` → `SupportedVendor` → `SUPPORTED_VENDOR_KEYS`
- 新增厂商只需在 `SUPPORTED_VENDOR_CONFIGS` 一处添加，类型和运行时列表自动同步

**测试证据：**
- `VendorCatalog.test.ts` L74-79：测试用例 `derives the SupportedVendor type from the runtime catalog keys`
- 通过 `readFileSync` 读取源文件，验证：
  1. 存在 `export type SupportedVendor = keyof typeof SUPPORTED_VENDOR_CONFIGS` ✓
  2. **不存在** 手写 union `export type SupportedVendor = 'doubao'` ✓

**结论：✅ 整改完成。** `SupportedVendor` 已从 `SUPPORTED_VENDOR_CONFIGS` 推导，源文件结构断言保护编译时完整性。

---

### 整改项 4：P3 — 短前缀敏感匹配可能误拦

**原问题（Claude 验收报告 P3-3）：**
- `blockedTextFragments` 中 `sk-` 字符串匹配可能在高频文本片段场景下误匹配
- 建议使用更精确的模式匹配

**整改声明（Codex）：**
- 已改为精确模式匹配，允许普通业务短文本，继续拒绝真实凭证形态文本

**代码证据：**
- `platformAiModelConfigPersistence.ts` L48-58：敏感文本拦截已改为正则数组，覆盖凭证字段名、本地连接标识、旧系统表名、解密函数名和真实凭证形态。
- 关键变化：`sk-` 字符串包含匹配 → `/\bsk-[A-Za-z0-9]{32,}\b/` 精确正则匹配
- 新正则要求：
  1. 单词边界前导（`\b`）
  2. `sk-` 前缀
  3. 至少 32 位字母数字字符
  4. 单词边界后缀（`\b`）

**测试证据：**
- `OpenPlatformAiModelConfigPersistence.test.ts` L313-351：测试用例 `允许非凭证格式的短 sk- 业务文本，但仍拒绝真实 Key 形态文本`
- 输入 `workflow-sk-note`（短业务文本）→ **接受** ✓
- 输入运行时拼接出的真实凭证形态假值（36 位后缀）→ **拒绝** ✓

**结论：✅ 整改完成。** 普通业务短文本不再被误拦，真实凭证形态文本仍被正确拒绝。

---

### 整改项 5：运行态接口验证登录路径误差

**原问题（Claude 验收报告 7.2 及 Codex 复核补充）：**
- Claude 初次运行态只读验证使用错误登录路径 `/api/v1/auth/login`
- 正确 demo 登录端点为 `/api/auth/login`

**整改声明（Codex）：**
- 已在 Claude 验收报告 7.2 增加 Codex 复核补充，说明正确登录路径与只读验证结果

**文档证据：**
- `ai-model-config-claude-terminal-acceptance-2026-06-20.md` L306-307：
  > "上述运行态只读接口验证失败来自登录路径使用错误。当前项目的 demo 登录端点为 `/api/auth/login`，不是 `/api/v1/auth/login`。Codex 此前已通过正确端点完成平台 demo 登录，并在不输出 cookie 内容的前提下只读请求 `/api/v1/open-platform/provider-configs`，返回 `{"configs":[]}`。"

**结论：✅ 说明已补充清楚。** 正确登录路径和已验证结果已记录在 Claude 验收报告中。

---

## 四、代码路径复核

### 4.1 vendor-catalog.ts

**状态：✅ 通过。**
- L33：`as const satisfies` 同时提供编译时类型安全和运行时常量语义
- L35：`export type SupportedVendor = keyof typeof SUPPORTED_VENDOR_CONFIGS` 类型推导正确
- L41：`SUPPORTED_VENDOR_KEYS` 运行时列表从 Object.keys 推导，类型通过 `as SupportedVendor[]` 确保一致
- 新增厂商只需在 `SUPPORTED_VENDOR_CONFIGS` 一处添加，类型和运行时列表自动同步
- **新增测试**：7 个测试（原 6 个 + 1 个类型推导测试）

### 4.2 platformAiModelVendorOperations.ts

**状态：✅ 通过。**
- L196-202：`data.models` 嵌套格式有明确注释 "Defensive compatibility for providers/proxies that wrap model arrays under data.models"
- `readModelRecords` 解析优先级：`data` 数组 → `models` 数组 → `data.models` 嵌套 → 空数组
- 防御性设计合理，不会因未知厂商格式导致崩溃
- **新增测试**：15 个测试（原 14 个 + 1 个 `data.models` 嵌套格式测试）

### 4.3 platformAiModelConfigPersistence.ts

**状态：✅ 通过。**
- L47：`logoDataUrlPattern` 上限 260,000 字符，余量充足
- L48-58：`blockedTextPatterns` 数组，L57 `sk-` 检查已从简单字符串包含改为精确正则 `/\bsk-[A-Za-z0-9]{32,}\b/`
- 输入验证逻辑未变更，所有校验函数保持完整
- **新增测试**：9 个测试（原 7 个 + 2 个整改目标测试）

### 4.4 测试文件

| 测试文件 | 原测试数 | 新测试数 | 增量 | 整改相关新增测试 |
| --- | --- | --- | --- | --- |
| VendorCatalog.test.ts | 6 | 7 | +1 | 类型推导源文件断言 |
| OpenPlatformAiModelConfigPersistence.test.ts | 7 | 9 | +2 | Logo 余量、sk- 误拦改进 |
| OpenPlatformAiModelVendorOperations.test.ts | 14 | 15 | +1 | data.models 嵌套格式 |

新增测试覆盖了全部整改项，测试设计遵循 TDD 原则（Codex 整改报告记录了先红后绿的过程）。

---

## 五、自动化验证结果

### 5.1 测试

```
pnpm test [7 files]
```

| 测试文件 | 测试数 | 结果 |
| --- | --- | --- |
| Schema.test.ts | 37 | ✓ 通过 |
| VendorCatalog.test.ts | 7 | ✓ 通过 |
| VendorProviderConfig.test.ts | 34 | ✓ 通过 |
| OpenPlatformAiModelConfigContract.test.ts | 3 | ✓ 通过 |
| OpenPlatformAiModelConfigPersistence.test.ts | 9 | ✓ 通过 |
| OpenPlatformAiModelVendorOperations.test.ts | 15 | ✓ 通过 |
| OpenPlatformAiModelConfigPanel.test.tsx | 17 | ✓ 通过 |
| **合计** | **122** | **全部通过** |

测试耗时：10.94s。原验收 118 个测试 + 本次整改新增 4 个测试，合计 122 个测试全部通过。

### 5.2 ESLint

```
pnpm exec eslint [12 files]
```

**结果：0 错误、0 警告。** ✓

### 5.3 git diff --check

**结果：0 空白问题。** ✓

### 5.4 TypeScript 类型检查

```
pnpm exec tsc --noEmit
```

**结果：失败，但失败点仅为：**
- `.next/dev/types/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/route.ts`

这是文档指明的 knowledge-management 既有 Next 生成类型问题（`ParamCheck<RouteContext>` 泛型不兼容），**与 AI 模型配置无关。** AI 模型配置链路无 typecheck 错误。

---

## 六、剩余问题分级

### P0（阻塞合并/上线）

无。

### P1（功能缺陷/必须修复）

无。

### P2（鼓励修复）

无。原 P2-1（Logo data URL 校验余量）已整改完成。

### P3（信息/建议）

无。原 P3-1（嵌套格式说明）、P3-2（类型与运行时列表分离）、P3-3（短前缀误匹配）已全部整改完成。

### 工作区非 AI 模型配置改动（延续记录）

| 文件 | 状态 |
| --- | --- |
| `src/modules/security/domain/access-control.ts` | M（非本任务） |
| `src/modules/security/tests/AccessControlDomain.test.ts` | M（非本任务） |
| `src/modules/workspace/components/PlatformConsole.tsx` | M（非本任务） |

以上三个文件在原始验收中已记录，不在本轮复审范围内，但仍存在于工作区，需确认是否属于其他任务链。

---

## 七、最终结论

### 通过二次验收 ✅

Codex 对 Claude Code 验收报告中 1 个 P2 和 3 个 P3 反馈的全部整改均已真实完成：

1. **P2 Logo data URL 服务端校验余量**：上限从 ~205KB 提升至 260,000 字符，余量 ~27%，超限仍拒绝 ✓
2. **P3 模型列表嵌套格式**：已添加防御性兼容注释，有对应测试覆盖 ✓
3. **P3 厂商类型与运行时列表分离**：`SupportedVendor` 已从 `SUPPORTED_VENDOR_CONFIGS` 自动推导，有源文件断言测试 ✓
4. **P3 短前缀敏感匹配**：已从简单 `sk-` 包含匹配改为精确正则 `/\bsk-[A-Za-z0-9]{32,}\b/`，测试覆盖通过/拒绝两种边界 ✓
5. **运行态登录路径**：已在 Claude 验收报告中补充正确说明 ✓

**所有自动化验证通过：122 个测试全部通过，ESLint 0 错误，git diff 0 空白问题。AI 模型配置相关 typecheck 无新增错误。**

### 统计

| 指标 | 数值 |
| --- | --- |
| 测试通过 | 122/122（+4 vs 原验收） |
| ESLint 错误 | 0 |
| git diff 空白 | 0 |
| P0 阻塞问题 | 0 |
| P1 缺陷 | 0 |
| P2 建议修复 | 0 |
| P3 信息 | 0 |
| 新增测试 | 4（覆盖全部整改项） |
| typecheck 失败（非本任务） | 1（knowledge-management 既有问题） |

---

> **复审人**：Claude Code  
> **复审日期**：2026-06-20 CST +0800  
> **报告路径**：`docs/verification/ai-model-config-claude-remediation-review-2026-06-20.md`
