# V0.6 低敏 demo seed 01

## 1. 用途

- 日期 / 时区：2026-07-07 / Asia/Shanghai
- 任务：V0.6-DEMO-SEED-LOW-SENSITIVE-01
- 脚本：`scripts/demo/seed-v06-low-sensitive-demo.ts`
- seedKey：`v06_demo_low_sensitive_01`
- 范围：本地 / 受控 demo 环境限定，低敏演示数据，可重复执行，可清理
- 状态：不提交、不 push、不创建 PR

本 seed 用于把 V0.6 演示链路落成可重复准备的数据：演示租户、演示机构、低敏客户、治疗摘要、知识库 SOP、随访路径、D1 / D3 / D7 阶段任务、消息草稿、客户时间线和运营看板可见数据。

## 2. 数据范围

本 seed 覆盖：

1. 演示租户：`智美天工 V0.6 演示租户`。
2. 演示机构：`星澜医美演示机构`。
3. 角色：机构管理员、咨询师、客服、医助、运营负责人。
4. 低敏客户 4 个：水光术后、光子 / 光电术后、双眼皮术后修复、皮肤管理。
5. 治疗摘要 4 条：`hydro_injection_care`、`photoelectric_care`、`post_surgery_repair`、`skin_management`。
6. 知识库 SOP 样本 6 份。
7. 路径纳入 4 条。
8. D1 / D3 / D7 阶段任务 12 条。
9. 消息草稿 4 条，均为 `manual` channel，禁止自动发送。
10. 客户时间线不少于 16 条。
11. 运营看板可聚合的任务、路径、草稿、时间线数据。

## 3. 低敏字段规则

只允许写入低敏演示字段：

- `customerDisplayName` 使用 `演示客户A-D`。
- 年龄只使用年龄段。
- 标签只使用低敏业务标签。
- 最近治疗项目只使用项目类别。
- 风险等级只使用 `normal` / `watch` 等低敏枚举。
- 负责人只记录角色或演示账号。
- 当前路径状态只记录路径 key 和人工处理状态。

禁止写入或输出：

- 真实客户姓名、手机号、身份证、病历号、地址。
- `.env.local`、secret、API key 或连接串明文。
- provider、model、token、cost、vendor 等真实供应商或计量字段。
- HIS payload、企业微信 payload、短信 payload、外部 webhook payload。
- 完整 SQL payload。

所有核心记录必须可追踪到 `v06_demo_low_sensitive_01`：客户和治疗摘要使用 tags，随访路径 / 草稿 / 时间线使用 metadata，知识库文档使用 version，其他表使用确定性主键前缀 `v06-demo-low-sensitive-01-*`。

## 4. dry-run

项目已有 `tsx`，执行脚本时沿用现有 runner，不新增依赖。

```bash
./node_modules/.bin/tsx scripts/demo/seed-v06-low-sensitive-demo.ts --dry-run
```

默认不传参数也是 dry-run：

```bash
./node_modules/.bin/tsx scripts/demo/seed-v06-low-sensitive-demo.ts
```

dry-run 只输出低敏摘要、记录数量和跳过数量，不连接数据库、不写库、不输出连接串明文。

## 5. apply

写入必须同时满足：

1. 显式传入 `--apply`。
2. 显式设置 `ZMTG_ALLOW_DEMO_SEED=1`。
3. 数据库 host 只允许 `localhost`、`127.0.0.1`、`::1` 或包含 `demo` 标识。

```bash
ZMTG_ALLOW_DEMO_SEED=1 ./node_modules/.bin/tsx scripts/demo/seed-v06-low-sensitive-demo.ts --apply
```

apply 输出低敏摘要和每张表的 `created`、`alreadyExists`、`skipped` 数量。重复执行通过确定性主键和 `on conflict (id) do nothing` 保持幂等，不重复创建。

## 6. cleanup

清理必须同时满足：

1. 显式传入 `--cleanup`。
2. 显式设置 `ZMTG_ALLOW_DEMO_SEED=1`。
3. 数据库 host 只允许 `localhost`、`127.0.0.1`、`::1` 或包含 `demo` 标识。

```bash
ZMTG_ALLOW_DEMO_SEED=1 ./node_modules/.bin/tsx scripts/demo/seed-v06-low-sensitive-demo.ts --cleanup
```

cleanup 只删除 `v06_demo_low_sensitive_01` 对应的确定性主键范围，先删时间线、草稿、阶段、路径、任务、模板、知识库派生数据，再删治疗摘要、客户、成员、租户和演示账号。租户记录仅在本 seed 成员清理后再删除。

cleanup 输出每张表的 `cleaned` 和 `skipped` 数量，不删除非本 seed 数据。

## 7. 安全保护条件

- 默认 dry-run，不写库。
- `--apply` 和 `--cleanup` 不能同时传入。
- 写库和清理必须设置 `ZMTG_ALLOW_DEMO_SEED=1`。
- 数据库 host 必须是 localhost / 127.0.0.1 / ::1 / demo 标识。
- 脚本输出只包含低敏摘要和数量。
- 脚本不输出连接串明文、secret、token 或完整 SQL payload。
- 脚本不修改 schema / migration / package / lock。

## 8. 明确不做

- 不连接生产库。
- 不发送消息。
- 不接 HIS。
- 不接企业微信。
- 不接短信。
- 不接外部 webhook。
- 不调用真实 AI。
- 不真实出网。
- 不覆盖已有真实数据。
- 不删除非本 seed 创建的数据。

## 9. 测试覆盖

测试文件：`scripts/demo/seed-v06-low-sensitive-demo.test.ts`。

覆盖点：

1. 默认 dry-run 不写库。
2. 未设置 `ZMTG_ALLOW_DEMO_SEED=1` 时 `--apply` 被阻断。
3. 生产风险数据库 URL 被阻断，测试只用 mock 字符串，不输出真实连接串。
4. 生成数据不包含手机号 / 身份证 / 病历号 / 地址。
5. 生成数据不包含 provider / token / cost / vendor。
6. seedKey 存在且为 `v06_demo_low_sensitive_01`。
7. 幂等策略存在。
8. cleanup 只选择 seedKey 数据。
9. 水光命中 `hydro_injection_care`。
10. 光电命中 `photoelectric_care`。
11. 双眼皮命中 `post_surgery_repair`。
12. 不真实出网。
13. 不调用真实 AI。
14. 不发送真实消息。

## 10. 后续 Codex 复核重点

1. 复核所有 seed 数据是否仍为低敏样本。
2. 复核 `v06_demo_low_sensitive_01` 是否覆盖所有可追踪记录。
3. 复核 `--apply` 和 `--cleanup` 的门禁是否不能绕过。
4. 复核 cleanup 是否只删除本 seed 的确定性主键范围。
5. 复核输出是否不包含连接串明文、secret、token 或完整 SQL payload。
6. 复核未修改 schema / migration / package / lock。
7. 复核没有真实发送、HIS、企业微信、短信、外部 webhook 或真实 AI 调用。
