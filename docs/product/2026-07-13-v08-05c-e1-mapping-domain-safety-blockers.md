# V0.8 05C-E1 客户匹配 mock domain 安全阻塞收口

- 日期：2026-07-13
- 任务编号：`ZMTG-05C-E1-MAPPING-DOMAIN-SAFETY-BLOCKERS-DOC-20260713`
- 文档性质：安全阻塞收口，docs-only，不代表任何运行时能力已经实现或获准继续开发

## 1. 当前结论

05C-E1 客户匹配 mock domain 的代码 WIP 暂停推进。当前不提交该代码 WIP，不创建代码 PR，也不进入 05C-E2。

当前 `main` 不受该 WIP 影响。现有 WIP 保留在原分支，仅供后续外部修复、重新设计和复盘参考；在恢复前置条件全部满足前，不应直接用于 PR。

## 2. 已发现阻塞项

以下问题来自 05C-E1 多轮零信任复核记录。部分问题在 WIP 中曾被尝试修补，但整体安全边界和验证证据仍未达到可提交标准：

1. 授权与 provider 的 fail-closed 曾不完整，授权关闭、撤销、过期或外部能力禁用后仍可能确认匹配。
2. 状态机曾允许 `conflict → clear_candidate → unmatched → approve → matched`，从而绕过未处理冲突。
3. 禁止内容可能藏在允许字段值中，并进入人工复核结果或其他输出。
4. 被阻断路径未能稳定生成只含固定低敏字段的 audit event。
5. candidate 的 `reasonCode` 与 `status` 曾出现语义不一致。
6. 未验证的 root `tenantId` 可能在 fail-closed audit 中回显敏感原文。
7. `occurredAt` 曾可借助非规范但可解析的字符串进入 audit `timestamp`。
8. `tenantId` 与 `occurredAt` 的正则校验曾存在尾随换行绕过风险。
9. review 路径仍缺少 root `tenantId` + LF + 敏感内容的完整测试矩阵，尤其缺少手机号场景；因此当前无法证明 generation 与 review 两条路径的 audit 均不会回显原始值。

## 3. 风险判断

上述问题涉及审计泄露、状态机绕过、敏感字段回显和测试矩阵不足，不适合继续以局部补丁方式推进。

客户匹配与人工复核会直接影响客户关系判断。即使当前阶段只处理 mock/demo 数据，其状态机、输入白名单、审计输出和 fail-closed 规则也必须采用高于普通 mock domain 的安全标准，并由完整的双路径测试矩阵证明。

## 4. 暂停边界

暂停期间必须遵守以下边界：

- 不提交当前 05C-E1 代码 WIP。
- 不创建 05C-E1 代码 PR。
- 不继续 05C-E2。
- 不接入 API 或 UI。
- 不连接数据库。
- 不调用企业微信。
- 不真实同步外部联系人。
- 不自动合并客户。
- 不写入真实客户关系。
- 不读取会话内容，不接入会话内容存档。

## 5. 后续恢复前置条件

恢复 05C-E1 代码开发前，必须先完成并审查以下事项：

1. 明确 strict parser 与字段 whitelist 策略，所有输入默认不可信。
2. 明确状态机合法转换表、冲突锁定规则和每个动作的前置条件。
3. 明确所有 fail-closed audit event 允许输出的固定低敏字段及安全占位值。
4. 明确 `tenantId`、`occurredAt`、digest、`reasonCode`、`status` 的完整匹配、枚举约束和一致性规则。
5. 建立最小完整测试矩阵，至少覆盖：
   - root `tenantId` + LF / CRLF / U+2028 / U+2029；
   - root `tenantId` + 换行 + phone / secret / externalUserId；
   - generation 与 review 两条路径；
   - audit 整体字符串扫描；
   - conflict clear / reopen 防绕过；
   - provider / authorization fail-closed；
   - 不自动合并客户；
   - 不写真实客户关系。

只有上述设计、实现和验证证据全部闭环后，才能重新评估是否创建代码 PR。

## 6. 推荐后续动作

- 下一步不要继续在原 WIP 上补洞。
- 先执行 05C-E1-REPLAN docs-only，或由 Claude 重新设计 strict parser、状态机、审计契约和测试矩阵。
- 重新设计并完成独立审查后，再从最新 `main` 新建干净代码分支。
- 旧 WIP 仅作为问题复盘和设计参考，不直接提交、不直接创建 PR。

本文档只记录暂停决定、风险边界和恢复条件，不构成 05C-E1 或 05C-E2 的开发授权。
