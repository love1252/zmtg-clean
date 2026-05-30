# 本地开发

## 环境要求

- Node.js 20 或更新版本
- pnpm 9 或更新版本

## 启动

```bash
pnpm install
pnpm dev
```

打开地址：

```text
http://localhost:5010
```

## 本地数据库

第三阶段使用 PostgreSQL + Drizzle。需要在本地 shell 中设置 `DATABASE_URL`，不要把真实连接串提交到仓库。

常用命令：

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

如果本机没有把裸 `pnpm` 放进 PATH，也可以使用本机的完整 `pnpm` 路径执行等价命令。

如果没有配置 `DATABASE_URL`，应用中的真实落库 API 会返回稳定错误，不应泄露连接串。

### 写入 API 验证

设置 `DATABASE_URL` 并完成迁移、种子后，可以用演示账号登录，再验证写入 API：

```bash
curl -i -X POST http://localhost:5010/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"admin123"}'

curl -i -X POST http://localhost:5010/api/institution/customers \
  -H 'content-type: application/json' \
  -H 'cookie: zmtg_demo_session=<从登录响应复制 cookie 值>' \
  -d '{"displayName":"测试客户","lifecycle":"consulting","priority":"observe","ownerUserId":"demo-user-admin","projectInterest":"皮肤管理","maskedPhone":"masked-demo","maskedMedicalRecordNo":"DEMO-MR-WRITE","lastTouchSummary":"本地写入验证","nextAction":"继续跟进","tags":["本地验证"]}'
```

不要把真实 `DATABASE_URL`、cookie 或业务数据写入文档、提交记录或截图。

## 路线图

当前 clean 项目的已完成阶段、旧项目功能取舍和 Phase 5 建议范围记录在：

```text
docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md
```

## 演示账号

本地演示认证默认在 `development` 和 `test` 环境启用：

```text
机构端：admin / admin123
平台端：platform / admin123
```

生产环境默认禁用演示认证。若仅用于临时演示，需要显式设置：

```text
ZMTG_ENABLE_DEMO_AUTH=true
```

## 验证

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 规则

- 不要把业务数据存入 localStorage。
- 不要添加生产备用账号。
- 不要信任浏览器发送的租户编号。
- mock provider 仅限 development 和 test 环境使用。
