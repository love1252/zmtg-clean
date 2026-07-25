# 下一任务

## 当前任务

审核第四阶段运行命令与测试命令入口分层结果，并创建草稿 PR。

## 审核重点

1. `package.json` 中的命令入口是否保持不变。
2. `scripts/run-next.mjs` 是否正确加载下沉后的实现。
3. `scripts/run-vitest.mjs` 是否正确加载下沉后的实现。
4. Next.js 与 Vitest 的命令行参数是否仍能正常转发。
5. TypeScript、ESLint、定向测试和生产构建是否通过。
6. 本轮不得执行真实部署、数据库迁移或 Seed。

## 后续候选

第四阶段合并后，再进入 Demo、Mock、Fixture 和 Seed 文件的调用关系审计，先形成分组方案，不直接移动业务文件。
