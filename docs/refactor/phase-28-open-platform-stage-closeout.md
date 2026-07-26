# 第二十八阶段：开放平台阶段闭环审计

- 日期：2026-07-27
- 分支：`docs/open-platform-stage-closeout-20260727-002211`
- 基线：`ee4047b3c5d6b667745c8ce56eea468121dc6b88`
- 阶段性质：audit-only
- 审计范围：第二十六至第二十七阶段
- 第二十八阶段源码移动：0

## 结论

第二十六至第二十七阶段已完成闭环。

- 第二十六阶段建立 186 个开放平台文件的职责、依赖、领域所有权和运行时边界基线。
- 第二十七阶段完成 1 个商业权益纯领域文件试点。
- 试点保持文件 blob、import、export 和运行时行为不变。
- 试点具备明确回退路径。
- 开放平台全部文件已获得治理分类。
- 开放平台剩余项均不阻断第二十九阶段下一模块选择审计。
- 正式业务源码累计移动：3 个。

## 第二十六阶段基线

- 开放平台文件：186
- 依赖边：684
- 领域所有者：9
- 运行时边界、跨模块依赖、循环和反向依赖证据均保留于第二十六阶段机器清单。

## 第二十七阶段试点

- 原路径：`src/modules/open-platform/domain/tenant-plan-change.ts`
- 当前路径：`src/modules/open-platform/domain/commercial_entitlement/tenant-plan-change.ts`
- blob：`59c7d6bed836ed8b56cc0376b3203b156c41eb88`
- import：1 个 type-only
- type export：4
- function export：3
- 直接调用方：4
- 直接测试：1
- 旧 import：0
- 新 import：4
- 新增跨模块依赖：0
- 新增循环依赖：0
- 新增反向依赖：0

机器可读追溯：

- `docs/refactor/phase-28-open-platform-pilot-traceability.csv`

## 开放平台治理分类

| 分类 | 数量 | 含义 |
|---|---:|---|
| 已完成试点 | 1 | 第二十七阶段已完成纯领域移动 |
| 可迁移 | 1 | 领域归属明确且无受保护边界的后续候选 |
| 保持当前位置 | 27 | 页面、组件、客户端、测试、共享或非核心迁移文件 |
| 保护边界 | 156 | 仓储、运行时、跨模块、循环或反向依赖边界 |
| 延期处理 | 1 | 调用方多、体积大或 import 复杂的核心文件 |

- 分类总数：186
- 剩余文件：185
- 未分类文件：0

机器可读分类：

- `docs/refactor/phase-28-open-platform-remaining-classification.csv`

## 分类规则

### 已完成试点

仅包括第二十七阶段已移动文件。

### 可迁移

同时满足：

1. 职责为 `domain`、`contract_types` 或 `server_service`；
2. 领域所有者不是 `shared`；
3. 不属于 server repository；
4. 无运行时边界 token；
5. 无跨模块入向或出向依赖；
6. 无循环依赖；
7. 无反向依赖；
8. 直接调用方不超过 8；
9. 文件不超过 600 行；
10. import 不超过 8。

该分类只表示后续候选，不自动授权迁移。

### 保持当前位置

包括组件、页面、客户端、测试、共享归属或其他不属于当前核心迁移目标的文件。

### 保护边界

出现任一情况：

- server repository；
- 数据库、环境变量、网络、Next、React、浏览器或凭证边界；
- 跨模块入向或出向依赖；
- 循环依赖；
- 反向依赖。

### 延期处理

核心领域、契约或服务文件不存在保护边界，但调用方、文件体积或 import 复杂度超过当前试点阈值。

## 审查修正记录

- 机构端测试 `src/modules/institution/tests/InstitutionKnowledgeReadonlyShell.test.tsx` 对 OCR provider 存在 2 处动态模块路径引用：
  1. 初始化模块路径清单；
  2. `vi.doMock` 未初始化保护。
- 该动态测试引用属于跨模块入向依赖。
- `platform-knowledge-ocr-provider.ts` 已由“可迁移”改为“保护边界”。
- 修正后可迁移文件为 1，保护边界文件为 156。
- 第二十六阶段历史机器清单保持不变；第二十八阶段分类显式记录该后发现证据。


### 全量动态模块路径补扫

- 对账基线：第二十六阶段 `docs/refactor/phase-26-open-platform-dependency-edges.csv` 的 684 条已识别依赖边。
- 补扫范围：全部 `src/**/*.ts` 和 `src/**/*.tsx` 中引用开放平台模块的字符串字面量。
- 判定方式：仅将“源文件—目标文件”不在既有依赖边中的引用记为遗漏动态路径依赖。
- 新发现动态依赖对：26。
- 受影响目标文件：12。
- 修正统计的目标文件：11。
- 当前分类总数仍为 186，未分类文件仍为 0。

- `src/modules/open-platform/domain/tenant-plan-binding.ts`：inbound 10 → 11，tests 3 → 3，cross-module inbound 0 → 0，分类 `defer` → `defer`；新增动态来源：`src/modules/open-platform/domain/commercial_entitlement/tenant-plan-change.ts`。
- `src/modules/open-platform/server/homepage-brand-repository.ts`：inbound 5 → 6，tests 2 → 3，cross-module inbound 0 → 1，分类 `protected_boundary` → `protected_boundary`；新增动态来源：`src/modules/marketing/tests/MarketingPage.test.tsx`。
- `src/modules/open-platform/server/platform-knowledge-ai-provider-adapter.ts`：inbound 5 → 6，tests 4 → 5，cross-module inbound 0 → 0，分类 `protected_boundary` → `protected_boundary`；新增动态来源：`src/modules/open-platform/tests/PlatformKnowledgeQaApiRoute.test.ts`。
- `src/modules/open-platform/server/platform-knowledge-embedding-vector-search-service.ts`：inbound 13 → 15，tests 6 → 8，cross-module inbound 4 → 5，分类 `protected_boundary` → `protected_boundary`；新增动态来源：`src/modules/institution/tests/InstitutionKnowledgeReadonlyShell.test.tsx`、`src/modules/open-platform/tests/PlatformKnowledgeQaApiRoute.test.ts`。
- `src/modules/open-platform/server/platform-knowledge-file-storage.ts`：inbound 6 → 9，tests 3 → 6，cross-module inbound 0 → 3，分类 `protected_boundary` → `protected_boundary`；新增动态来源：`src/modules/institution/tests/InstitutionKnowledgeDownloadCapabilityRoute.test.ts`、`src/modules/institution/tests/InstitutionKnowledgeReadonlyShell.test.tsx`、`src/modules/institution/tests/InstitutionKnowledgeUploadApiRoute.test.ts`。
- `src/modules/open-platform/server/platform-knowledge-indexing-job-service.ts`：inbound 5 → 7，tests 2 → 4，cross-module inbound 3 → 5，分类 `protected_boundary` → `protected_boundary`；新增动态来源：`src/modules/institution/tests/InstitutionKnowledgeManagementReadonlyApiRoute.test.ts`、`src/modules/institution/tests/InstitutionKnowledgeReadonlyShell.test.tsx`。
- `src/modules/open-platform/server/platform-knowledge-keyword-search-service.ts`：inbound 10 → 11，tests 6 → 7，cross-module inbound 3 → 4，分类 `protected_boundary` → `protected_boundary`；新增动态来源：`src/modules/institution/tests/InstitutionKnowledgeSearchCapabilityRoute.test.ts`。
- `src/modules/open-platform/server/platform-knowledge-management-repository.ts`：inbound 49 → 59，tests 21 → 31，cross-module inbound 9 → 19，分类 `protected_boundary` → `protected_boundary`；新增动态来源：`src/modules/institution/tests/InstitutionKnowledgeAnswerApiRoute.test.ts`、`src/modules/institution/tests/InstitutionKnowledgeDownloadCapabilityRoute.test.ts`、`src/modules/institution/tests/InstitutionKnowledgeItemsCapabilityRoute.test.ts`、`src/modules/institution/tests/InstitutionKnowledgeManagementReadonlyApiRoute.test.ts`、`src/modules/institution/tests/InstitutionKnowledgeQaCapabilityRoute.test.ts`、`src/modules/institution/tests/InstitutionKnowledgeReadonlyShell.test.tsx`、`src/modules/institution/tests/InstitutionKnowledgeRetrievalCapabilityRoute.test.ts`、`src/modules/institution/tests/InstitutionKnowledgeSearchCapabilityRoute.test.ts`、`src/modules/institution/tests/InstitutionKnowledgeUploadApiRoute.test.ts`、`src/modules/institution/tests/InstitutionKnowledgeVectorSearchCapabilityRoute.test.ts`。
- `src/modules/open-platform/server/platform-knowledge-qa-service.ts`：inbound 10 → 11，tests 4 → 5，cross-module inbound 2 → 2，分类 `protected_boundary` → `protected_boundary`；新增动态来源：`src/modules/open-platform/tests/PlatformKnowledgeQaApiRoute.test.ts`。
- `src/modules/open-platform/server/platformAiModelConfigPersistenceRepository.ts`：inbound 3 → 5，tests 0 → 2，cross-module inbound 0 → 0，分类 `protected_boundary` → `protected_boundary`；新增动态来源：`src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts`、`src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts`。
- `src/modules/open-platform/server/vendorProviderConfigRepository.ts`：inbound 9 → 10，tests 2 → 3，cross-module inbound 1 → 1，分类 `protected_boundary` → `protected_boundary`；新增动态来源：`src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts`。

## docs-only 范围例外说明

`AGENTS.md` 规定 docs-only PR 原则上最多 2–3 个文档文件。本阶段采用 7 文件单提交例外，原因是：

1. 4 个闭环产物共同构成机器分类、试点追溯、非阻断 backlog 和人类可读结论；
2. 3 个 handoff 文件必须与闭环结论同步，避免阶段状态、下一任务和发布历史暂时不一致；
3. 全部文件属于同一开放平台阶段闭环主题；
4. PR 不含 `src/`、API、迁移矩阵、package 或锁文件修改；
5. 单提交可整体回退，比拆分后的临时不一致更安全。

## 非阻断 Backlog

- `docs/refactor/phase-28-open-platform-nonblocking-backlog.csv`
- 所有 backlog 项均标记为不阻断第二十九阶段。
- 不要求一次移动全部开放平台文件。
- 不在第二十八阶段移动第二个源码文件。
- 后续任何源码移动必须独立授权。

## 安全边界

本阶段：

- 未修改或移动 `src/` 文件；
- 未修改 API；
- 未修改 `file-migration-matrix.csv`；
- 未修改 Schema、Migration、package 或锁文件；
- 未连接真实数据库或外部服务；
- 未读取或输出真实凭证；
- 未改变权限、租户隔离、错误响应或真实渠道行为。

## 第二十九阶段启动条件

第二十九阶段定位为“下一模块选择与审计启动决策”，只能在本阶段合并后单独启动。

第二十九阶段必须：

1. audit-only 扫描 `src/modules/` 下除 `institution`、`open-platform` 外的模块；
2. 输出候选模块文件数、跨模块依赖面、运行时边界面和现有测试面；
3. 选择唯一下一模块；
4. 只生成下一模块审计范围和安全边界；
5. 不移动任何源码；
6. 后续模块源码试点继续单独授权。
