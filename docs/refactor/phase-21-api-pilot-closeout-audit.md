# 第二十一阶段：API 试点闭环与后续批次计划

- 日期：2026-07-26
- 分支：`docs/api-pilot-closeout-batch-plan-20260726-194630`
- 基线：`b41a8b170e59ab28df9ab7586fc461043d09b51f`
- 阶段性质：audit-only
- API 修改：0
- 调用方修改：0
- 迁移矩阵修改：0
- 第二个路由族实施：0

## 结论

第二十阶段单一路由族试点已闭环通过。

新入口 `/api/v1/institution/wecom-official-dry-run` 直接 re-export 旧入口
`/api/institution/wecom-official-dry-run` 的 `GET`。新旧入口保持同一函数引用，
固定低敏 `503`、响应 JSON、`Cache-Control=no-store`、
零 Request 读取和零下游调用契约保持不变。

旧入口继续保留，未授权退役。

## 试点证据

- 旧路由 blob：`312d8f9eb2cf9dea810f2ef875ba39ffb5f80300`
- 新路由 blob：`71a6093be07388c822df06aca0e976326ef5f5f0`
- 旧契约测试 blob：`fae47f83f2f23ca18fdf8169a569b7591f2a2aaf`
- 新兼容测试 blob：`f9e277de6ebe5133b0e480c67c24a6f297c10c58`
- 新路由源码：单行 `GET` re-export
- 回退范围：删除新路由、新测试并恢复交接文件
- 数据库、调用方和旧路由无需回退

详细契约记录：

- `docs/refactor/phase-21-api-pilot-contract-verification.csv`

## 全仓 API 数量复核

| 指标 | 第十八阶段 | 第二十一阶段实测 | 变化 |
|---|---:|---:|---:|
| 全仓 `route.ts` | 145 | 146 | +1 |
| 版本化路由 | 56 | 57 | +1 |
| 非版本化路由 | 89 | 89 | +0 |
| 路由族 | 144 | 144 | +0 |
| 精确重叠族 | 1 | 2 | +1 |

精确重叠族：

- `/api/institution/wecom-official-dry-run`
- `/api/open-platform/tenants`

详细数量变化：

- `docs/refactor/phase-21-api-route-count-delta.csv`

本阶段只记录实测变化，不修改第十八阶段清单或
`file-migration-matrix.csv`。

## 试点模式复制结论

该模式在技术上可以有限复制，但严格复制必须同时满足：

1. 单一非版本化 `GET` 路由；
2. 无动态路径参数；
3. 无仓库内页面、组件、运行时代码或脚本调用方；
4. 有现有契约测试；
5. 当前实现为固定 capability-off 低敏 `503`；
6. 只导入 `NextResponse`；
7. Request 参数存在但不读取；
8. 无模块、数据库、环境变量或外部网络依赖；
9. 新入口可直接 re-export 原 `GET`；
10. 旧入口继续保留并可独立回退。

**本次对剩余 143 个路由族的严格扫描结果为：
可复制试点模式候选 0 个。**

这表示当前没有第二个路由族可以直接复制该方案，
不是审计失败，也不构成继续实施 API 迁移的授权。

## 阻断条件

出现以下任一情况，不得直接复制试点模式：

- 存在页面、组件、运行时代码或脚本调用方；
- 存在 POST、PATCH、PUT、DELETE 或动态路径参数；
- 使用权限、租户、数据库、审计、环境变量或外部渠道依赖；
- 需要 Wrapper、代理、重定向或 Header 注入；
- 存在辅助治理标记或既有人工阻断；
- 新旧入口无法共享同一 Handler；
- 旧入口退役条件和观测要求不明确。

## 剩余 API 批次

| 批次 | 路由族数 | 处理原则 |
|---|---:|---|
| 可复制试点模式候选 | 0 | 当前无严格匹配候选 |
| 需要客户端迁移 | 64 | 先完成调用方清单和双入口契约 |
| 需要观测后退役 | 2 | 先建立路径级观测 |
| 保持当前 | 54 | 不迁移、不新增入口 |
| 阻断，等待人工决策 | 23 | 不得自动复制试点模式 |

详细逐族计划：

- `docs/refactor/phase-21-api-remaining-family-batch-plan.csv`

## 批次顺序与准入门槛

1. **可复制试点模式候选**：当前为 0。
   后续只有重新出现严格匹配候选时，才可逐族设计和授权。
2. **需要客户端迁移**：先完成全部已知调用方、
   兼容窗口、双入口行为等价和逐项回切设计。
3. **需要观测后退役**：先建立不记录敏感数据的
   路径级聚合观测。
4. **保持当前**：不新增入口、不迁移、不退役。
5. **人工阻断**：在人工决策前不得实施任何路径变化。

## 回退结论

第二十阶段回退保持独立：

1. 删除
   `src/app/api/v1/institution/wecom-official-dry-run/route.ts`；
2. 删除
   `src/modules/institution/tests/V1WeComOfficialDryRunCompatibilityApiRoute.test.ts`；
3. 恢复第二十阶段 3 个交接文件。

不需要修改旧入口、现有调用方、数据库、Schema 或 Migration。

## 安全边界

- 未修改、删除或移动任何 API。
- 未修改调用方。
- 未退役旧入口。
- 未修改 `file-migration-matrix.csv`。
- 未修改 Schema、Migration、package 或锁文件。
- 未连接数据库或真实外部服务。
- 未实施第二个路由族。

## 下一阶段

第二十二阶段进入 `src/modules/institution/`
职责与依赖图审计。API 后续批次保持冻结，
必须依据本阶段批次计划另行授权。
