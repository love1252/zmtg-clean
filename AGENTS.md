# Codex 项目治理规则

本文件是 Codex / AI agent 在「智美天工 / zmtg-clean」项目中的入口规则。详细治理说明见 `docs/ai-agent-governance.md`。

## 项目身份

- 项目名：智美天工 / zmtg-clean。
- 默认语言：中文。
- Codex 只能执行用户明确授权的当前任务，不得自动开发未授权内容。
- backlog、devlog、计划文档和总结中的后续建议，都不是开发许可。

## 启动检查

每次开始执行任务前，必须先确认并在过程或总结中说明：

- 当前日期和时区，日期必须来自 `date "+%Y-%m-%d"` 或等价命令。
- 当前阶段、任务编号和本次任务不是哪些内容。
- 当前分支。
- 当前 `HEAD` commit。
- `main` 或 `origin/main` commit。
- `git status --short` 是否干净，或是否只有本次任务允许的文件。

如果当前目录不是本项目 git 仓库，或基线、分支、任务编号不清楚，必须先停止并确认目标目录或任务边界。

## GitHub 同步能力检查

如果本轮任务可能需要提交、推送、创建 PR、合并、同步 GitHub 或同步测试服务器，Codex 必须在开始实质改动前确认当前会话具备有效同步能力：

- 普通 Git 路径：`.git` 可写，且可以执行 `git add`、`git commit`、`git push` 所需的本地 Git 元数据写入。
- GitHub 工具路径：已安装并可用的 GitHub 连接器必须支持本轮改动规模所需的完整提交链路，例如批量文件变更、创建 commit、更新 ref、推送分支或创建 PR。

如果两条路径都不可用，必须在开始实质改动前停止并说明原因，不能等到实现完成后才发现无法同步 GitHub。用户可以选择切换到具备 `.git` 写权限的会话、启用可完成批量提交的 GitHub 连接器，或明确要求只做本地未提交改动。

仅有用户口头授权不足以突破沙盒文件系统限制；如果底层环境把 `.git` 设为只读，Codex 必须如实回报并停止同步类操作。

同步能力检查必须是实际检查，不得只凭经验判断。至少确认：

- `git status --branch --short` 可以正常读取当前分支和 upstream 状态。
- 当前会话可以在 `git rev-parse --git-dir` 指向的目录内创建并删除临时探针文件，以证明 `.git` 不是只读。
- 如果需要推送或拉取，`git fetch --dry-run` 或等价命令可以正常访问远端。
- 如果改用 GitHub 连接器，必须确认该连接器能处理本轮多文件改动的完整提交链路；只支持单文件 contents API 时不得承诺可同步整轮任务。

## 工作模式

- 每个任务只完成当前明确授权的任务，不得跳任务。
- 不得自动执行 devlog、计划文档或总结中的下一步建议。
- 不得因为 backlog 中列出某项能力，就把它当成本轮实现许可。
- 不得因为文档中提到后续阶段，就自动开始 Phase 24 或其他阶段。
- 不确定是否越界时，先停止并回报判断依据。

## docs-only 与 runtime 边界

- docs-only 只允许修改文档、规则、说明、计划、规格、开发日志等 Markdown 文档。
- runtime 包括源码、测试、数据库 schema、migration、配置、脚本、runner、scheduler、队列、后台 worker、依赖、环境变量和凭证相关文件。
- docs-only PR 不得夹带 runtime 改动。
- runtime 只有在任务明确批准时才能实现。

## Plan Mode 与 runtime 边界

- Plan Mode 只能产出计划、规格、边界、验收标准、风险判断和建议。
- Plan Mode 不得自动膨胀成 runtime 实现。
- 不得因为 Plan Mode 文档中提到 route、service、parser、DTO、repository、audit、provider、adapter、scheduler 等能力，就顺手实现这些能力。
- 从 Plan Mode 进入 runtime 前，必须有用户明确批准。

## 禁止范围

除非用户在当前任务中明确批准，否则不得修改或新增：

- `src/**`。
- `drizzle/**`。
- schema 或 migration。
- package 或 lockfile。
- runner、scheduler、worker、cron、queue。
- provider、adapter 或其他 runtime 对接。
- 真实凭证读取、密钥、API Key、OAuth、Webhook 签名。
- 生产配置、计费、支付、合同、发票相关内容。
- 外部网络请求、真实第三方系统、真实 HIS 对接。
- `.codex/**` 或 Superpowers 缓存。

## 必须停止的场景

遇到以下内容时，必须先停止并请用户确认，不得继续实现：

- 数据库 schema 或 migration。
- runner、scheduler、队列、定时任务、后台 worker。
- 真实凭证、密钥、API Key、OAuth、Webhook 签名、生产环境变量。
- 外部网络调用、真实第三方系统、真实 HIS 对接。
- 生产配置、计费、支付、合同、发票。
- 删除文件、大规模重构、跨模块 runtime 改动。
- working tree 出现非本次任务允许的改动。

## 日期规则

- 每次任务必须执行或等价确认 `date "+%Y-%m-%d"`。
- 不得写死旧日期。
- 新建 plan 或 devlog 文件时，文件名必须使用命令返回的当天日期。
- 如果当天 devlog 存在则追加，不存在则新建；但只有任务明确允许 devlog 时才能写入。

## PR 和合并

- 控制 PR 范围和文件数量，优先小范围、单主题、可审查。
- docs-only PR 原则上最多 2-3 个文档文件。
- runtime PR 原则上最多 3-5 个核心业务文件。
- schema 或 migration 必须单独审批。
- runtime PR 必须说明风险、验证命令和回滚思路。
- 合并前等待人工判断；不得自动合并、自动推送 `main` 或替用户做最终上线判断。
- 当用户明确要求“提交并推送”或“同步 GitHub”时，只有在 GitHub 同步能力检查通过后才允许执行；检查不通过时必须先回报，不得继续扩大改动范围。

## Superpowers 文档语言

后续生成或修改 `docs/superpowers/plans/*.md`、`docs/superpowers/specs/*.md` 时，所有面向人读的标题、模板字段、任务结构说明必须使用中文。

保留技能名、API 路径、文件路径、字段名、枚举值、技术名词和项目稳定缩写，例如 `superpowers:writing-plans`、`TypeScript`、`Next.js`、`React`、`Vitest`、`Drizzle`、`HIS`、`API`、`UI`、`DTO`、`PR`。
