# 数据与存储边界

## 固定边界

- `drizzle/`：数据库 Schema 和 Migration 资产。
- `src/server/db/`：数据库连接、查询和事务基础设施。
- `var/`：本地或运行时数据，不作为正式业务源码。
- `public/`：可公开访问的静态资源。
- 测试 Fixture、Demo Seed 和生产 Seed 必须分开。

## 禁止事项

- 页面组件中直接编写复杂 SQL。
- 使用本地 JSON 长期保存正式业务状态。
- 将 `.env.local`、数据库文件、日志或真实凭证提交到 Git。
- 在目录重构 PR 中同时修改 Schema 或 Migration。
