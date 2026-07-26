# 第二十六阶段：开放平台职责与依赖图审计

- 日期：2026-07-26
- 分支：`docs/open-platform-responsibility-dependency-audit-20260726-231835`
- 基线：`8c8de92eb3bd5c480fb0d7df5fbc05bb3f9864f5`
- 阶段性质：audit-only
- 审计目录：`src/modules/open-platform`
- 开放平台 TypeScript 文件总数：186
- 项目依赖边总数：684

## 结论

开放平台文件已全部完成职责、领域所有权、依赖和运行时边界归类。

- 未归类文件：0
- 运行时边界文件：139
- 存在跨模块出向依赖的文件：67
- 存在跨模块入向依赖的文件：29
- 反向依赖文件：11
- 循环依赖组：1
- 循环依赖文件：8
- 第二十七阶段安全候选总数：2
- 第二十七阶段唯一候选：`src/modules/open-platform/domain/tenant-plan-change.ts`
- 第二十七阶段当前授权：否

## 职责分布

| 职责 | 文件数 |
|---|---:|
| `client` | 4 |
| `component` | 20 |
| `domain` | 10 |
| `other` | 7 |
| `server_repository` | 14 |
| `server_service` | 34 |
| `test` | 97 |

## 领域所有权分布

| 领域所有者 | 文件数 |
|---|---:|
| `ai_runtime` | 11 |
| `audit` | 2 |
| `commercial_entitlement` | 39 |
| `homepage_brand` | 14 |
| `knowledge` | 48 |
| `platform_config` | 11 |
| `provider_config` | 13 |
| `shared` | 29 |
| `tenant_governance` | 19 |

至少已独立区分：

- 平台配置：`platform_config`
- 商业、套餐和权益：`commercial_entitlement`
- 知识库：`knowledge`
- AI 运行时：`ai_runtime`
- 供应商配置：`provider_config`

## 机器可读输出

- 逐文件职责：
  `docs/refactor/phase-26-open-platform-file-responsibility-inventory.csv`
- 依赖边：
  `docs/refactor/phase-26-open-platform-dependency-edges.csv`
- 领域所有权：
  `docs/refactor/phase-26-open-platform-domain-ownership.csv`
- 第二十七阶段唯一候选：
  `docs/refactor/phase-26-open-platform-phase27-candidate.md`
- 第二十七阶段精确白名单：
  `docs/refactor/phase-26-open-platform-phase27-allowed-files.csv`

## 运行时保护边界

出现以下任一证据的文件不得直接作为低风险试点：

- 数据库或 Drizzle；
- 环境变量或 Node-only 运行时；
- 网络请求；
- Next server/navigation/headers；
- React 或浏览器运行时；
- API key、secret、token、provider endpoint 等凭证或供应商边界；
- 跨模块入向或出向依赖；
- 循环依赖；
- 反向依赖。

## 第二十七阶段候选规则

候选必须同时满足：

1. 普通 `.ts` 文件；
2. 职责为纯领域或契约；
3. 领域所有者不是 `shared`；
4. 无运行时边界 token；
5. 无跨模块入向和出向依赖；
6. 无反向依赖；
7. 不属于循环依赖；
8. 调用方不超过 8；
9. 文件不超过 600 行；
10. import 不超过 8；
11. 具有显式 export；
12. 建议目标路径不存在。

安全候选按以下顺序排序：

1. type-only 优先；
2. 有直接测试优先；
3. 有直接调用方优先；
4. 调用方更少；
5. 文件更小；
6. import 更少；
7. 路径字典序。

因此本阶段只输出一个唯一候选，不实施源码移动。

## 安全边界

本阶段：

- 未修改或移动 `src/` 文件；
- 未修改 API；
- 未修改 `file-migration-matrix.csv`；
- 未修改 Schema、Migration、package 或锁文件；
- 未连接真实数据库或外部服务；
- 未读取或输出真实凭证；
- 未改变权限、租户隔离、错误响应或真实渠道行为；
- 第二十七阶段源码试点不自动授权。
