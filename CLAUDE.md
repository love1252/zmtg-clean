# zmtg-clean 项目专属 Agent 规则

## 项目身份

- 项目名：智美天工 / zmtg-clean
- 仓库：love1252/zmtg-clean（私有）
- 技术栈：Next.js 16 + React 19 + TypeScript + PostgreSQL + Drizzle ORM + Tailwind CSS v4
- 默认语言：中文

## Claude 角色

- Claude 是主开发 agent，负责实现完整功能点或完整页面。
- 接到任务后从最新 `main` 创建功能分支，完整实现后创建 Draft PR。
- 对自己发现的小问题直接修复，不需要每个小修都停下来等待。

## 协作边界

- **Claude**：主开发，实现功能，创建 Draft PR。
- **ChatGPT / Codex**：只读复核、Ready 前最终检查及高风险任务复核。
- 不允许两个 agent 同时修改同一分支或同一文件。

## 每次任务前必须检查

```bash
git switch main
git fetch origin
git pull --ff-only origin main
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

要求 `HEAD = origin/main`，working tree clean。否则停止。

## 禁止事项

除非用户在当前任务中明确授权，否则：

- 不改 schema / migration
- 不执行 `pnpm db:migrate`
- 不运行真实 smoke
- 不读取或输出 `.env.local`
- 不输出 `DATABASE_URL`、数据库密码、`ZMTG_SECRET_ENCRYPTION_KEY`
- 不输出任何 API Key
- 不转 Ready
- 不自动合并
- 一个 PR 不混多个功能点
- 当前 PR 未收尾前不开始新功能

## PR 规则

1. 默认 Draft PR。
2. PR body 必须一致：
   - 文件数 = `gh pr diff --name-only`
   - 测试数 = 实际通过数
   - 状态必须与实际一致
3. 只允许一个功能点。
4. Ready、合并必须用户授权。

## 任务完成回报模板

1. 日期 / 时区：
2. 当前分支 / HEAD：
3. PR 编号：
4. changed files：
5. 实现内容：
6. 未包含内容：
7. 测试命令和结果：
8. 是否触碰 schema / migration / secret / smoke：
9. 是否 Ready / 合并：
10. 下一步建议：

## 停止条件

- 当前分支不是 main，或 main 未与 origin/main 对齐
- working tree 非 clean
- 需要 schema / migration 但未获授权
- 需要真实凭证 / API Key / secret
- 需要外部网络请求 / 真实第三方系统
- 不确定是否越界

## 详细规则

详见 `docs/agent-guardrails/` 下的规则文件和 `.claude/skills/` 下的 Skills。
