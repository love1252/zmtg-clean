# 下一任务

## 当前状态

架构 V2 第一阶段统一基线已完成，合并后成为后续架构和七线开发的唯一入口。

- 阶段：`V2-01`
- 基线：`035c4516f448ca3bfcd95ba835c32ac367e0d964`
- runtime 修改：0
- Schema／Migration 修改：0
- 正式发布：0/7
- 权威架构：`docs/architecture/architecture-v2.md`
- 模块映射：`docs/architecture/architecture-v2-module-map.md`
- 七线基线：`docs/architecture/institution-seven-stream-restart-baseline.md`
- 决策记录：`docs/decisions/architecture-v2-decisions.md`

## 下一任务

`V2-02-PREFLIGHT`：公共路由、访问控制、API 路由族兼容白名单与 MIG-01 完整关闭实施前预检。

首轮仍为审计与白名单冻结，不直接修改 runtime。

必须完成：

1. 盘点 `src/app/hospital`、`src/app/open-platform`、`src/modules/security`、`src/modules/auth`、`src/modules/workspace`；
2. 证明 Route Group 迁移保持公开 URL 不变；
3. 逐路由盘点七线旧计划中的 `src/app/api/institution/**`，为每条路由冻结 v1 owner、薄兼容需求、调用方、测试、观测、回退和删除门禁；
4. 冻结 provenance、成员资格 provider、institution guard、object guard 的唯一所有者；
5. 复核 MIG-01A1、A2、BASE-02／writer 门禁、MIG-01B 和 MIG-01C 的完整关闭状态；
6. 明确 Knowledge 正式 Reader 在 MIG-03 前保持关闭；
7. 冻结 Analytics 的双门禁：MIG-05 只交付事实／有效链／确定性聚合，MIG-06／AN-03C 后才允许 snapshot API、正式 providers 和五页 UI；
8. 形成最多一个不接数据库的低风险 runtime 候选切片，或 MIG-01 完整关闭的后续授权清单；
9. 固定允许文件、兼容测试、回退和停止条件。

## 本阶段禁止自动执行

- 不直接移动 `src/app/hospital` 或 `src/app/open-platform`；
- 不重命名 `security` 或 `auth`；
- 不创建 Schema 或 Migration；
- 不把 MIG-01A1 解释为 MIG-01 已关闭；
- 不在 MIG-01C 和当前成员双键上下文完成前接入真实机构级 reader；
- 不在 MIG-03 前接入 Knowledge scope-bound repository/current reader；
- 不在 MIG-06／AN-03C 前实现 Analytics snapshot repository/API、正式 providers、五页 UI 或 Workbench Analytics 接线；
- 不允许 Analytics 页面绕过统一 snapshot 直接读取 MIG-05 事实；
- 不在旧非版本化 Route 中新增业务逻辑、repository 或长期 DTO；
- 不执行 MIG-02～MIG-06；
- 不开放七线 capability；
- 不连接数据库或真实外部系统；
- 不读取 `.env.local`、`DATABASE_URL` 或凭证；
- 不删除旧 route、repository、DTO、mock 或兼容出口；
- 不批量搬迁 `institution` 或 `open-platform`。

## 长期写入规则

- `src/modules/institution/`：`freeze_new_business`
- `src/modules/open-platform/`：`freeze_new_cross_domain_file`
- 新外部 adapter：只能进入 `src/integrations/*`
- 新跨线契约：只能进入 `src/modules/institution-contracts/*`
- API：新实现默认进入 `src/app/api/v1/institution/*`；旧计划端点只允许逐路由薄兼容例外
- Analytics：MIG-05 只解锁事实／有效链／确定性聚合；MIG-06／AN-03C 后才解锁 snapshot API、正式 providers 和五页 UI
- Migration：先完整关闭 MIG-01A2／BASE-02／B／C，再按 MIG-02 → MIG-03 → MIG-04 → MIG-05 → MIG-06 串行、独立授权、独立 PR
- Ready 和合并：分别授权
