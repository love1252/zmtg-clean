# 开放平台 AI 模型配置 & 知识库管理 收尾审查报告

- **审查日期**：2026-06-20 CST +0800
- **审查人**：Claude (reviewer)
- **分支**：`codex/old-ai-model-config-parity-01`
- **HEAD**：`0bf1ac7e69891efdcc7235c303bd270841edd33f`
- **origin/main**：`2499e2d291829155f55aab1ac178f68d23dfa30a`
- **工作区状态**：有未提交改动（27 个 modified + 4 个 untracked）

---

## 审查结论

> **✅ 通过 — 无阻断问题，建议进入推送并创建 Draft PR**

发现 1 个 P2 建议项（审计用户标识硬编码），无 P0/P1 阻断项。

---

## 1. 执行摘要

| 检查项 | 结果 |
|--------|:---:|
| 启动检查（date/branch/HEAD/status） | ✅ |
| 变更范围归类 | ✅ |
| AI 模型配置功能 | ✅ |
| 知识库管理功能 | ✅ |
| 安全边界（敏感字段泄露） | ✅ |
| 安全边界（sync/test dry-run） | ✅ |
| 安全边界（Key 低敏展示） | ✅ |
| 测试（375 passed / 0 failed） | ✅ |
| ESLint（0 warnings） | ✅ |
| TypeScript（0 errors） | ✅ |
| 合并冲突（0） | ✅ |
| 空白检查（0 whitespace errors） | ✅ |

---

## 2. 变更范围归类

### 2.1 AI 模型配置（15 个新增文件）

| 文件 | 类型 | 说明 |
|------|------|------|
| `drizzle/0017_ai_model_config_persistence.sql` | Schema | 新增 `tenant_ai_config` 持久化表 |
| `drizzle/meta/_journal.json` | Schema | Migration journal 更新 |
| `src/server/db/schema.ts` | Schema | Drizzle schema 定义 |
| `src/app/api/v1/open-platform/ai-model-config/route.ts` | API | GET/PUT 配置持久化端点 |
| `src/app/api/v1/open-platform/ai-model-config/sync/route.ts` | API | POST 同步厂商模型 |
| `src/app/api/v1/open-platform/ai-model-config/test/route.ts` | API | POST 测试模型连通性 |
| `src/modules/open-platform/server/platformAiModelConfigContract.ts` | Contract | 配置数据合同校验 |
| `src/modules/open-platform/server/platformAiModelConfigPersistence.ts` | Service | 持久化层（归一化/校验） |
| `src/modules/open-platform/server/platformAiModelConfigPersistenceRepository.ts` | Repository | 持久化仓库接口 |
| `src/modules/open-platform/server/platformAiModelConfigPersistenceTypes.ts` | Types | 持久化类型定义 |
| `src/modules/open-platform/server/platformAiModelVendorOperations.ts` | Service | 厂商操作（sync/test/adapter） |
| `src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx` | UI | AI 模型配置面板 |
| `src/modules/open-platform/mock/platformAiModelConfig.ts` | Mock | 配置 mock 数据 |
| `src/modules/open-platform/tests/OpenPlatformAiModelConfigContract.test.ts` | Test | Contract 测试 |
| `src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx` | Test | 面板组件测试 (17 cases) |
| `src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts` | Test | 持久化测试 (9 cases) |
| `src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts` | Test | 厂商操作测试 (16 cases) |

### 2.2 知识库管理（修改 + 新增）

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/app/api/v1/open-platform/knowledge-management/route.ts` | API | Overview 端点扩展 |
| `src/app/api/v1/open-platform/knowledge-management/files/route.ts` | API | 文件操作端点 |
| `src/app/api/v1/open-platform/knowledge-management/items/route.ts` | API | 知识条目端点 |
| `src/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/route.ts` | API | 条目文件端点 |
| `src/app/api/v1/open-platform/knowledge-management/directories/route.ts` | API | **新增** POST 创建目录 |
| `src/app/api/v1/open-platform/knowledge-management/directories/[directoryId]/route.ts` | API | **新增** PATCH 重命名 / DELETE 归档 |
| `src/app/api/v1/open-platform/knowledge-management/directories/reorder/route.ts` | API | **新增** PATCH 目录排序 |
| `src/modules/open-platform/server/platform-knowledge-management-repository.ts` | Repository | 扩展目录管理仓库方法 |
| `src/modules/open-platform/server/platform-knowledge-management-service.ts` | Service | 扩展目录管理服务方法 |
| `src/modules/open-platform/server/platformKnowledgeManagementApiContract.ts` | Contract | 扩展目录构建逻辑 |
| `src/modules/open-platform/lib/platformKnowledgeManagementViewLoader.ts` | Loader | 扩展视图加载器 |
| `src/modules/open-platform/components/OpenPlatformKnowledgeManagementPanel.tsx` | UI | 知识库管理面板（大规模重构） |
| `src/modules/open-platform/tests/OpenPlatformKnowledgeManagementApiContract.test.ts` | Test | Contract 测试 (9 cases) |
| `src/modules/open-platform/tests/OpenPlatformKnowledgeManagementPanel.test.tsx` | Test | 面板测试（扩展至 21 cases） |
| `src/modules/open-platform/tests/OpenPlatformKnowledgeManagementRealApiRoute.test.ts` | Test | API 路由测试 (19 cases) |
| `src/modules/open-platform/tests/PlatformKnowledgeFileManagementApiRoute.test.ts` | Test | 文件管理路由测试 (7 cases) |
| `src/modules/open-platform/tests/PlatformKnowledgeDirectoryManagementApiRoute.test.ts` | Test | **新增** 目录管理路由测试 (8 cases) |

### 2.3 关联模块变更

| 文件 | 说明 |
|------|------|
| `src/modules/security/domain/access-control.ts` + test | 访问控制域扩展 |
| `src/modules/workspace/components/PlatformConsole.tsx` | 平台控制台导航扩展 |
| `src/modules/open-platform/domain/vendor-catalog.ts` + test | 厂商目录扩展 |
| 其他 Panel 组件 (7 files) | 样式/结构调整，非功能变更 |

### 2.4 未混入无关模块

- 变更范围严格限定在 `open-platform`、`security`、`workspace` 三个模块
- 无 schema migration 以外的数据库结构变更
- 无新增第三方依赖
- 所有 untracked 文件均为新功能文件（directories API + test），无临时文件混入

---

## 3. AI 模型配置功能审查

### 3.1 厂商 Key 保存

| 场景 | 文件 | 行 | 状态 |
|------|------|----|:---:|
| Key 加密存储到数据库 | `platformAiModelVendorOperations.ts` | 625-630 | ✅ |
| 运行时通过 `decryptSecret` 解密 | `platformAiModelVendorOperations.ts` | 566-571 | ✅ |
| 解密后仅函数作用域内使用，不返回客户端 | `platformAiModelVendorOperations.ts` | — | ✅ |
| 持久化存储仅保存 `Key 已配置 ****XXXX` 掩码 | `platformAiModelConfigPersistence.ts` | 177-188 | ✅ |
| `blockedTextPatterns` 黑名单拦截敏感字段写入 | `platformAiModelConfigPersistence.ts` | 48-58 | ✅ |

### 3.2 低敏展示

| 场景 | 文件 | 行 | 状态 |
|------|------|----|:---:|
| 默认掩码显示 `已保存 ****XXXX` | `OpenPlatformAiModelConfigPanel.tsx` | 198-211 | ✅ |
| 新 Key 输入显示 `新 Key ****XXXX` | `OpenPlatformAiModelConfigPanel.tsx` | 205 | ✅ |
| 明文仅在用户主动点击"显示"且本地有草稿时 | `OpenPlatformAiModelConfigPanel.tsx` | 472-479 | ✅ |
| 刷新后草稿丢失，明文不可查看 | `OpenPlatformAiModelConfigPanel.tsx` | 476 | ✅ |
| 前台显示明文时附带提示"刷新后不保留" | `OpenPlatformAiModelConfigPanel.tsx` | 477 | ✅ |

### 3.3 Logo 上传

| 场景 | 状态 |
|------|:---:|
| 仅 PNG/JPG/WebP 格式，150KB 限制 | ✅ |
| 上传后立即替换图标预览 | ✅ |
| 支持恢复默认并持久化空引用 | ✅ |
| 持久化失败时提示刷新后不保留 | ✅ |

### 3.4 同步模型 / 测试模型

| 场景 | 文件 | 行 | 状态 |
|------|------|----|:---:|
| 默认 dry-run（不调用真实厂商 API） | `sync/route.ts` | 36-38 | ✅ |
| 需 `AI_MODEL_VENDOR_EXTERNAL_CALL_ENABLED=true` 才真实外呼 | `sync/route.ts` | 37 | ✅ |
| 测试路由同样受环境变量控制 | `test/route.ts` | 36-43 | ✅ |
| Dry-run adapter 返回空模型列表，不发起网络请求 | `platformAiModelVendorOperations.ts` | 460-468 | ✅ |
| 真实调用还需 provider 已配置 + 存在 encryptedApiKey | `platformAiModelVendorOperations.ts` | — | ✅ |

### 3.5 Secret 泄露防护

- **API 响应全部使用低敏错误码**：`{ ok: false, errorCode: '...' }`，不包含 stack trace 或内部错误消息
- **合同校验层**：`platformAiModelConfigContract.ts:102-108` 强制 keyStatus.kind 只能是三种受控状态
- **持久化黑名单**：`platformAiModelConfigPersistence.ts:48-58` 的 `blockedTextPatterns` 主动拦截敏感数据写入

---

## 4. 知识库管理功能审查

### 4.1 左侧目录树来源

- **完全来自 contract + API + 数据库**，非 mock
- `buildPlatformKnowledgeDirectories()`（`platformKnowledgeManagementApiContract.ts:280-440`）从三个数据源聚合：
  - `items`（知识条目）提供 category 和 folder
  - `files`（文件列表）提供 category 和 folder
  - `sources`（knowledgeSources 表）提供排序和持久化目录
- Service 层 `getPlatformKnowledgeOverviewService` 传入真实 repository 查询数据构造 `PlatformKnowledgeOverviewResponse`

### 4.2 目录管理

| 功能 | 端点 | 状态 |
|------|------|:---:|
| 新增一级目录 | `POST /directories` | ✅ |
| 新增子目录 | `POST /directories` (带 parentId) | ✅ |
| 重命名目录 | `PATCH /directories/[directoryId]` | ✅ |
| 空目录软归档 | `DELETE /directories/[directoryId]` | ✅ |
| 非空目录阻断归档并提示原因 | `DELETE /directories/[directoryId]` → `blocked` | ✅ |
| 目录排序保存 | `PATCH /directories/reorder` | ✅ |
| 刷新后排序恢复（通过 updatedAt 时间戳） | — | ✅ |

所有端点均要求 `platform` scope 鉴权（401/403），有审计记录。

### 4.3 知识库上传下拉联动

- 选项来自真实的 `items` API 响应，key/value/title 均使用 `item.knowledgeId` / `item.title`
- `hasManagedKnowledgeOptions`（`visibleKnowledgeItems.length > 0`）控制 disabled 状态
- 无可选知识库时显示"暂无可选知识库"文案，上传按钮同时 disabled

### 4.4 操作按钮

| 按钮 | 状态 | 说明 |
|------|:---:|------|
| 上传文件 | ✅ 真实链路 | POST multipart，含 tenantId/file |
| 下载文件 | ✅ 真实链路 | GET blob + anchor.click |
| 批量打包下载 | ✅ 真实链路 | tar.gz 打包 |
| 解析文件 | ✅ 真实链路 | POST parse 端点 |
| 归档文件 | ✅ 真实链路 | DELETE 端点 |
| 解析已选 | ⬜ disabled (预留) | 批量解析尚未实现 |
| 新建知识 | ⬜ disabled (预留) | 需后续接入写入接口 |

---

## 5. 安全边界审查

### 5.1 敏感字段扫描

> **全量通过。无真实凭证、密钥、路径或连接串泄露。**

| 扫描模式 | 范围 | 匹配 |
|----------|------|------|
| `DATABASE_URL` | 组件 + API | 0（仅测试防御性断言） |
| `postgres://` | 组件 + API | 0（仅测试防御性断言） |
| `sk-[A-Za-z0-9]{32,}` | 全 src | 0 |
| `encryptedKey` 原文 | mock + test | 0 |
| `ciphertext` / `authTag` | 全 src | 0（仅 persistence 黑名单定义） |
| `storageKey` 外泄 | API 响应路径 | 安全：service 层脱敏 |
| `/Users/` 路径 | 组件 + API | 0 |
| stack trace | API 响应 | 安全：全量 lowSensitiveError 包装 |

### 5.2 Sync/Test 默认 Dry-run

- `sync/route.ts:36-38`：默认 `createDryRunAiModelVendorAdapter()`
- `test/route.ts:36-43`：默认 `runRouteDryRunVendorTest()`
- 环境变量 `AI_MODEL_VENDOR_EXTERNAL_CALL_ENABLED=true` 才启用真实调用
- 多层防护：环境变量 + provider configured + encryptedApiKey 存在

### 5.3 知识库文件接口

- `storageKey` 在 repository 的 `mapFileRow` 中返回，但 service 层通过解构排除
- `sensitiveFieldPolicy` denylist 包含 `storageKey`、`token`、`secret` 等
- 下载直链不暴露原始 storageKey，通过 API 端点代理

### 5.4 新增目录 API 鉴权

- `directories/route.ts`：POST 需要 platform access
- `directories/[directoryId]/route.ts`：PATCH/DELETE 需要 platform access
- `directories/reorder/route.ts`：PATCH 需要 platform access
- 均返回 401（未登录）/ 403（非平台角色）
- 错误使用 `buildReadonlyApiError` 统一脱敏

---

## 6. 发现问题

### P2 — 建议修复（非阻断）

**Issue-01: 上传审计用户标识硬编码**

- **位置**：`OpenPlatformKnowledgeManagementPanel.tsx:943`
- **问题**：`uploadedByUserId` 硬编码为 `'platform-ui'`，非真实用户 ID
- **影响**：审计日志中无法追溯到真实操作人员
- **建议**：改为从 `accessContext.userId` 获取（需要将 accessContext 传递到组件或从 context 中读取）
- **严重级别**：P2 — 不影响功能和安全，但影响审计追溯

### 无 P0/P1 问题

经过扫描未发现：
- 无真实凭证或密钥泄露
- 无测试失败
- 无类型错误
- 无 ESLint 违规
- 无合并冲突
- 无 vendor API 默认真实外呼

---

## 7. 测试结果

```text
pnpm test src/modules/open-platform/tests

 Test Files  54 passed (54)
      Tests  375 passed (375)
   Start at  17:43:43
   Duration  23.10s
```

关键测试覆盖：

| 测试文件 | 用例数 | 关键场景 |
|----------|:-----:|------|
| `OpenPlatformAiModelConfigPanel.test.tsx` | 17 | Key 显示/隐藏、Logo 上传/恢复、同步/测试、持久化、场景预设 |
| `OpenPlatformAiModelVendorOperations.test.ts` | 16 | Dry-run、真实调用、限流、审计 |
| `OpenPlatformAiModelConfigPersistence.test.ts` | 9 | 归一化、黑名单、读写 |
| `OpenPlatformKnowledgeManagementPanel.test.tsx` | 21 | 目录管理、文件操作、上传下载、归档、排序 |
| `OpenPlatformKnowledgeManagementRealApiRoute.test.ts` | 19 | Overview、目录、文件路由 |
| `PlatformKnowledgeDirectoryManagementApiRoute.test.ts` | 8 | 新建/重命名/归档/排序/安全输出 |

### 其他验证

```text
pnpm exec eslint (all changed src + test files) → 0 errors, 0 warnings
pnpm exec tsc --noEmit → 0 errors
git diff --check → 0 whitespace errors
rg '<<<<<<<|=======|>>>>>>>' src docs → 0 merge conflicts
```

---

## 8. 是否建议推送并创建 PR

> **✅ 建议进入"推送并创建 Draft PR"**

理由：
1. 54 个测试文件 375 个用例全部通过
2. ESLint / TypeScript / 合并冲突 / 空白检查全部通过
3. AI 模型配置功能完整：Key 加密存储、低敏展示、干燥运行默认安全
4. 知识库管理功能完整：目录 CRUD、排序持久化、上传联动、归档阻断
5. 安全边界牢固：无敏感数据泄露、sync/test 默认 dry-run、全量低敏错误码
6. 仅有 1 个 P2 建议项（审计用户标识），不构成阻断

---

## 9. 附录

### A. 文件统计

| 类别 | 数量 |
|------|:---:|
| 总变更文件 | 58 |
| 新增文件 | 31 |
| 修改文件 | 27 |
| 新增行数 | ~12,064 |
| 删除行数 | ~1,358 |

### B. 审查环境

- OS: Darwin 24.6.0
- Node: (via pnpm)
- Shell: zsh
- Timezone: CST +0800

### C. 禁止事项遵守情况

| 禁止项 | 遵守 |
|--------|:---:|
| 不读取 .env / .env.local | ✅ |
| 不输出 API Key / DATABASE_URL / secret / token | ✅ |
| 不运行 migration | ✅ |
| 不真实外呼 AI 厂商 API | ✅ |
| 不提交 / 不推送 / 不创建 PR | ✅ |
| 不修改代码（仅写报告） | ✅ |
