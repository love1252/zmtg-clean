# WeCom production secret runbook

## 1. 范围与硬边界

本 runbook 只定义 production secret 的申请、注入、轮换、撤销和泄漏响应，不授权真实网络或真实客户发送。05B 前不得开启真实客户发送；`ZMTG_WECOM_REAL_NETWORK_ENABLED` 与 `ZMTG_WECOM_REAL_SEND_ENABLED` 必须保持关闭。

本文件只列变量名称，不记录任何变量值：

- `DATABASE_URL`
- `ZMTG_SECRET_ENCRYPTION_KEY`
- `ZMTG_WECOM_CORP_ID`
- `ZMTG_WECOM_AGENT_ID`
- `ZMTG_WECOM_AGENT_SECRET`
- `ZMTG_WECOM_CUSTOMER_CONTACT_SECRET`
- `ZMTG_WECOM_REAL_NETWORK_ENABLED`
- `ZMTG_WECOM_REAL_SEND_ENABLED`

## 2. owner、approver 与最小权限

- 每项 secret 必须有业务 owner、security owner 和独立 approver；
- 申请必须绑定 change ticket、环境、工作负载、用途和到期时间；
- secret manager 的读取权限只授予目标 production workload；
- operator 只获得限时、可审计权限，禁止共享个人凭证；
- 数据库、WeCom 应用和客户联系能力分别授权，不以一个凭证覆盖全部能力；
- 非生产身份不得读取 production secret，production 身份不得用于本地调试。

## 3. secret manager 注入

1. owner 在批准的 secret manager 中创建或引用 secret；
2. approver 核对来源、用途、权限范围、环境和有效期；
3. 平台将 secret 绑定到 production workload 的运行时身份；
4. 部署系统在运行时注入，不写入仓库、镜像、构建产物或 `.env.local`；
5. 仅执行 masked existence check，确认变量存在和加载状态，不回显值、长度、前后缀或 hash；
6. 验证真实网络和真实发送开关仍关闭；
7. 在 change ticket 中只记录检查结果、版本和负责人。

禁止通过命令行参数、聊天、邮件、PR、截图、CI artifact 或普通日志传递 secret。

## 4. masked existence check

检查工具只允许输出每个变量的 `present` / `missing` 状态。不得输出原文、部分值、字符数、编码结果、指纹或可关联值。任一必需变量缺失时 fail-closed；存在检查通过也不表示凭证有效，更不表示允许真实调用。

日志平台必须配置对上述变量名及常见认证 header 的脱敏规则。应用错误不得拼接配置对象、连接串、请求 header 或 provider 响应中的敏感字段。

## 5. rotation

- 按 secret manager 策略和供应方能力制定固定轮换周期；
- owner 在轮换前创建 change ticket，approver 复核影响与回退方案；
- 优先采用可重叠的双版本切换，先注入新版本，再撤销旧版本；
- 每次轮换只做 masked existence/加载检查，真实发送继续关闭；
- encryption key 轮换必须有独立的数据重加密设计和恢复演练，不得直接替换后假定旧数据可读；
- 轮换完成后核对旧版本已失效、权限无扩张、审计记录完整。

## 6. revoke 与 emergency stop

正常撤销：

1. 停止引用该 secret 的 workload 或切换到已批准的新版本；
2. 在供应方/数据库侧撤销凭证；
3. 从 secret manager 和 workload binding 移除旧引用；
4. 检查审计日志和残留权限；
5. 记录脱敏结果。

emergency stop 的优先顺序：

1. 关闭 `ZMTG_WECOM_REAL_SEND_ENABLED`；
2. 关闭 `ZMTG_WECOM_REAL_NETWORK_ENABLED`；
3. 停止相关 worker/workload；
4. 撤销 WeCom token/secret 与数据库临时权限；
5. 通知 security owner、业务 owner 和 incident commander；
6. 保全脱敏审计证据。

开关关闭不能替代供应方侧 revoke。

## 7. 泄漏处理

发现疑似泄漏时不得在工单或聊天中复制泄漏值。立即：

- 按 emergency stop 关闭网络和发送能力；
- 撤销并轮换受影响凭证；
- 对日志、artifact、提交历史、终端记录和访问审计做受控排查；
- 评估数据库、WeCom 和客户数据影响范围；
- 按 incident 流程通知、定级和保全证据；
- 删除或限制含敏感内容的 artifact，但保留合规要求的受控证据；
- 修复根因并经 approver 复核后才能恢复非发送能力。

任何恢复都不得顺带打开真实客户发送。真实发送必须由 05B 及后续独立门禁和授权控制。
