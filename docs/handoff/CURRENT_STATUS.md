# 智美天工当前项目状态

- 更新时间：2026-07-26
- 仓库：`love1252/zmtg-clean`
- 当前重构分支：`refactor/document-test-ownership-20260726-003947`
- 重构基线：`51495085b7943be05ecb41db2bab4dbe944234e4`
- 架构形态：模块化单体
- 数据库迁移目录：`drizzle/`
- 数据库运行时入口：`src/server/db/`

## 当前重点问题

1. `src/modules/institution/` 体积较大，混合页面、领域、服务和业务能力。
2. `src/modules/open-platform/` 聚合了较多平台端职责。
3. 客户、随访、知识库和工作台存在职责重叠。
4. API 同时存在版本化与非版本化路径。
5. 项目文档较多，但缺少统一的状态与下一任务入口。

## 当前重构边界

- 不修改 Schema。
- 不修改 Migration。
- 不修改 package.json 或 lockfile。
- 不连接真实数据库。
- 不调用真实 HIS。
- 不调用真实企业微信。
- 不改变租户隔离和权限模型。
- 第一阶段不移动正式源码。

## 第二阶段低风险资产状态

- 三组重复静态资源已完成哈希核验。
- 统一保留 `zmtg-*` 品牌资源。
- 品牌资源映射已更新为统一路径。
- scripts、Seed、Fixture、Demo 仅完成分类审计。

## 第三阶段脚本目录状态

- 根目录脚本继续作为稳定兼容入口。
- 测试服务器部署实现已下沉至 `scripts/deploy/`。
- Node 运行时解析实现已下沉至 `scripts/runtime/`。
- `package.json` 和锁文件保持不变。
- 未执行真实部署、数据库迁移或 Seed。

## 第四阶段脚本目录状态

- `scripts/run-next.mjs` 保留为稳定兼容入口。
- Next.js 命令实现已下沉至 `scripts/runtime/`。
- `scripts/run-vitest.mjs` 保留为稳定兼容入口。
- Vitest 命令实现已下沉至 `scripts/testing/`。
- `package.json` 和锁文件保持不变。
- 未执行真实部署、数据库迁移或 Seed。

## 第五阶段 Demo、Mock、Fixture、Seed 审计状态

- 已复核第二阶段列出的 44 个候选文件。
- 已生成逐文件调用关系和风险分组清单。
- 已更新迁移矩阵中的 44 条审计记录。
- 本阶段移动业务文件数量为 0。
- Seed、认证和运行时 API 候选继续保持原位。
- 未运行 Migration、Seed 或真实外部调用。

## 第六阶段文档与测试归属状态

- 14 个历史文档已完成职责归属确认。
- 11 个纯测试文件已完成模块归属确认。
- 25 个候选均确认继续保留当前位置。
- 本阶段文件移动数量为 0。
- Seed、认证、运行时 API 和 Mock 未修改。
- 第五阶段仍有 19 个候选等待后续边界审核。
