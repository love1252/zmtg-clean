# MIG-01A2 本地就绪修复 Stage B 只读能力证据

## 1. 文档定位

- 任务编号：`V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-B-COMPLETE`
- 执行日期：2026-07-30
- 时区：`Asia/Shanghai`（CST，UTC+08:00）
- 冻结 Base：`63a6ddff4fe192b0aa01c40f72dc45317889291a`
- 目标环境：Mac localhost-only 本地安全验收环境
- 状态：`current evidence`
- 本阶段结果：只读 PostgreSQL Repository Adapter 与本地验收 Context Policy 已建立

本报告只记录 Stage B 的低敏实现、合成测试和固定本地验收库只读 smoke。它不包含真实 Manifest、双键、业务行、连接串、凭证或数据库原始异常，也不构成 Stage C、Runner dry-run、Lease、A2-P1 或 A2-P2 的授权。

## 2. Accepted 边界

本阶段保持以下已接受边界：

- Tenancy 是 Institution Scope、Context Version、Context Head、Manifest、Scope Revision 和 Provisioning Provenance 原始事实的唯一语义 Owner；
- Access Control 只单向消费，不建立第二套 Membership 或授权事实源；
- Context 全字段显式，不从执行时钟、系统时区、环境变量、数据库现状、Demo、Seed 或模型偏好推断；
- 真实 Manifest 继续留在仓库外，Stage B 不创建、不读取、不批准真实 Manifest；
- Runner 是未来 A2-P1 的唯一写入口，但本阶段不接线 Runner，不运行 dry-run／`--execute`；
- `main` 保护和“最小架构与质量门禁”继续是后续阶段硬门；
- Metadata 维持 journal 0038／snapshot 0026，不运行 `db:generate`，不创建 snapshot-diff Migration。

## 3. Stage A 当前状态

| 项目 | Stage B 启动与结束状态 |
|---|---|
| 容器 | `zmtg-local-acceptance-pg`，受控标签有效并保持运行 |
| Host／端口 | 仅 `127.0.0.1:55432` |
| 数据库 | `zmtg_clean_local_acceptance` |
| Applied Migration | 39，最新内部匹配仓库 0038 |
| `tenants` | 2 |
| `institution_scopes` | 存在，0 行 |
| `institution_operating_context_versions` | 存在，0 行 |
| `institution_operating_contexts` | 存在，0 行 |
| 迁移前恢复点 | `zmtg_clean_local_acceptance-pre-0038-20260730-124114`，继续保留 |
| 迁移后恢复点 | `zmtg_clean_local_acceptance-post-0038-20260730-124114`，继续保留 |
| 恢复点完整性 | 两份本地 hash 校验均通过 |

Stage B 没有修改、恢复、重置或写入该数据库。

## 4. 精确六文件范围

本阶段代码 PR 只包含：

1. `src/modules/tenancy/provisioning/provisioning-context-policy.ts`
2. `src/modules/tenancy/provisioning/server/provisioning-readonly-postgres-adapter.ts`
3. `src/modules/tenancy/provisioning/tests/ProvisioningContextPolicy.test.ts`
4. `src/modules/tenancy/provisioning/tests/ProvisioningReadonlyPostgresAdapter.test.ts`
5. `docs/operations/mig01-a2-provisioning-runbook.md`
6. `docs/operations/mig01-a2-local-readiness-stage-b-20260730.md`

没有修改 `provisioning-ports.ts`、Kernel、Manifest、canonicalization、Lease、Runner、共享数据库 client、Schema、Migration、CI、package、lock、业务 API 或 UI。

## 5. 本地验收 Context Policy

| 项目 | 冻结值 |
|---|---|
| Policy version | `mig01-a2-local-acceptance-context-policy/v1` |
| target environment | `local_acceptance` |
| timezones | 仅 `Asia/Shanghai` |
| currencies | 仅 `CNY` |

Policy 对象和两个数组均使用 `Object.freeze`。构造器只接受 exact-shape、精确版本、精确环境和上述两个单元素批准集合；重复值、非法注册值、`UTC`、`Asia/Tokyo`、`Asia/Hong_Kong`、`USD`、`JPY`、`HKD` 或静默扩展均 fail-closed。

Policy 不读取 `process.env`、数据库、系统 locale 或系统时区，不为 Manifest 补默认值。无效输入只抛固定低敏错误码。

## 6. 只读 PostgreSQL Adapter

Adapter 位于 Tenancy 模块内，只接收调用方提供的 postgres.js `Sql` client：

- 不读取 `DATABASE_URL`；
- 不自行创建、缓存或关闭全局数据库连接；
- 不提供任意 SQL、动态表名、动态列名或通用 Repository；
- 所有业务值通过 tagged template 参数化；
- 表名使用静态 `public` 全限定名，避免 `search_path` 影子关系。

读取白名单精确为：

1. `public.tenants`
2. `public.institution_scopes`
3. `public.institution_operating_context_versions`
4. `public.institution_operating_contexts`

每次 `read`：

- 使用 `REPEATABLE READ + READ ONLY` 事务覆盖完整回调；
- 核验 `transaction_read_only=on`；
- 核验 `transaction_isolation=repeatable read`；
- 设置并核验 `statement_timeout=5s`；
- 设置并核验 `lock_timeout=1s`；
- 设置并核验 `idle_in_transaction_session_timeout=5s`；
- 连接超时 `5s` 由调用方创建 client 时负责。

`tenantExists` 只投影 `tenants.id`。`readTriplet` 返回完整 Scope、全部 Context Version 和全部 Head，Version 固定按 `version ASC`；不只读取 version 1，也不把重复或额外行隐藏成正常结果。

timestamptz 以 UTC 六位微秒文本读取，仅在精确毫秒对齐时规范化为三位毫秒 ISO UTC，禁止静默丢失微秒。business date 以固定 `YYYY-MM-DD` 文本读取。未知 enum、非法时间、额外列、字段 Shape 漂移或数据库异常均使用固定低敏错误码 fail-closed。

Repository 的 `insertScope`、`insertContextVersion`、`insertContextHead` 以及 Transaction Port 的 `write` 均永久拒绝，固定返回 `provisioning_readonly_write_forbidden`，且不调用写回调。Repository 只在 `read` 回调对应的事务生命周期内有效；回调结束后逃逸对象的读方法固定拒绝且不再发送 SQL。

## 7. 合成测试矩阵

| 测试文件 | 场景数 | 结果 |
|---|---:|---|
| `ProvisioningContextPolicy.test.ts` | 23 | 通过 |
| `ProvisioningReadonlyPostgresAdapter.test.ts` | 26 | 通过 |
| Stage B 新增测试合计 | 49 | 通过 |
| Provisioning 定向契约集 | 6 个文件／112 个测试 | 通过 |

测试覆盖：

- Policy version、环境、批准集合、冻结、重复和非法输入；
- Manifest Parser 对上海／人民币的接受及其他组合的拒绝；
- `READ ONLY`、一致快照、事务只读状态和三个 timeout；
- tenant 存在／不存在、四表静态白名单和参数化查询；
- Scope／Version／Head 精确映射、空集合、完整多行集合和 Version 排序；
- 日期、时间、enum、额外 Shape 和原始数据库异常 fail-closed；
- timeout 固定错误映射；
- 三个 insert 与 Transaction Port write 永久拒绝；
- `read` 回调结束后逃逸 Repository 的读方法永久拒绝且不再发送 SQL；
- 不暴露通用 query，不读取 `process.env`，不自行创建连接。

## 8. Localhost-only 只读 smoke

临时脚本：

`/tmp/zmtg-mig01-a2-stage-b-readonly-adapter-smoke.mts`

安全边界：

- 权限 `0600`；
- 只使用固定 localhost 容器、端口和数据库常量；
- postgres.js client 使用 `max=1`、`connect_timeout=5`、`prepare=false`、`fetch_types=false`；
- 只对明显不存在的合成 tenant 与合成双键调用 `tenantExists` 和 `readTriplet`；
- 不查询真实 tenantId，不输出合成双键，不返回 SQL 或连接信息；
- 验证 `tenantExists=false`、`scopes=[]`、`versions=[]`、`heads=[]`；
- 验证 Transaction Port write 固定拒绝；
- 关闭 client 后删除临时脚本。

结果：

```text
local_readonly_adapter_smoke=pass
```

## 9. 数据库前后低敏状态

| 项目 | smoke 前 | smoke 后 |
|---|---:|---:|
| Applied Migration | 39 | 39 |
| `tenants` | 2 | 2 |
| `institution_scopes` | 0 | 0 |
| `institution_operating_context_versions` | 0 | 0 |
| `institution_operating_contexts` | 0 | 0 |

前后读取均使用显式 `READ ONLY` 事务。没有数据库写入、Provisioning 行、Journal 变化或业务数据变化。

## 10. 完整验证

| 验证 | 结果 |
|---|---|
| Provisioning 定向契约集 | 6 个文件、112 个测试通过 |
| lint | 通过；仅 4 条既有 `<img>` 警告 |
| typecheck | 通过 |
| 完整测试 | 414 个文件、5791 个测试通过 |
| build | 通过；101／101 静态页面生成 |
| 本地只读 smoke | 通过 |

Build 仅显示 Next.js 对本地环境文件名的标准检测；本任务未主动读取、搜索或输出 `.env.local`、环境变量值或凭证。

## 11. 仓库与执行零修改边界

- Schema 修改：0；
- Migration 修改：0；
- `drizzle/meta/_journal.json` 修改：0；
- snapshot 修改：0；
- package 修改：0；
- lock 修改：0；
- CI 修改：0；
- 业务 API／UI 修改：0；
- Runner 修改：0；
- 数据库写入：0；
- 新依赖：0。

本阶段没有创建真实 Manifest，没有运行 Runner dry-run／`--execute`，没有签发或伪造 Lease，没有执行 Provisioning，没有启动 A2-P1／P2。

## 12. 阻断状态

已关闭：

- `readonly_adapter_unavailable`

仍未关闭：

- `real_manifest_missing`
- `real_environment_dry_run_unavailable`

只读 Adapter 已作为可注入资产建立，但当前 Runner CLI 仍未组合真实 Context Policy 与 Adapter；这正是 Stage C／Stage D 继续保持独立授权的边界。

## 13. 回退与后续边界

本阶段没有数据库写入，因此代码回退只涉及独立 PR 的 Git 回退；两个 Stage A 恢复点继续保留，未覆盖、未删除、未执行 Restore。

Stage B 完成不自动启动 Stage C。Stage C 只能通过独立 handoff 冻结为“本地验收 Manifest 候选与审批包”，候选正文不得进入 Git、PR、日志或聊天，不自动标记 `approved`，不运行 Runner，不签发 Lease，也不自动启动 Stage D。
