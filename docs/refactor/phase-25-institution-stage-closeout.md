# 第二十五阶段：机构端阶段闭环审计

- 日期：2026-07-26
- 分支：`docs/institution-stage-closeout-20260726-224203`
- 基线：`f8592fd256dd1cb691de493d6a25451b8b7cfb0f`
- 阶段性质：audit-only
- 审计范围：第二十二至第二十四阶段
- 第二十五阶段源码移动：0

## 结论

第二十二至第二十四阶段已完成闭环。

- 第二十二阶段建立 323 个机构端文件的职责、依赖和领域所有权基线。
- 第二十三阶段完成 1 个纯领域文件试点。
- 第二十四阶段完成 1 个服务边界文件试点。
- 正式业务源码累计移动：2 个。
- 两个试点均保持文件 blob、export 契约和运行时行为不变。
- 两个试点均具备明确回退路径。
- 机构端剩余文件已全部获得治理分类。
- 机构端剩余项不阻断第二十六阶段开放平台审计。

## 两个试点结果

### 第二十三阶段：预约纯领域试点

- 原路径：`src/modules/institution/domain/appointments.ts`
- 当前路径：`src/modules/institution/domain/appointment/appointments.ts`
- blob：`d5d88fcc24bec0a92c09223e5da4a329a462676f`
- 直接调用方：1
- 旧 import：0
- 新 import：1
- 新增循环依赖：0
- 新增反向依赖：0

### 第二十四阶段：套餐额度只读服务试点

- 原路径：`src/modules/institution/server/package-ai-quota-readonly-source.ts`
- 当前路径：`src/modules/institution/entitlement/package-ai-quota-readonly-source.ts`
- blob：`177ad4c2d5ef7fb849d955996755beba12b3cc0f`
- 直接调用方：2
- 直接测试：1
- 旧 import：0
- 新 import：2
- 跨模块出向依赖新增：0
- 新增循环依赖：0
- 新增反向依赖：0

机器可读追溯表：

- `docs/refactor/phase-25-institution-pilot-traceability.csv`

## 机构端治理分类

机构端基线总数：323。

| 分类 | 数量 | 含义 |
|---|---:|---|
| 已完成试点 | 2 | 第二十三、第二十四阶段已移动文件 |
| 可迁移 | 22 | 领域归属明确、无运行时或依赖风险的后续候选 |
| 保持当前位置 | 195 | 页面、组件、客户端、测试或共享归属未决文件 |
| 保护边界 | 96 | 数据库、环境变量、网络、跨模块、循环或反向依赖边界 |
| 延期处理 | 8 | 体积大、调用方多或 import 复杂的核心文件 |

- 分类总数：323
- 剩余文件：321
- 未分类文件：0

机器可读分类：

- `docs/refactor/phase-25-institution-remaining-classification.csv`

## 分类规则

### 可迁移

同时满足：

1. 职责为 `domain`、`contract_types` 或 `server_service`；
2. 领域所有者不是 `shared`；
3. 无运行时边界 token；
4. 无跨模块入向或出向依赖；
5. 无循环依赖和反向依赖；
6. 直接调用方不超过 6；
7. 文件不超过 600 行；
8. import 数量不超过 8。

该分类仅表示后续候选，不自动授权迁移。

### 保持当前位置

包括：

- page shell；
- component；
- client；
- test；
- 无风险但归属仍为 `shared` 的文件；
- 其他不属于当前核心迁移目标的文件。

### 保护边界

包括任一情况：

- server repository；
- 数据库、环境变量、网络、Next runtime 或真实渠道边界；
- 跨模块入向或出向依赖；
- 循环依赖；
- 反向依赖。

### 延期处理

核心领域或服务文件不存在受保护边界，但满足以下任一条件：

- 调用方超过 6；
- 文件超过 600 行；
- import 超过 8。

## 非阻断 Backlog

机器可读 backlog：

- `docs/refactor/phase-25-institution-nonblocking-backlog.csv`

所有剩余项均为非阻断 backlog：

- 不要求一次移动全部机构端文件；
- 不在第二十五阶段移动第三个源码文件；
- 后续每次只能通过独立授权选择一个候选；
- 保护边界只能进入独立运行时、安全或依赖治理计划。

## 安全边界

本阶段：

- 未修改或移动 `src/` 文件；
- 未修改 API；
- 未修改 `file-migration-matrix.csv`；
- 未修改 Schema、Migration、package 或锁文件；
- 未连接数据库、HIS 或企业微信；
- 未改变权限、租户隔离、错误响应或真实渠道行为；
- API 后续批次继续冻结。

## 第二十六阶段启动条件

第二十六阶段可在本阶段合并后单独启动，范围仅限：

1. 审计 `src/modules/open-platform/`；
2. 建立职责、依赖、领域所有权和稳定入口建议；
3. 至少区分平台配置、商业套餐权益、知识库、AI 运行时与供应商配置；
4. 不在第二十六阶段直接批量移动开放平台源码；
5. 后续试点仍需独立授权。
