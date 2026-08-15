# V0.8-04F-C-AUTHORIZATION-DRAFT：单机构测试账号人工确认发送 proof 授权模板预填稿

> **2026-08-16 现行演示身份校准**
>
> 当前主演示账号固定为 `admin`，对应主演示机构 **澄星医疗美容**，
> canonical demo mapping 为 `growth-tenant-chengxing / growth-inst-chengxing`。
> 本文原有 `v06-demo-low-sensitive-01-*` tenant / institution / workspace 标识仅属于当时的
> mock-only legacy fixture，不再作为 current candidate formal authority source。
> 当前 Scope / Context / Binding provisioning 只能依据 2026-08-16 用户重新批准的 current-candidate policy。

文档日期 / 时区：2026-07-09 / CST +0800

当前基线：`main / origin/main = 8222170f9ea4bf81c296edd3e46f88aafd8b52d6`

## 1. 背景

PR #491 已完成 4F-C-PLAN 授权清单与执行门槛，明确进入“单机构测试账号人工确认发送 proof”前必须逐项完成授权确认。

V0.8-04F-C-PRECHECK-01 已完成只读盘点，当前可用于授权模板预填的对象仅限系统内 mock-only 占位对象：

- 系统内测试机构：澄星医疗美容。
- 系统内测试操作人：客服。
- emergency stop 负责人占位：运营负责人。
- 系统内测试接收人：演示客户A，水光场景。

当前仍未授权真实企业微信主体、真实测试账号、真实接收人、secret 配置、真实出网和真实发送。

## 2. 本次目标

本文只新增 4F-C 授权模板预填稿，把用户已确认的系统内 mock-only 占位对象填入授权模板，便于后续人工逐项确认。

本次不开发功能，不接真实企业微信，不接真实微信，不接短信，不接 HIS，不接 webhook，不配置 secret，不读取 secret，不真实出网，不真实发送。

## 3. 非目标

本文不代表真实 proof 已授权。

本文不代表可以开始 4F-C 真实代码开发。

本文不代表可以开始 4F-D。

本文不代表可以配置 secret、token、API key 或真实 callback / webhook。

本文不代表可以向真实客户、外部联系人、员工或测试账号发送消息。

## 4. 本次预填范围

本次只预填以下系统内 mock-only 占位对象：

| 类别 | 预填内容 | 状态 |
| --- | --- | --- |
| 系统内测试机构 | 澄星医疗美容；`institutionId=v06-demo-low-sensitive-01-xinglan-institution`；`tenantId=v06-demo-low-sensitive-01-tenant`；`workspaceId=v06-demo-low-sensitive-01-workspace` | 已确认，仅限系统内 mock-only 占位 |
| 系统内测试操作人 | 客服；`v06_demo_low_sensitive_service` | 已确认，仅限系统内 mock-only 占位 |
| emergency stop 负责人占位 | 运营负责人；`v06_demo_low_sensitive_ops` | 已确认，仅限系统内 mock-only 占位 |
| 系统内测试接收人 | 演示客户A；`v06-demo-low-sensitive-01-customer-hydro-a`；水光场景 | 已确认，仅限系统内 mock-only 占位 |

以上对象只用于授权模板预填，不是真实企业微信主体、真实企业微信员工、真实外部联系人或真实接收人。

## 5. 4F-C 授权模板预填表

| 序号 | 授权确认项 | 预填内容 | 当前状态 | 备注 |
| --- | --- | --- | --- | --- |
| 1 | 测试机构是哪一家 | 澄星医疗美容；`institutionId=v06-demo-low-sensitive-01-xinglan-institution`；`tenantId=v06-demo-low-sensitive-01-tenant`；`workspaceId=v06-demo-low-sensitive-01-workspace` | 已确认，仅限系统内 mock-only 占位 | 不代表真实机构 proof 已授权 |
| 2 | 测试企业微信主体是哪一个 | 未授权 / 待用户确认 | 未确认 | 不得使用客户企业微信主体；后续如进入真实 proof，只能使用用户可控企业微信主体 |
| 3 | 测试账号是谁 | 系统内操作人占位：客服 / `v06_demo_low_sensitive_service`；真实企业微信测试账号：未授权 / 待用户确认 | 系统内占位已确认，真实账号未确认 | 不代表真实企业微信员工账号已授权 |
| 4 | 测试接收人是谁 | 系统内接收人占位：演示客户A / `v06-demo-low-sensitive-01-customer-hydro-a`；真实企业微信接收人：未授权 / 待用户确认 | 系统内占位已确认，真实接收人未确认 | 不代表真实客户或外部联系人已授权 |
| 5 | 是否允许真实出网 | 否 | 未授权 | 继续保持 `noRealNetwork=true` |
| 6 | 是否允许配置 secret | 否 | 未授权 | 不配置 secret、token、API key |
| 7 | secret 由谁保管 | 未授权 / 待用户确认 | 未确认 | 不得在文档中填写 secret 内容 |
| 8 | 是否允许发送一条测试消息 | 否 | 未授权 | 继续保持 `noRealSend=true` |
| 9 | 测试消息内容是什么 | 这是一条智美天工企业微信通道联调测试消息，无需回复。 | 仅作为候选文案，不代表允许发送 | 真实发送前仍需二次确认 |
| 10 | 发送前是否需要二次确认 | 是 | 建议项，仍需发送前二次确认 | 未二次确认前不得发送 |
| 11 | 日志记录哪些字段 | 测试机构内部标识、系统内操作人占位标识、系统内接收人占位标识、发送状态、时间、操作人、错误类型、回滚状态 | 仅限低敏字段建议 | 不记录真实 secret、真实接口返回全文或聊天原文 |
| 12 | 哪些字段必须脱敏 | 手机号、姓名、微信号、`external_userid`、`openId`、`unionId`、聊天内容、企业微信接口返回敏感字段、secret、token、API key | 必须脱敏 / 禁止输出 | 无法判断是否低敏时默认不得记录 |
| 13 | 谁负责 emergency stop | 系统内负责人占位：运营负责人 / `v06_demo_low_sensitive_ops`；真实负责人：待用户确认 | 系统内占位已确认，真实责任人未确认 | 真实 proof 前必须明确责任人和触发方式 |
| 14 | 失败如何回滚 | 立即关闭真实出网和真实发送开关，撤销测试配置，停止外部调用，只保留低敏 audit 结果，回退到 dry-run / no-send 状态 | 预案草案，真实 proof 前仍需用户确认 | 不得依赖本文自动执行回滚 |
| 15 | proof 成功后是否进入 4F-D | 另行确认 | 未授权自动进入 4F-D | 即使 proof 成功，也不能自动开始 4F-D |

## 6. 当前安全门禁

当前仍保持以下安全门禁：

```txt
allowRealSend=false
externalChannelEnabled=false
realSendAllowed=false
noRealSend=true
noRealNetwork=true
noSecretRead=true
noSecretOutput=true
```

以上门禁不得由本文自动改变。任何打开真实发送、真实出网、secret 读取或外部通道的动作，都必须另开任务、单独授权、单独验收。

## 7. 禁止边界

当前仍禁止：

- 接真实企业微信 / 微信 / 短信 / HIS / webhook。
- 配置 secret / token / API key。
- 读取或输出 `.env.local`。
- 读取 `process.env` 中真实 secret。
- 写真实 callback / webhook。
- 做扫码托管 / 端口 / 机器编号 / uip。
- 真实发送消息。
- 真实出网测试。
- 同步真实客户 / 外部联系人 / 聊天记录。
- 接入会话内容存档。
- 真实自动回复 / 真实随访 / 真实群发 / 真实自动加好友。
- 新增 schema / migration / package / lock。
- 开始 4F-C 真实代码开发。
- 开始 4F-D。

## 8. 日志与脱敏边界

后续如果用户另行授权真实 proof，日志仍必须采用最小化记录。

当前建议的低敏日志字段只包括：

- 测试机构内部标识。
- 系统内操作人占位标识。
- 系统内接收人占位标识。
- 发送状态。
- 时间。
- 操作人。
- 错误类型。
- 回滚状态。

当前必须脱敏或禁止输出的字段包括：

- 手机号。
- 姓名。
- 微信号。
- `external_userid`。
- `openId`。
- `unionId`。
- 聊天内容。
- 企业微信接口返回敏感字段。
- secret、token、API key。
- `.env.local` 内容。
- `process.env` 中真实 secret。

如果某个字段无法确认是否低敏，默认不得记录、不得展示、不得输出。

## 9. emergency stop 与回滚责任

当前只确认系统内 emergency stop 负责人占位：运营负责人 / `v06_demo_low_sensitive_ops`。

真实 proof 前仍必须由用户确认真实责任人、触发方式、关闭开关、撤销配置、停止调用和回滚完成验收。

失败回滚草案如下：

1. 立即关闭真实出网和真实发送开关。
2. 撤销测试配置。
3. 停止外部调用。
4. 不保留真实接口返回敏感字段。
5. 只保留低敏 audit 结果。
6. 回退到 dry-run / no-send 状态。
7. 复核 `allowRealSend=false`、`externalChannelEnabled=false`、`realSendAllowed=false`、`noRealSend=true`、`noRealNetwork=true`。

该草案不等于真实 proof 授权，也不等于真实回滚方案已最终确认。

## 10. 进入 4F-D 的判断条件

当前未授权自动进入 4F-D。

后续如要判断是否进入 4F-D，至少需要单独确认：

- 4F-C 是否获得真实 proof 的逐项授权。
- 是否只使用用户可控企业微信主体。
- 是否只使用唯一测试账号和唯一测试接收人。
- 是否只发送单条已确认测试消息。
- 是否没有误触达。
- 是否没有 secret 泄露。
- 是否没有真实聊天记录同步。
- 是否没有客户自动回复、真实群发或自动加好友。
- MessageDelivery、timeline、audit、dashboard 是否只保留低敏结果。
- emergency stop 和回滚是否完成验收。

未完成上述判断前，不得开始 4F-D。

## 11. 阶段结论

当前只完成授权模板预填稿。

当前只确认系统内 mock-only 占位对象。

真实企业微信主体、真实测试账号、真实接收人、secret 保管人、真实出网和真实发送仍未授权。

下一步不能直接进入真实发送。

后续如要继续，建议先做“4F-C mock-only proof binding 文档或占位数据方案”，再决定是否进入真实 proof。

本文不授权真实企业微信接入，不授权 secret 配置，不授权真实出网，不授权真实发送，不授权开始 4F-C 真实代码开发，不授权开始 4F-D。
