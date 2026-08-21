# V0.8 目标 4F-C：单机构测试账号人工确认发送 proof 授权清单与执行门槛

## 1. 日期与基线

- 日期：2026-07-09 CST +0800。
- 当前基线：`main / origin/main = c6e00b899550ada67afba2ef96da2f712537f680`。
- 任务编号：`V0.8-04F-C-PLAN`。
- 任务类型：docs-only / proof 前置授权清单 / 不开发功能 / 不真实出网 / 不真实发送。

## 2. 文档目的

本文用于在进入 V0.8 目标 4F-C「单机构测试账号人工确认发送 proof」前，明确必须由用户或负责人逐项确认的授权清单、安全门槛、日志边界、脱敏要求、emergency stop 责任、回滚责任，以及是否可以进入 4F-D 的判断条件。

本文只做 proof 前置授权清单，不开发代码，不新增 API，不新增 UI，不新增 schema / migration，不修改 package / lock，不接真实企业微信，不接真实微信，不接短信、HIS 或 webhook，不配置 secret、token 或 API key，不读取 secret，不读取或输出 `.env.local`，不读取 `process.env` 中真实 secret，不写真实 callback 或 webhook，不真实出网，不真实发送，也不开始 4F-C 真实代码开发或 4F-D。

核心结论：当前仍不能进入真实发送 proof。只有用户或负责人对本文清单逐项明确授权后，才允许另开任务评估 4F-C 真实 proof。

## 3. 任务背景

4F-A 已完成官方企业微信 dry-run 配置骨架与无密钥占位。该阶段只确认低敏配置状态、无密钥占位、callback URL 占位和默认关闭策略，不保存、不读取、不输出真实 secret。

4F-B 已完成官方路线 dry-run，不真实发送。该阶段完成 `networkMode=disabled`、`networkMode=mock`、`networkMode=live_dry_run_requested` 的本地模拟和阻断口径，明确 `mock_dry_run_completed` 只代表本地模拟 dry-run 完成，不代表真实企业微信接入 ready。

4F-C 将开始触及“测试账号人工确认发送 proof”。该阶段的风险高于 4F-A / 4F-B，因为它可能涉及真实出网、真实 secret、真实测试账号、真实测试接收人和真实测试消息。因此，本次只做 proof 前授权清单，不做真实 proof。

## 4. 本次目标

本次目标是形成一份可被人工逐项勾选的 4F-C 前置授权清单，并明确：

- 哪一家测试机构可以进入 proof 评估。
- 哪一个测试企业微信主体可以用于 proof 评估。
- 哪个测试账号和哪个测试接收人被允许参与。
- 是否允许真实出网、配置 secret 和发送一条测试消息。
- 发送前是否必须二次确认。
- 日志记录哪些字段、哪些字段必须脱敏或禁止记录。
- 谁负责 emergency stop。
- proof 失败如何回滚。
- proof 成功后是否可以进入 4F-D。

本文不产生任何运行时能力，也不改变当前系统默认门禁。

## 5. 非目标

本任务不是以下内容：

- 不是 4F-C 真实代码开发。
- 不是 4F-D。
- 不是真实企业微信 / 微信 / 短信 / HIS / webhook 接入。
- 不是配置 secret、token 或 API key。
- 不是读取 secret。
- 不是读取或输出 `.env.local`。
- 不是读取 `process.env` 中真实 secret。
- 不是写真实 callback 或 webhook。
- 不是扫码托管、端口、机器编号、uip 或账号托管。
- 不是真实发送消息。
- 不是真实出网测试。
- 不是同步真实客户、外部联系人或聊天记录。
- 不是接入会话内容存档。
- 不是真实自动回复、真实随访、真实群发或真实自动加好友。
- 不是新增 schema / migration / package / lock。
- 不是修复无关 typecheck 技术债。

## 6. 进入 4F-C 真实 proof 前必须确认的 15 项

以下 15 项必须由用户或负责人逐项明确确认。任何一项未确认，都不能进入真实发送 proof。

| 序号 | 确认项 | 必须填写或确认的内容 | 当前默认结论 |
| --- | --- | --- | --- |
| 1 | 测试机构是哪一家 | 明确单一测试机构，不得使用模糊机构范围 | 未授权 |
| 2 | 测试企业微信主体是哪一个 | 明确测试企业微信主体，真实标识不得写入仓库或 PR | 未授权 |
| 3 | 测试账号是谁 | 明确测试账号和账号责任人，不得使用无责任归属账号 | 未授权 |
| 4 | 测试接收人是谁 | 明确单一测试接收人，必须确认不会误触达真实客户 | 未授权 |
| 5 | 是否允许真实出网 | 明确是否允许访问企业微信 / 微信官方测试接口 | 默认不允许 |
| 6 | 是否允许配置 secret | 明确是否允许在受控测试环境配置 secret，不得入库 | 默认不允许 |
| 7 | secret 由谁保管 | 明确保管人、轮换责任、撤销责任和泄露应急责任 | 未授权 |
| 8 | 是否允许发送一条测试消息 | 明确是否只允许一条测试消息，不允许批量或循环发送 | 默认不允许 |
| 9 | 测试消息内容是什么 | 明确低风险测试内容，不得包含医疗建议、价格承诺或客户隐私 | 未授权 |
| 10 | 发送前是否需要二次确认 | 明确发送前必须由谁完成二次确认 | 默认需要 |
| 11 | 日志记录哪些字段 | 明确只记录低敏字段，例如 proofId、tenantId、institutionId、channelType、dryRunStatus、operatorRole、occurredAt | 未授权 |
| 12 | 哪些字段必须脱敏 | 明确手机号、身份证、病历号、corpId、secret、token、encodingAESKey、external_userid、userid、聊天原文、HIS payload、webhook payload 必须脱敏或禁止记录 | 默认全部脱敏或禁止 |
| 13 | 谁负责 emergency stop | 明确一个主责任人和一个备份责任人 | 未授权 |
| 14 | 失败如何回滚 | 明确关闭真实发送开关、撤销测试 secret、停止任务、记录低敏审计和回退到 mock 的步骤 | 未授权 |
| 15 | proof 成功后是否进入 4F-D | 明确成功后是否允许另开 4F-D 任务，不得自动进入 | 默认不进入 |

## 7. 安全门禁

在用户完成逐项授权前，系统默认门禁必须保持：

- `allowRealSend=false`
- `externalChannelEnabled=false`
- `realSendAllowed=false`
- `noRealSend=true`
- `noRealNetwork=true`
- `noSecretRead=true`
- `noSecretOutput=true`

这些值的含义是：

- 不允许真实发送。
- 不允许外部真实通道启用。
- 不允许真实发送判定通过。
- 不允许真实网络调用。
- 不允许读取真实 secret。
- 不允许输出真实 secret。
- 只允许继续停留在文档、mock、dry-run 或本地低敏验证阶段。

任何后续任务如需改变上述默认值，必须另行获得用户明确授权，并且必须限制在单机构、单测试账号、单测试接收人、单条测试消息范围内。

## 8. 禁止边界

本任务以及未授权的 4F-C 阶段明确禁止：

- 真实企业微信 / 微信 / 短信 / HIS / webhook 接入。
- 配置 secret / token / API key。
- 读取或输出 `.env.local`。
- 读取 `process.env` 中真实 secret。
- 写真实 callback / webhook。
- 扫码托管 / 端口 / 机器编号 / uip。
- 真实发送消息。
- 真实出网测试。
- 同步真实客户 / 外部联系人 / 聊天记录。
- 接入会话内容存档。
- 真实自动回复 / 真实随访 / 真实群发 / 真实自动加好友。
- 新增 schema / migration / package / lock。
- 开始 4F-C 真实代码开发。
- 开始 4F-D。
- 顺手修无关 typecheck 技术债。

如果执行过程中出现以上任一倾向，必须停止并回报，不得继续。

## 9. 日志与脱敏边界

4F-C proof 如后续获得授权，日志只能记录低敏字段。建议允许字段包括：

- `proofId`
- `tenantId`
- `institutionId`
- `channelType`
- `officialRoute`
- `networkMode`
- `dryRunStatus`
- `proofStatus`
- `operatorRole`
- `manualConfirmed`
- `allowRealSend`
- `externalChannelEnabled`
- `realSendAllowed`
- `noSecretRead`
- `noSecretOutput`
- `occurredAt`
- `auditReason`
- `rollbackRequired`

必须脱敏或禁止记录的字段包括：

- 真实 `corpId`。
- 真实 secret。
- 真实 token。
- 真实 `encodingAESKey`。
- 真实 callback token。
- 真实 webhook secret。
- 真实 API key。
- 真实 `external_userid`。
- 真实 `userid`。
- 真实手机号原文。
- 身份证。
- 病历号。
- 客户姓名与联系方式组合。
- 聊天原文。
- HIS payload。
- webhook payload。
- 企业微信原始接口返回全文。
- 任何可还原真实客户身份、真实员工身份或真实企业微信凭证的字段。

PR body、issue、测试、文档和日志中都不得写入真实敏感值。

## 10. 发送内容安全边界

测试消息内容必须满足：

- 只用于测试链路，不包含营销承诺。
- 不包含客户真实姓名、手机号、身份证、病历号或治疗细节。
- 不包含诊断结论、医疗建议、术后异常处理建议或药品建议。
- 不包含价格承诺、优惠承诺、疗效承诺或对比贬损内容。
- 不包含 AI 自动生成且未经人工确认的客户可见建议。
- 不包含可被客户误解为正式随访、正式诊疗或正式售后的内容。

建议测试消息使用低敏占位内容，例如“这是一条智美天工受控测试消息，仅用于测试账号 proof，请忽略”。真实文本仍需由用户或负责人在后续授权任务中确认，且不得写入仓库。

## 11. emergency stop 与回滚责任

进入真实发送 proof 前，必须先指定：

- emergency stop 主责任人。
- emergency stop 备份责任人。
- secret 撤销责任人。
- 测试账号停用或解绑责任人。
- 日志审计责任人。
- 回滚验收责任人。

触发以下任一情况必须立即 emergency stop：

- 出现非测试接收人被触达风险。
- 出现真实客户隐私泄露风险。
- 出现未授权真实出网。
- 出现未授权真实发送。
- 出现 secret、token、callback 或 webhook 泄露风险。
- 出现日志记录真实敏感字段。
- 出现企业微信接口返回异常且无法低敏解释。
- 出现账号托管、扫码、端口、机器编号或 uip 混入官方路线。
- 出现真实自动回复、真实群发、真实自动加好友或会话内容存档越界。

回滚动作至少包括：

1. 关闭真实发送开关。
2. 关闭外部通道开关。
3. 停止后续 proof 调用。
4. 撤销或轮换测试 secret。
5. 删除或隔离不合规日志。
6. 记录低敏 audit。
7. 将页面和 API 状态回退到 mock / dry-run 口径。
8. 向负责人回报失败原因和剩余风险。

## 12. 进入 4F-D 的判断条件

proof 成功后也不能自动进入 4F-D。只有同时满足以下条件，才允许另开 4F-D 任务：

- 15 项授权确认均已由用户或负责人完成。
- proof 只发生在单机构、单测试账号、单测试接收人、单条消息范围内。
- 测试消息已完成发送前二次确认。
- 没有真实客户误触达。
- 没有真实敏感字段泄露。
- 没有未授权真实出网。
- 没有未授权真实发送。
- 没有 secret / token / API key 入库或输出。
- 日志只包含低敏字段。
- emergency stop 责任人和回滚责任人均已确认。
- proof 失败路径和回滚路径已经记录。
- 用户明确授权进入 4F-D。

如果任一条件不满足，必须停留在 4F-C 前置清单或 mock / dry-run 阶段。

## 13. 后续任务拆分建议

后续如用户逐项授权，可拆成独立任务：

1. 4F-C-1：受控测试环境 secret 管理方案，不写入仓库。
2. 4F-C-2：单机构测试账号 proof 执行脚本或手工步骤设计，默认不发送。
3. 4F-C-3：发送前二次确认和 emergency stop 演练。
4. 4F-C-4：单条测试消息 proof，必须另行授权。
5. 4F-C-5：proof 结果复盘与是否进入 4F-D 判断。

以上任务均不得从本文自动启动。

## 14. 文档自查

本文没有授权 Codex、Claude 或任何 agent：

- 直接接真实企业微信。
- 配置 secret / token / API key。
- 读取 secret。
- 读取或输出 `.env.local`。
- 读取 `process.env` 中真实 secret。
- 写真实 callback / webhook。
- 真实出网。
- 真实发送。
- 同步真实客户、外部联系人或聊天记录。
- 接入会话内容存档。
- 开始 4F-C 真实代码开发。
- 开始 4F-D。

本文只允许后续以用户逐项授权为前提，另开任务评估是否进入受控真实 proof。

## 15. 明确结论

当前仍不能进入真实发送 proof。

进入真实发送 proof 的最低条件是：用户或负责人对 15 项确认清单逐项明确授权，并且另开任务限定单机构、单测试账号、单测试接收人、单条测试消息、发送前二次确认、低敏日志、emergency stop 和回滚责任。

在此之前，系统必须继续保持：

- `allowRealSend=false`
- `externalChannelEnabled=false`
- `realSendAllowed=false`
- `noRealSend=true`
- `noRealNetwork=true`
- `noSecretRead=true`
- `noSecretOutput=true`

不得因为已有 4F-A / 4F-B dry-run 成果，就推定可以真实出网或真实发送。
