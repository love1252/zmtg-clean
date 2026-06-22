# AI-GOV-01 Codex 项目治理规则

> 日期：2026-06-08  
> 状态：执行规则  
> 范围：Codex 在「智美天工 / zmtg-clean」项目中的任务启动、阶段控制、文档与 runtime 边界、PR 范围和合并前人工判断。

## 1. 目标

本规则用于约束 Codex 在本项目中的工作方式，重点是防止 AI 过度开发和越界执行：

- 防止 docs-only 任务混入 runtime。
- 防止 Plan Mode 自动变成代码实现。
- 防止跳阶段、跳任务或提前进入后续阶段。
- 防止 backlog 自动变成开发任务。
- 防止 devlog、计划文档或总结里的后续建议被自动执行。
- 防止 PR 体量失控，降低审查和回滚成本。
- 防止在需要提交、推送或同步 GitHub 的任务中，最后才发现当前会话没有有效 GitHub 同步能力。

## 2. 阶段控制

每个任务只能完成当前明确授权的内容。开始前必须确认：

- 当前阶段。
- 当前基线 commit。
- 当前任务编号。
- 本次任务不是哪些内容。
- 本次任务的允许文件和禁止文件。
- 本次任务的停止条件。

阶段切换必须人工确认。Codex 不得因为一个阶段 closeout、PR 合并、devlog 建议或 backlog 清单，就自动开始下一阶段。

如果用户没有明确授权 runtime，当前任务只能停留在文档、判断、建议或计划层面。

## 2.1 GitHub 同步能力前置检查

如果本轮任务可能需要以下任一动作，Codex 必须在开始实质改动前确认当前会话具备有效同步能力：

- 提交本地改动。
- 推送到 GitHub。
- 创建 PR。
- 合并分支。
- 同步 GitHub 与测试服务器。
- 执行用户明确要求的“该提交的提交、该合并的合并、该同步的同步”。

有效同步能力只能来自以下两条路径之一：

1. 普通 Git 路径：当前会话可以写入 `.git` 元数据，并能完成 `git add`、`git commit`、`git push` 所需操作。
2. GitHub 工具路径：当前会话具备可用的 GitHub 连接器，且该连接器支持本轮改动规模所需的完整提交链路，包括批量文件变更、创建 commit、更新 ref、推送分支或创建 PR。

如果 `.git` 只读，或 GitHub 连接器只支持单文件内容 API、无法可靠承载本轮多文件变更，均视为同步能力不足。

同步能力不足时，Codex 必须在开始实质改动前停止并回报：

- 当前缺失的是 `.git` 写权限、GitHub 连接器能力，还是网络/认证能力。
- 本轮任务如果继续做，最终只能停留在本地未提交状态。
- 推荐用户切换到具备 `.git` 写权限的会话、启用完整 GitHub 连接器，或明确批准“只做本地改动，不负责同步”。

用户口头授权不等同于底层沙盒授权。若运行环境将 `.git` 设置为只读，Codex 不得声称可以完成提交或推送，也不得等实现完成后才要求用户手工同步。

同步能力检查必须使用实际命令验证，不能只凭历史经验或用户口头授权判断。最小检查清单如下：

- 执行 `git status --branch --short`，确认当前分支、upstream 和工作树状态可读。
- 执行 `git rev-parse --git-dir`，并在该目录内创建再删除临时探针文件，确认当前会话确实具备 `.git` 写权限。
- 如果本轮需要推送、拉取或确认远端，执行 `git fetch --dry-run` 或等价命令，确认网络、代理和认证可用。
- 如果本轮计划使用 GitHub 连接器，必须确认连接器不仅能读仓库，还能完成本轮改动规模所需的批量提交、创建 commit、更新 ref、推送分支或创建 PR。仅支持单文件 contents API 时，不得承诺可以同步多文件任务。

推荐探针命令如下，执行后必须清理临时文件：

```bash
git status --branch --short
git_dir="$(git rev-parse --git-dir)"
probe="$git_dir/codex-write-probe-$$"
: > "$probe" && rm "$probe"
git fetch --dry-run
```

如果探针失败，Codex 必须停止需要同步的任务，并明确说明失败命令和失败原因。

## 3. 日期动态确认规则

每次任务必须用命令动态确认日期：

```bash
date "+%Y-%m-%d"
```

规则如下：

- 禁止复用旧任务中的日期。
- 禁止在新任务中写死历史日期。
- 新建 plan 或 devlog 文件时，文件名必须使用命令返回的当天日期。
- 历史文件可以保留历史日期，但新任务不得把历史日期当作当前日期。
- 如果当天 devlog 已存在，只能在任务明确允许 devlog 时追加；任务禁止 devlog 时不得新建或追加。

## 4. docs-only 与 runtime 边界

docs-only 只包括不改变系统运行行为的 Markdown 文档，例如治理规则、说明、计划、规格、开发日志和风险判断。

runtime 包括但不限于：

- 源码、测试、测试配置、构建配置。
- 数据库 schema、migration、seed。
- route、service、parser、DTO、repository、audit。
- provider、adapter、credential 相关实现。
- runner、scheduler、queue、worker、cron、outbox。
- 依赖、lockfile、环境变量、生产配置。

如果任务是 docs-only，Codex 只能修改本次明确允许的文档文件。任何 runtime 或准 runtime 内容，都必须等待用户在当前任务中明确批准。

## 5. Plan Mode 与 runtime 边界

Plan Mode 只允许产出：

- 范围定义。
- 边界说明。
- 验收标准。
- 风险判断。
- 依赖和拆分建议。
- 后续候选项。
- 停止条件。

Plan Mode 不允许实现代码、修改 schema、创建 migration、接入真实外部系统、读取真实凭证、创建 runner 或 scheduler。

不得因为计划中提到某个能力，就顺手实现该能力。route、service、parser、DTO、repository、audit、provider、adapter、scheduler 等均属于 runtime 或准 runtime 范围，必须按任务批准后再处理。

## 6. 禁止自动执行的事项

以下内容只表示候选或背景，不构成本轮开发授权：

- devlog 下一步建议。
- Plan 文档中的后续候选任务。
- backlog 清单。
- Phase 24 或其他后续阶段。
- runner、scheduler、real provider、real adapter。
- TC-12C、TC-12D、TC-12E 等已冻结候选项。

Codex 不得自动从建议进入实现，不得自动从 docs-only 进入 runtime，不得自动在 PR 合并后开启下一任务。

## 7. PR 体量限制

PR 必须保持小范围、单主题、可审查、可回滚。

默认限制：

- docs-only PR 原则上最多 2-3 个文档文件。
- runtime PR 原则上最多 3-5 个核心业务文件。
- schema 或 migration 必须单独审批。
- docs-only 治理 PR 不得夹带 runtime 改动。
- 超出范围时必须停止并建议拆分。

提交前必须核对实际修改文件是否仍在本次任务允许范围内。

## 8. 停止条件

出现以下任一情况，必须停止并回报原因：

- 当前目录不是本项目 git 仓库。
- 当前阶段、任务编号或基线不清楚。
- working tree 中出现非本次任务允许的改动。
- 需要修改 `src/**` 或 `drizzle/**`。
- 需要修改 schema、migration、package 或 lockfile。
- 需要新增 runner、scheduler、cron、queue、worker。
- 需要真实凭证、密钥、API Key、OAuth 或 Webhook 签名。
- 需要外部网络调用、真实第三方系统或真实 HIS 对接。
- 需要修改 Superpowers 缓存或 `.codex` 配置。
- 需要删除文件、大规模重构或跨模块 runtime 改动。
- 不确定是否越界。

停止时必须说明触发条件、影响范围、推荐的最小下一步，以及需要用户确认的问题。

## 9. 中文化检查

修改 docs 时，必须执行项目指定的固定英文模板残留检查。

判断规则：

- 如果本次新增或修改的文档命中英文模板残留，必须修正。
- 如果全目录命中历史旧文档，但本次新增或修改文档没有命中，可以说明这是历史残留。
- 不得为了清理历史残留而扩大本次 PR 范围，除非用户明确授权。

后续生成或修改 `docs/superpowers/plans/*.md`、`docs/superpowers/specs/*.md` 时，所有面向人读的标题、模板字段、任务结构说明必须使用中文。

以下内容可以保留原文：

- 技能名，例如 `superpowers:writing-plans`。
- API 路径、文件路径、字段名、枚举值。
- 技术名词，例如 `TypeScript`、`Next.js`、`React`、`Vitest`、`Drizzle`。
- 项目稳定缩写，例如 `HIS`、`API`、`UI`、`DTO`、`PR`。

## 10. 审查与合并

PR 审查前必须确认：

- 实际修改文件是否只包含本次允许范围。
- 是否触碰 `src/**`、`drizzle/**`、`docs/superpowers/**`、`docs/devlog/**`、`docs/roadmap/**`、package、lockfile 或 `.codex/**`。
- 是否包含 schema、migration、runner、scheduler、真实凭证或外部系统影响。
- 验证命令是否已执行并记录结果。
- PR 是否可合并。

Codex 可以协助准备 draft PR、说明风险和整理验证结果，但不得自行转 Ready、不得自行合并、不得推送 `main`，也不得替用户做最终上线判断。

当用户明确要求提交、推送或同步 GitHub 时，Codex 必须先执行第 2.1 节的同步能力检查。检查不通过时必须停止，不得继续扩大改动范围。

## 11. 本规则的修改边界

修改本规则默认按 docs-only 处理。除非用户另行批准，只允许修改：

- `AGENTS.md`。
- `docs/ai-agent-governance.md`。

如果需要修改 runtime、Superpowers 缓存、`.codex` 配置或历史文档清理，必须另起任务并等待人工确认。
