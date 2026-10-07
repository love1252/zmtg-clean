# 日常业务可用版：隔离真实会话验收

使用本机 Colima 中已经存在的 `postgres:16-alpine` 镜像，在唯一命名的新容器与空库中运行真实 Next、PostgreSQL、密码登录及机构权限校验。没有模拟 HTTP 接口或伪造会话。不要在含有 `.env`、`.env.local`、`.env.production` 等实际环境配置的工作目录运行。

## 执行

```bash
node scripts/verify/daily-usable-environment.mjs create 52717
# 将上条命令输出的环境记录路径赋给本任务变量；不要打印文件内容。
DAILY_USABLE_STATE=/absolute/path/to/environment.json
node scripts/verify/daily-usable-environment.mjs setup "$DAILY_USABLE_STATE"
node scripts/verify/daily-usable-environment.mjs build "$DAILY_USABLE_STATE"
node scripts/verify/daily-usable-environment.mjs serve "$DAILY_USABLE_STATE"
# 另一个终端执行；serve 保持运行。
node scripts/verify/daily-usable-environment.mjs verify "$DAILY_USABLE_STATE"
node --test scripts/verify/daily-usable-environment.test.mjs
```

`build` 与 `serve` 的第三个参数可指定另一个无真实环境配置的隔离工作树，供集成修改后复验。源码与依赖由所选工作树提供，数据库和临时密钥仍来自本任务专用环境记录。

环境记录与同目录 `synthetic-accounts.json` 均为 `0600`，目录为 `0700`。后者含临时生成的合成登录账号，供浏览器操作；不得把这些文件提交到 Git、PR 或作为真实环境凭证使用。生产模式应用地址为 `http://127.0.0.1:52717`（或创建时指定的端口）。

关闭服务后清理本任务容器及其临时卷：

```bash
node scripts/verify/daily-usable-environment.mjs stop "$DAILY_USABLE_STATE"
```

清理前核对容器 ID、名称、任务标签、镜像与 loopback 端口；不会停止 Colima 或操作其他容器。`setup` 重复运行会安全拒绝非空库，不清空、不补写已有库。需要重置验收数据时清理该任务容器，再创建新环境。

## 数据与验收边界

- 使用仓库 `0045` 纯结构基线，校验其文件 SHA-256，然后实际执行原始 `0046–0053` 迁移。记录实际 SQL 摘要与时间戳，不把结构基线冒充 `0000–0045` 历史迁移执行证据。
- 新建两家合成机构，以及管理员、运营、顾问、客服和另一机构管理员五个正式账号。Membership 与 Binding 通过真实 command 建立。
- 甲机构有 135 条未来预约和 135 条逾期待办，乙机构各 3 条。任务属于顾问角色池，因此客服看不到这些任务，管理角色和顾问可见。
- 验证真实登录、正式会话、角色及机构身份、超过 100 条分页、未来预约日期筛选、跨机构拒绝、非法分页拒绝。
- 不访问远程测试服、既有业务库或第三方业务服务，不加载或继承真实业务配置。这不能代替远程部署验收，也不证明本次尚未集成的 UI 修改已可用。

## 已执行证据

2026-10-07（Asia/Shanghai），应用基线 `4780d9495033b05d02892805770c6afc5f554a03` 加本目录验收脚本：

- PostgreSQL 16 的新空库结构准备与八个后续迁移成功。
- 生产构建及真实 `next start` 成功。
- 69 项真实 HTTP／会话／机构权限检查通过，4 项环境安全单元测试通过。
- ESLint、TypeScript 类型检查通过；对已初始化任务库再次执行 `setup`，按预期拒绝非空库。

每次 `verify` 的脱敏检查记录写入环境记录同目录 `verification.json`。成功日志不输出 Cookie、数据库连接串或临时密钥。业务流程会改变夹具数据；完成任务处理后如需重跑固定数量断言，应使用新环境，不能调整生产断言来适配已修改的夹具。
