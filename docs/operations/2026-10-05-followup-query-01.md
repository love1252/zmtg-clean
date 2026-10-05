# FOLLOWUP-QUERY-01：随访服务端分页、筛选与统计

- 日期：2026-10-05，Asia/Shanghai。
- 开发基线：`2f3a653fc8c5e4b8e7ecd0c6c5c29314416ff1f0`。
- 范围：正式随访 GET 查询；不修改创建、状态变更、分配等写命令。
- 不包含：工作台与 V1.1 页面接线、客户关联查询、数据库结构、Migration、自动随访、消息发送、HIS、环境发布。

## 查询契约

接口为 `GET /api/v1/institution/followups`。

| 参数 | 范围 | 默认值 |
|---|---|---|
| `page` | 从 1 开始的十进制正整数；页码和偏移量必须为安全整数 | `1` |
| `pageSize` | `10 / 20 / 50 / 100` | `100` |
| `state` | `pending / in_progress / waiting_customer / escalated / completed / cancelled` | 全部可见状态 |
| `dueBucket` | `not_due / due_today / overdue` | 全部到期范围，包含终态 |
| `q` | 最多 80 字的非空低敏关键词，禁止首尾空白和控制字符 | 不筛选 |

关键词只匹配客户展示名和脱敏标识；`%`、`_`、反斜杠作为普通文本处理。未知参数、重复参数和非法值返回 `400`。调用方不能传入租户、机构、角色、时区或参考时刻。

示例：

```text
/api/v1/institution/followups?page=2&pageSize=20&state=pending&dueBucket=overdue
```

## 返回与统计口径

保留原有 `kind / records / canCreate / hasMore`，无参调用仍返回最多 100 条的第一页，新增：

- `pageInfo`：页码、页容量、总数、总页数和是否有后续页。
- `summary.total`：全部符合当前筛选及权限范围的记录数，不受分页影响。
- `summary.stateCounts`：相同筛选范围内六种状态的数量，总和等于 `total`。
- `summary.dueBucketCounts`：相同筛选范围内的到期桶数量；完成、取消不计入到期桶。
- `observedAt / timeZone / operatingContextVersion`：本次服务端参考时刻和可信机构业务时间上下文。

全部筛选条件按 AND 组合，包括统计。例如 `state=completed&dueBucket=overdue` 返回空集；状态统计不会暗中忽略当前状态筛选。

空集的 `total / pageCount` 均为 0。超过末页返回空列表，但保留真实总数和总页数，`hasMore=false`。总数不截断为前 100 条或固定页数上限。

到期桶按机构本地日期计算，不按浏览器时区或当天已经过去的小时数计算。机构时间上下文缺失或无效时，普通列表及状态统计保持可用，`dueBucketCounts / timeZone / operatingContextVersion` 为 `null`；指定到期桶的请求返回 `503`，不推断时区或补零。

## 权限与一致性

- 授权仍由现有正式会话、机构成员及能力门禁提供。
- 管理员和运营员查询本机构范围；普通成员仅查询分配给本人或其角色池的任务。
- 列表和统计共用同一权限及筛选谓词，在一个只读、可重复读事务中完成。
- 稳定顺序为 `dueAt ASC, id ASC`，分页在数据库执行，统计在数据库聚合。
- 单次响应的统计与记录使用同一数据库快照。多次翻页是不同请求，并发增删改时不承诺跨请求快照固定。
- DTO 保持原有低敏投影，不返回完成反馈全文、请求摘要、幂等键、内部操作者标识或调用方作用域。

## 验收与实现范围

核心实现限定为五个文件：

1. `src/modules/care/application/formal-follow-up-list-query.ts`
2. `src/modules/care/ports/formal-follow-up-store.ts`
3. `src/modules/care/server/formal-follow-up-repository.ts`
4. `src/server/orchestration/institution-formal-follow-up-runtime.ts`
5. `src/app/api/v1/institution/followups/route.ts`

回归覆盖 155 条记录的分页、全范围统计、权限谓词、结构化排序、关键词转义、上海跨日与跨年、可信机构时区、空集与超末页、损坏结果失败关闭、原有 GET/POST 兼容。仓库测试编译真实 Drizzle SQL 并模拟数据库传输，编排测试模拟授权和数据库依赖；不访问真实数据库。

验证命令：

```bash
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm run test --maxWorkers=4
pnpm build
pnpm check:architecture -- --base 2f3a653fc8c5e4b8e7ecd0c6c5c29314416ff1f0 --head HEAD
```

## 交付边界与回滚

本切片交付服务端能力。现有 V1.1 页面仍发送无参 GET 并做本地筛选，工作台仍使用旧 `listVisible`；它们尚未消费新分页或统计，不能据此宣称页面已修复全部记录展示。

无数据库结构变更，回滚本切片提交即可恢复原查询行为。后续页面接线必须作为独立任务验证；真实数据库执行、性能和环境部署不由本次模拟测试证明。
