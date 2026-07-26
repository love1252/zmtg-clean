# 第二十二阶段：机构端职责与依赖图审计

- 日期：2026-07-26
- 分支：`docs/institution-responsibility-dependency-audit-20260726-202140`
- 基线：`d2d790ee577a622cfbec13dd5420861914fda10d`
- 审计范围：`src/modules/institution/`
- 阶段性质：audit-only
- 机构端源码修改：0
- API 修改：0
- 数据库或外部服务连接：0

## 结论

本阶段完成机构端逐文件职责、内部依赖、跨模块依赖、
领域所有权、循环依赖和反向依赖审计。

本阶段只形成审计基线和第二十三阶段唯一候选，
不移动、重命名或修改任何机构端源码。

## 文件与职责统计

- 机构端受审计文件：323
- 内部及跨模块依赖边：1325
- 跨模块内部依赖边：384
- 反向依赖边：4
- 循环依赖组：2
- 涉及循环的文件：8
- 满足基础纯领域／纯类型安全条件的文件：22
- 识别出的领域所有者：14

| 职责 | 文件数 |
|---|---:|
| `client` | 5 |
| `component` | 20 |
| `contract_types` | 1 |
| `domain` | 48 |
| `other` | 3 |
| `server_repository` | 12 |
| `server_service` | 69 |
| `test` | 165 |

详细逐文件职责：

- `docs/refactor/phase-22-institution-file-responsibility-inventory.csv`

## 领域所有权

| 领域所有者 | 文件数 |
|---|---:|
| `ai` | 10 |
| `appointment` | 3 |
| `audit` | 2 |
| `conversation` | 3 |
| `customer` | 14 |
| `dashboard` | 1 |
| `entitlement` | 18 |
| `followup` | 41 |
| `his` | 33 |
| `knowledge` | 31 |
| `opportunity` | 5 |
| `shared` | 49 |
| `treatment` | 18 |
| `wecom` | 95 |

建议稳定入口遵循：

- 纯领域：`src/modules/institution/domain/<owner>/index.ts`
- 类型与契约：`src/modules/institution/contracts/<owner>/index.ts`
- 服务与仓储不得反向依赖组件、页面或测试
- 组件和 client 只能通过稳定契约或服务入口调用领域能力

详细所有权记录：

- `docs/refactor/phase-22-institution-domain-ownership.csv`

## 依赖方向

允许的主方向：

1. 页面／组件 → client／service；
2. client／service → domain／contracts；
3. server／repository → domain／contracts；
4. tests → 任意被测层；
5. contracts 不得依赖 domain、server、component 或 test；
6. domain 不得依赖 server、component、page 或 test。

本次识别：

- 反向依赖文件：3
- 跨模块出向依赖文件：160
- 循环依赖组：2

详细依赖边：

- `docs/refactor/phase-22-institution-dependency-edges.csv`

这些风险只作为后续治理依据，本阶段不修改源码。

## 分类复核

- `appointments.ts`、`customers.ts`、`followups.ts`
  均包含固定空数组运行时导出，不是纯类型文件。
- 3 个机构知识库 service 包装文件 re-export 运行时函数，
  继续归属 `server_service`，不是纯类型契约。
- `wecom-customer-broadcast-task-provider-contract.ts`
  是唯一真实纯类型契约；因契约层依赖 domain 类型，
  记录为反向依赖，不得作为第二十三阶段低风险候选。

## 第二十三阶段唯一试点候选

- 当前文件：`src/modules/institution/domain/appointments.ts`
- 建议目标：`src/modules/institution/domain/appointment/appointments.ts`
- 选择层级：`B_pure_domain_with_existing_tests`
- 职责：`domain`
- 领域所有者：`appointment`
- 行数：24
- 直接调用方：1
- 直接测试调用方：1
- 跨模块入向调用方：0
- 循环依赖：无
- 运行时边界标记：无
- 第二十三阶段当前授权：否

选择原因：

- 纯领域空态模型，包含类型与固定空数组运行时导出；
- 无导入、数据库、环境变量、网络、React、Next.js、浏览器运行时或外部渠道依赖；
- 无跨模块出向依赖；
- 无循环依赖；
- 调用方数量受控；
- 可通过独立文件移动和 import 修正回退。

直接调用方：

- `src/modules/institution/tests/InstitutionBusinessDomain.test.ts`

测试范围：

- `src/modules/institution/tests/InstitutionBusinessDomain.test.ts`

候选机器可读记录：

- `docs/refactor/phase-22-institution-pilot-candidate.csv`

第二十三阶段精确白名单：

- `docs/refactor/phase-22-institution-pilot-allowed-files.csv`

## 第二十三阶段实施约束

1. 只能移动上述唯一候选；
2. 只能修改白名单中的直接调用方 import；
3. 不改变任何 export 名称、类型、函数签名或运行时行为；
4. 不新增 barrel 扩散；
5. 不修改 API、数据库、权限、租户隔离或错误响应；
6. 不连接 HIS、企业微信或其他真实外部服务；
7. 不扩大到第二个机构端候选；
8. 必须保留独立回退路径。

## 回退条件

第二十三阶段回退必须能够：

1. 将候选恢复至原路径；
2. 将全部直接调用方 import 恢复至原路径；
3. 删除新增边界测试；
4. 恢复 3 个交接文件；
5. 不涉及数据库、API、环境变量或外部服务。

## 安全边界

- 未修改机构端源码。
- 未修改或移动 API。
- 未修改 `file-migration-matrix.csv`。
- 未修改 Schema、Migration、package 或锁文件。
- 未连接数据库或真实外部服务。
- 未提前实施第二十三阶段试点。
- API 后续批次继续冻结。

## 下一阶段

第二十三阶段只能在本阶段 PR 合并并获得单独授权后，
实施唯一候选 `src/modules/institution/domain/appointments.ts`。
