# IMPORT-HISTORY-RECOVERY-01：Excel 导入批次明细恢复与验证

- 日期：2026-10-05，Asia/Shanghai。
- 基线：`8f56c16007fc3d2c7e58c04b24afc46895383aac`。
- 分支：`codex/import-history-recovery-20261005`。
- 用户授权按当前目标处理工作树遗留；本功能符合数据来源可追溯目标，从旧副本恢复为独立草稿 PR。原始未提交成果已在仓库外保存快照，未覆盖主线后来完成的知识库和随访功能。
- 本次不修改数据库结构、Migration、依赖、导入写入流程、支付行为、生产配置或外部系统；不读取真实密钥或连接真实数据库，不合并或部署。

## 用户可见行为

V1.1 客户数据导入记录仍展示最近 20 个已完成批次。选择批次后，可按客户、预约、治疗、消费四类查看保存的导入行证据，使用服务端分页，支持每页 10／20／50／100 条及前后翻页。

展示的是当次导入的证据快照，不保证与后来修改的客户主档一致。手机号和对象引用脱敏；身份证、外部患者 ID、订单号、HIS ID、备注及加密包不进入响应。合法字段沿用导入模板接受长度。

加载、空记录、无权限与不可用状态明确展示，不回填原型记录；过期响应不能覆盖新的 Sheet、页码、抽屉或路由。损坏金额和证据失败关闭，不显示假零。此次仅接入 V1.1 导入入口，未新增正式 React 客户页面入口。

## 查询与权限契约

无参数 `GET /api/institution/customers/import` 保持原有历史列表，并新增可下钻 `batchId`。明细查询使用：

```text
/api/institution/customers/import?batchId=imp-b-<48位小写十六进制摘要>&sheet=customer&page=1&pageSize=20
```

- `sheet`：`customer / appointment / treatment / consumption`。
- `page`：规范十进制整数 1–500；模板总行数上限为 5000，最小页容量为 10。
- `pageSize`：`10 / 20 / 50 / 100`；默认页码 1、页容量 20。
- 拒绝缺失、重复、未知参数、非规范数字和调用方作用域。结果为 `200 / 400 / 403 / 404 / 503`，均禁止缓存。
- 沿用现有开发环境、本地 PostgreSQL、受控客户授权及管理员／运营员限制；不扩大生产可用性或降低授权条件。
- 仓库同时约束租户、机构、批次及 Sheet，按原 Excel 行号稳定排序，数据库执行 limit／offset。
- 总数来自事务完成时保存的不可变批次数量；校验返回行数、所属范围、行号顺序及证据。批次和行由原有导入事务原子写入，不引入新的写操作。

## 验证

- `pnpm run test src/modules/institution/tests src/modules/institution-import/tests src/modules/institution-v11-preview/tests --maxWorkers=4`：175 个文件、2474 项测试通过。
- 补充合法长字段和第 5 行边界用例后，单独重跑 `InstitutionExcelImportHistoryRuntime.test.ts`：49 项通过。
- `pnpm typecheck`、`pnpm lint`、`pnpm build`、`git diff --check`：通过；静态检查有 4 项原有 img 警告。
- 仓库测试编译真实 Drizzle SQL，锁定范围条件的 AND 关系、Sheet、排序及分页；运行逻辑模拟数据库、授权和解密，不接触实际数据或密钥。
- 实际执行预览脚本的 DOM 测试覆盖四类明细、超过 100 条分页、错误重试、空 Sheet、脱敏、HTML 转义和慢响应；浏览器另以合成数据确认第六页第 101 条、消费明细及关闭行为。
- 增量架构检查与 GitHub 检查的最终提交和状态以 PR 记录为准。

## 范围与风险

4 个核心文件负责 API、仓库、运行逻辑和预览接线；5 个相关测试文件及本说明共 10 个文件，均服务于同一导入批次下钻行为。

真实数据库查询、真实密钥解密、数据规模性能及生产环境均未验收。此前本地导入限制仍然有效，不能把草稿 PR 当成正式数据接入发布。回滚本功能提交即可恢复历史列表行为，无需数据或 Migration 回滚。
