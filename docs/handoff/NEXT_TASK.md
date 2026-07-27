# 下一任务

## 当前状态

架构 V2 代码证据审计已完成，当前分支基于：

```text
9fa85dd1d85ddd3cc81292f8f9d29bde176b1e15
```

本轮权威证据伴随文档：

```text
docs/architecture/architecture-v2-evidence-audit-20260728.md
```

该文档不替代 `docs/architecture/architecture-v2.md`，而是对当前代码、测试、Schema、Migration、PR #781 和历史 Codex 开发记录进行独立核验。

主要结论：

- 当前仍是模块化单体，不应拆微服务；
- PR #781 的模块化单体、七线边界和 MIG 主序列基本成立；
- 目录治理已闭环，但目标架构物理落位尚未完成；
- MIG-01 尚未完整关闭，是七线真实 Reader 的最高优先级阻断；
- 平台端仍使用客户端 `DemoSessionGate`，正式平台授权必须独立设计；
- Knowledge 正式 Reader 等待 MIG-03；
- Analytics MIG-05 只交付事实／有效链／确定性聚合，MIG-06／AN-03C 后才开放 snapshot/API/providers/五页；
- `src/integrations` 当前为空，外部接入必须采用 port-first，而不是先搬目录；
- 正式发布仍为 `0/7`。

本轮 runtime、Schema、Migration、Seed、package、lock 修改均为 0。

## 下一任务

```text
V2-02B-MIG01-CLOSURE-PREFLIGHT
MIG-01 完整关闭与真实 Reader 解锁前预检
```

下一任务继续是 docs-only，不直接修改 runtime、Schema 或 Migration。

## 必须完成

### 1. MIG-01 完整链逐项核验

逐项确认：

```text
MIG-01A1 expand
→ MIG-01A2 anchor provisioning
→ BASE-02B／BASE-02 scope revision、Guard、当前成员双键上下文
→ 全部 writer 双写
→ 审计兼容／模板保护
→ MIG-01B 确定性回填、追赶和冲突清零
→ MIG-01C 非空、外键、attribution 和 shape enforce
```

不得把 A1 解释为 MIG-01 已关闭。

### 2. 建立逐表事实归属清单

至少覆盖：

- tenants；
- institutions；
- tenant_members；
- auth_account_institution_bindings；
- institution scope／operating context；
- customers；
- appointments／treatments／followups；
- knowledge runtime 和 publication 相关表；
- AI usage；
- HIS connections；
- WeCom mapping／consent／frequency／delivery／proof；
- audit events；
- 七线后续将消费的其他机构级事实。

每张表必须记录：

- 当前主键和唯一键；
- tenantId／institutionId 是否存在、是否可空；
- institution 归属来源；
- 当前 writer；
- 当前 reader；
- 双写要求；
- 回填规则；
- 冲突规则；
- MIG-01C enforce 目标；
- 所属业务域；
- 解锁哪条七线 Reader。

### 3. 建立 Writer／Reader 机器清单

必须分别列出：

- 全部机构事实 writer；
- 全部 tenant-only 或可疑 reader；
- 使用默认机构、可空 institution、旧 scope 或客户端输入的调用点；
- 已完成双键上下文和对象归属校验的调用点；
- 必须 fail-closed 的未知、缺失、冲突和多候选路径。

### 4. 冻结 MIG-01A2／B／C 实施包

每个单元必须有：

- 精确允许文件；
- Schema／SQL 白名单；
- writer 和 reader 依赖；
- 空库验证；
- 现有库升级验证；
- 回填／追赶验证；
- 锁和性能风险；
- postcheck；
- forward-fix／恢复点方案；
- 停止条件；
- 独立 PR 和独立授权边界。

### 5. 建立七线 Reader 解锁矩阵

至少明确：

- Customers／System 真实 Reader：等待 MIG-01C + 当前成员双键上下文；
- Care：等待 MIG-02；
- Knowledge：额外等待 MIG-03；
- Conversations：等待 MIG-04；
- Analytics 事实：等待 MIG-05；
- Analytics snapshot/API/providers/五页：等待 MIG-06 + AN-03C；
- Workbench：只消费已发布 provider，最后解锁。

### 6. 输出后续独立任务顺序

建议拆分为：

```text
V2-02B-1：MIG-01A2 精确设计／实施
V2-02B-2：BASE-02／全部 writer 双写与 Guard
V2-02B-3：MIG-01B 回填／追赶／冲突清零
V2-02B-4：MIG-01C enforce
V2-02B-5：最新 main 上全部 Reader 重新验收
```

任何一项都不得自动授权下一项。

## 与后续任务的关系

MIG-01 预检完成后，再启动：

```text
V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT
```

该任务处理：

- 平台正式服务端认证和角色矩阵；
- `(institution)`／`(platform)` Route Group；
- 机构 API v1 默认路径；
- 旧非版本化路由逐路由薄兼容白名单；
- Access Control 与 general Security 的物理拆分候选。

不得把平台认证、Route Group、API 路径、MIG-01 数据变更混入同一 runtime PR。

## 本阶段禁止自动执行

- 不修改 `src/**`；
- 不修改 `drizzle/**`；
- 不创建或执行 Migration；
- 不执行 Seed；
- 不连接数据库；
- 不读取 `.env.local`、`DATABASE_URL` 或凭证；
- 不连接 HIS、企业微信、AI 厂商或生产环境；
- 不开放 capability；
- 不移动或删除源码；
- 不新增 API Route；
- 不修改 package、lock 或构建配置；
- 不把规划结论写成已实施事实；
- 不自动转 Ready；
- 不自动合并。

## 交付要求

建议输出 2—3 个 Markdown：

1. MIG-01 完整关闭预检；
2. 逐表 Reader／Writer／归属矩阵；
3. 必要时单独的实施包与解锁矩阵。

最终必须创建 Draft PR，并报告：

- 启动 main SHA；
- 文件范围；
- A1/A2/BASE-02/B/C 状态；
- 表数量；
- writer 数量；
- reader 数量；
- tenant-only／nullable／scope 风险数量；
- 七线解锁矩阵；
- 后续独立 PR 顺序；
- runtime、Schema、Migration 修改数量；
- 未解决阻断；
- 尚待用户决策。
