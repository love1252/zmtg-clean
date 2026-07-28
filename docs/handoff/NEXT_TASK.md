# 下一任务

## 当前交接状态

`V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT` 已通过 PR #791 完成并合并：

- PR Head：`cf7423f51906ce92a6de01c0a3cd0e02b2a774da`
- Merge Commit：`99560c98faa987ecf79e66d18a4df1aa76d77c9e`
- 完成文档：`docs/architecture/v2-02c-platform-auth-route-preflight.md`
- 正式平台服务端授权根：`缺失`
- 平台 Runtime／发布准入：`阻断`
- Runtime、Schema、Migration 修改：`0`

该结果只冻结平台入口、Session、授权根、页面与 API 路由族、legacy／v1 影响面、阻断状态和七个候选实施切片，不表示平台 Runtime、Route Group 或任何候选切片已经实施。

当前项目级顺序为：

```text
V2-QUALITY-CI-01-MINIMUM-ARCHITECTURE-QUALITY-GATE
→ 独立 handoff
→ MIG-01 后续独立数据 PR
→ 后续既定顺序
```

MIG-01 内部候选顺序继续保持：

```text
A2
→ BASE-02
→ Writer
→ Audit／模板
→ B
→ C
→ Reader
```

该内部顺序不是当前项目级 `NEXT_TASK`，也不表示任何 MIG-01 切片已获实施授权。

最小 Architecture／Quality CI、七个平台候选实施切片、MIG-01A2 和机构端旧任务均未启动。

## 唯一下一任务

```text
V2-QUALITY-CI-01-MINIMUM-ARCHITECTURE-QUALITY-GATE
最小架构与质量 CI 门禁
```

该任务是唯一下一任务，但尚未启动。只有用户在后续任务中明确授权后，才可按本文白名单创建 Workflow、检查器、自测、规则配置并修改 `package.json`；本次 handoff 不构成 CI、Runtime、环境、分支保护或发布授权。

## 一、未来任务的精确文件范围

未来 `V2-QUALITY-CI-01-MINIMUM-ARCHITECTURE-QUALITY-GATE` 只允许修改或创建：

```text
.github/workflows/architecture-quality.yml
scripts/verify/architecture-quality.mjs
scripts/verify/architecture-quality-rules.json
scripts/verify/architecture-quality.test.mjs
package.json
```

不得修改 `pnpm-lock.yaml`，不得新增依赖。若实现需要第六个文件、第三方依赖或锁文件变化，必须停止并重新申请授权。

未来任务只建立最小架构增量检查与现有质量命令的 CI 编排，不修改业务源码、Schema、Migration、API 或 UI，也不配置分支保护或 Required Check。

## 二、本地命令契约

未来任务必须在 `package.json` 新增以下命令：

```json
{
  "check:architecture": "node scripts/verify/architecture-quality.mjs",
  "check:architecture:test": "node --test scripts/verify/architecture-quality.test.mjs",
  "ci:quality": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
}
```

命令职责固定为：

- `check:architecture`：基于 PR Base 与 Head 的差异执行静态架构增量检查；
- `check:architecture:test`：使用 Node 内置 test runner 执行检查器自测；
- `ci:quality`：串行运行现有 `lint`、`typecheck`、`test` 和 `build`。

不得改变现有 `dev`、`start`、`preflight`、`db:*`、`lint`、`typecheck`、`test` 或 `build` 命令语义。检查器应复用仓库现有 TypeScript 能力，不得为 AST 解析新增依赖。

## 三、增量检查模型

### 3.1 Base 与 Head

检查器必须以明确的 Base 和 Head 为输入：

```text
--base <PR base SHA>
--head <PR head SHA>
```

Workflow 必须传入 GitHub PR 事件中的 Base SHA 与 Head SHA。本地调用也必须提供可解析的 Base／Head，或使用检查器明确支持且可验证的等价输入。

出现以下任一情况必须非零退出：

- Base 或 Head 缺失；
- SHA／ref 无法解析；
- Base 对象或 Head 对象不存在；
- Base 与 Head 没有可验证的共同历史；
- 无法取得 Base 与 Head 的差异；
- 配置无效、规则未知或检查过程异常。

不得在 Base 不明时退化为全仓扫描后放行，也不得默认使用可能错误的 `main`、`HEAD^` 或空差异。

### 3.2 差异语义

检查器必须基于 Git 可验证的 Base 与 Head 差异处理新增、修改、复制、重命名和删除：

- 既有且未修改的历史债务不得导致本 PR 失败；
- 新增或复制到受限路径的文件按新增处理；
- 重命名进入受限路径的目标文件按新增处理；
- 删除或迁出受限路径本身不得被误报为新增违规；
- 修改既有文件时，新增的违规依赖边必须失败；
- 已存在且本次没有新增的违规依赖边不得因全仓历史债务被重复判失败；
- 正常 `/api/v1/**` 文件不得因 legacy Route 规则被误报。

实现必须使用 NUL 安全或等价可靠的 Git 差异读取方式，并正确处理含空格路径、rename 和 delete。

## 四、最小架构规则

检查器至少阻止本次差异新增以下内容：

1. 根目录 `database/**`，防止建立第二套数据库资产；
2. `src/app/api/institution/**` 下新的非版本化 `route.ts`；
3. `src/app/api/open-platform/**` 下新的非版本化 `route.ts`；
4. `src/modules/institution/**` 中未经精确例外登记的新文件；
5. `src/modules/open-platform/**` 中未经精确例外登记的新文件；
6. Domain 文件新增指向 `src/app/**`、`src/server/db/**`、`src/integrations/**`、React 或 Next.js 的依赖边；
7. 一个业务模块新增直接导入另一业务模块 `server/**` 或 Repository 实现的依赖边。

规则只约束增量，不得借首个 CI PR 一次性清算全部历史债务。任何新增违规路径或依赖边都必须非零退出，不得只打印 warning。

### 4.1 依赖解析

检查器必须使用 TypeScript AST 或等价可靠方式读取并规范化：

- 静态 `import`；
- `export ... from`；
- 动态 `import()`；
- 相对路径和仓库现有 alias。

不得仅依赖普通子串、正则扫描源文件或文件名猜测依赖。解析失败、无法归一化本应受检查的依赖或发现绕过形式时必须 fail-closed。

### 4.2 精确例外

所有例外只能记录在：

```text
scripts/verify/architecture-quality-rules.json
```

每条例外至少包含：

- 规则类型；
- 精确文件路径，或精确的 `from`／`to` 依赖边；
- 任务编号；
- 原因；
- 所有者；
- 删除条件或复核条件。

例外只能豁免完全匹配的违规身份。禁止：

- `*`、`**`、`?`、字符组或其他通配表达式；
- 只登记目录前缀；
- 空任务编号、空原因、空所有者或无复核条件；
- 未知规则类型；
- 重复或相互覆盖的例外；
- 用例外放宽整个模块、Route 族或依赖方向。

无效配置、宽泛例外和无法解释的例外必须 fail-closed。

## 五、检查器自测

`scripts/verify/architecture-quality.test.mjs` 必须使用 Node 内置 test runner，至少覆盖：

1. 新建根 `database/**` 被拒绝；
2. 新增 institution 或 open-platform legacy Route 被拒绝；
3. 冻结聚合模块新增文件被拒绝；
4. 完全匹配的精确例外可通过；
5. Domain 越层依赖被拒绝；
6. 跨业务模块 server／Repository 依赖被拒绝；
7. 当前已有债务在未修改时不会失败；
8. 修改旧文件并新增违规边时失败；
9. 错误 Base、缺失对象、无效配置和宽泛例外 fail-closed；
10. rename、delete 和正常 v1 文件处理正确。

自测 fixture 必须在测试运行期间创建和清理，不得为 fixture 新增第六个仓库文件。测试不得使用 skip、only、静默吞错或永远返回 `0` 的替身实现。

## 六、GitHub Workflow

`.github/workflows/architecture-quality.yml` 必须：

- 使用 `pull_request`，禁止 `pull_request_target`；
- 只授予 `contents: read`；
- 不读取或传递 Secret；
- 不连接数据库或业务外部系统；
- checkout 使用完整历史或足以可靠取得 PR Base／Head 的历史；
- 使用 Node 20、pnpm 9，并执行 `pnpm install --frozen-lockfile`；
- 将 PR Base SHA 与 Head SHA 显式传给 `check:architecture`；
- 设置合理的 job timeout；
- 设置并发组和 `cancel-in-progress: true`；
- 使用官方 GitHub Action，并在未来任务执行时核验后固定到完整 commit SHA；
- 为 PR 产生真实、可见且失败会阻断该 Workflow 的状态检查。

Workflow 必须按以下顺序运行：

1. `pnpm check:architecture:test`
2. `pnpm check:architecture -- --base <PR base SHA> --head <PR head SHA>`
3. `pnpm lint`
4. `pnpm typecheck`
5. `pnpm test`
6. `pnpm build`

未来任务不配置分支保护或 Required Check。任何仓库设置变更都需要后续独立授权。

## 七、未来任务的启动和停止条件

未来任务启动前必须再次确认：

- `main` 与 `origin/main` 同步；
- working tree 干净；
- 五文件白名单没有被其他任务占用；
- 当前 `lint`、`typecheck`、`test` 和 `build` 命令仍存在；
- GitHub Actions 和 package manager 版本由当前仓库证据核验。

遇到以下任一情况必须停止：

- 冻结 `main` 上现有 `lint`、`typecheck`、`test` 或 `build` 失败；
- 需要修改业务源码或现有测试以掩盖失败；
- 需要新增依赖或修改 `pnpm-lock.yaml`；
- 无法可靠确定或取得 Base／Head；
- AST／路径归一化无法可靠覆盖目标规则；
- 需要宽泛例外才能通过；
- Workflow 必须读取 Secret、连接环境或扩大权限；
- 需要配置分支保护、Required Check 或其他仓库设置；
- 出现五文件外改动、并发写入或未获授权范围。

失败时必须报告真实基线结果，不得通过降低规则、跳过命令、吞掉异常或让检查器固定返回成功来绕过。

## 八、禁止范围

未来 `V2-QUALITY-CI-01` 不得：

- 修改 `src/**`、`drizzle/**`、业务测试、Schema、Migration、API 或 UI；
- 修改现有测试以掩盖失败；
- 删除、跳过或放宽既有门禁；
- 使用 test skip、only、静默吞错或永远返回 `0`；
- 新增依赖或修改 `pnpm-lock.yaml`；
- 修改现有 `dev`、`start`、`preflight`、`db:*` 命令语义；
- 使用 `pull_request_target`；
- 读取 `.env.local`、`DATABASE_URL`、Token、Secret、私钥或凭证；
- 连接数据库、HIS、企业微信、AI 厂商、对象存储、测试服务器或生产环境；
- 配置分支保护或 Required Check；
- 启动平台 Session、Policy、页面 Guard、Route Guard 或其他平台 Runtime；
- 启动 MIG-01A2 或其他 MIG-01 实施切片；
- 恢复或启动机构端旧任务；
- 自动进入正式审查（Ready）或自动合并（Merge）。

## 九、未来任务的验证与交付

未来任务至少必须确认：

1. 修改文件精确为五文件白名单；
2. `pnpm-lock.yaml` 未修改，新增依赖为 `0`；
3. `pnpm check:architecture:test` 通过；
4. `pnpm check:architecture -- --base <基线> --head <任务 Head>` 通过；
5. `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 依次通过；
6. PR 上产生真实 Architecture／Quality 状态检查并通过；
7. `git diff --check` 通过；
8. 业务 Runtime、Schema、Migration 修改均为 `0`；
9. 未读取凭证或环境变量值，未连接数据库或业务外部环境；
10. 工作树提交后干净，最终只有一个同主题提交；
11. 只创建草稿 PR，不自动进入正式审查，不自动合并；
12. 未启动平台候选切片、MIG-01A2 或机构端旧任务。

未来 `V2-QUALITY-CI-01` 的完成定义仅是：最小增量架构检查、检查器自测、现有质量命令编排和真实 PR 状态检查已经建立并验证。它不表示历史架构债务已经清零、分支保护已经配置、平台授权已经实施、MIG-01 已获实施授权或七线已经正式发布。
