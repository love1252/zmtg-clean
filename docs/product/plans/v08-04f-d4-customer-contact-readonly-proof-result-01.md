# V0.8-04F-D4 企业微信客户联系单员工单外部联系人真实只读 proof 结果归档

日期 / 时区：2026-07-10 CST +0800

任务编号：`V0.8-04F-D4-CUSTOMER-CONTACT-READONLY-PROOF-RESULT-01`

归档基线：`main / origin/main = a331edbe6e624f7c4bfa093e378fcfd1fa226345`，已包含 PR #500。

## 1. 任务背景

4F-D3 用于验证企业微信官方客户联系接口的最小真实只读链路。验证范围严格限定为单机构、单个测试员工和恰好一个受控测试外部联系人，并且只执行一次人工确认的真实只读 proof。

本次 proof 不发送消息，不做批量同步，不遍历其他员工或其他联系人，不写数据库或正式客户档案。本文只归档已经完成的低敏结果，不再次执行 proof，不读取凭证，不调用真实企业微信，也不授权开始 4F-E。

## 2. 前置条件

proof 执行前已确认：

- PR #500 的企业微信客户联系单对象只读 proof runtime 已合并。
- 客户联系可调用应用已完成受控配置。
- 测试应用具备客户联系读取所需的最小权限。
- 测试员工位于应用可见范围和客户联系范围内。
- 测试员工名下恰好一个受控测试外部联系人。
- `CorpID`、应用 Secret 和测试员工配置完整。
- 企业可信 IP 有效。
- 真实网络和客户读取仅在本次人工 proof 时短暂、显式开启。
- 真实发送始终关闭。

上述配置的真实值不进入本文，不进入仓库，也不进入 PR 描述。

## 3. 实际执行链路

本次 proof 按以下受控顺序执行：

```txt
gettoken
-> 单测试员工 externalcontact/list
-> 确认列表恰好一个 external_userid
-> 单次 externalcontact/get
-> 字段白名单过滤
-> 返回低敏 proof 结果
```

执行边界如下：

- `external_userid` 仅在运行时函数内部短生命周期使用。
- `external_userid` 未返回、未记录、未落盘。
- 未遍历其他员工或其他联系人。
- 未分页继续读取。
- 未自动重试。
- 未启动定时任务、后台轮询、worker 或 queue。
- 未写入数据库、正式客户表或客户档案。

## 4. 最终结果

最终返回以下低敏状态：

```txt
readonlyProofStatus = readonly_proof_completed
reason = readonly_proof_completed
singleReadExecuted = true
fieldWhitelistApplied = true
proofAuthorized = false
realSendEnabled = false
```

结论：4F-D3 单机构、单个测试员工、单个受控测试外部联系人和单次真实只读 proof 已完成并通过。

`proofAuthorized = false` 是正确结果。本次成功只证明受控的单对象只读链路可用，不构成持续读取、批量同步、生产使用或后续触达授权。

## 5. 已验证能力

本次 proof 已验证：

- 企业微信客户联系 access token 链路可用。
- 单员工外部联系人列表接口可用。
- 单对象外部联系人详情接口可用。
- 测试员工配置与客户联系读取权限有效。
- 企业可信 IP 有效。
- 列表恰好一个对象时，系统只读取该单对象。
- 详情对象与测试员工关系校验有效。
- 低敏字段白名单生效。
- 敏感标识和企业微信原始响应未进入最终响应。
- 未执行任何消息发送。

以上结论仅适用于本次单机构、单员工、单对象、单次人工 proof，不外推到多员工、多联系人、持续同步、消息触达或生产稳定性。

## 6. 最终允许的低敏字段

最终 proof 结果只允许包含以下字段名称：

- `proofContactId`
- `proofEmployeeId`
- `customerType`
- `addedAt`
- `relationshipStatus`
- `deletionStatus`
- `mode`
- `fieldWhitelistApplied`
- `singleReadExecuted`
- `proofAuthorized`

允许记录的固定内部 proof 值只有：

- `live-contact-proof-01`
- `live-employee-proof-01`
- `real_readonly_proof`

本文不记录 `addedAt` 等字段的真实业务值，不通过多个低敏字段组合反推员工、联系人或机构身份。

## 7. 未返回、未记录、未落盘

本次 proof 的最终响应和本文均未返回、记录或落盘以下内容：

- 客户姓名、昵称、头像、性别。
- 手机号、微信号、地址。
- 备注、描述、标签。
- 企业微信员工 `UserID` 原文。
- `external_userid` 原文。
- `unionid` / `openid`。
- `CorpID`。
- Secret。
- token / access token。
- `errmsg`。
- 企业微信原始响应。
- URL / query string。
- 聊天内容。
- 医疗和治疗信息。
- `.env.local` 内容。

本文不嵌入包含敏感配置、员工信息或联系人信息的截图。

## 8. 未执行范围

本次 proof 和本归档任务均未执行：

- 客户消息发送。
- 自动回复。
- 自动随访。
- 群发。
- 多员工或多客户同步。
- 数据库或正式客户档案写入。
- timeline、audit 或 dashboard 写入。
- 聊天记录读取或同步。
- 会话内容存档接入。
- 生产持续同步、并发能力或稳定性验证。
- 4F-E。

本归档任务也不处理 `/api/institution/entitlement-usage` `503`，相关问题如需修复必须另开任务。

## 9. 安全收口

proof 完成后已执行以下收口：

- 真实网络开关恢复关闭。
- 客户联系读取开关恢复关闭。
- 真实发送开关保持关闭。
- 没有保留自动重试、后台轮询或持续同步入口。
- 没有把临时标识、凭证或原始响应写入普通日志或业务数据。

本文是结果归档，不提供再次执行 proof 的操作指南，不引导重新开启真实网络、客户读取或任何发送能力。

本次成功不构成持续读取、批量同步、生产授权或客户触达授权。`proofAuthorized = false` 必须继续保持。

## 10. 后续边界

- 4F-D4 只做本次 proof 结果归档。
- 不因本次成功自动进入客户档案正式映射。
- 不因本次成功自动进入客户真实触达。
- 不自动进入 4F-E。
- 不扩大到多机构、多员工、多联系人或持续同步。
- 后续任务必须由用户重新明确授权、范围、安全门禁、责任人和验收标准。

## 11. 归档结论

- 4F-D3 单机构、单测试员工、单受控外部联系人、单次真实只读 proof 已完成并通过。
- 最终状态为 `readonly_proof_completed`。
- `singleReadExecuted = true`，且 `fieldWhitelistApplied = true`。
- `proofAuthorized = false`，真实发送始终关闭。
- 敏感配置、员工标识、联系人标识和原始响应均未进入归档内容。
- 当前真实网络和客户联系读取已恢复关闭。
- 当前未开始 4F-E，任何后续推进必须另行明确授权。
