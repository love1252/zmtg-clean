# Phase 23 HIS 真实 adapter 测试连接边界规划

## 范围声明

本轮只规划 Phase23-TC-11：真实 HIS adapter 测试连接 Plan Mode。本文档承接 TC-08 fake provider route runtime、TC-09 测试连接 audit runtime 和 TC-10 真实 credential provider 读取边界规划，为后续真实 adapter interface runtime 或更小的后续规划提供安全边界。

本轮不实现真实 HIS adapter runtime，不实现 credential provider runtime，不读取真实凭证，不解析真实 `credentialRef`，不接 secret manager / KMS / Vault，不新增 route、service、provider、adapter、runner / scheduler、schema 或 migration，不修改 `src/**`、`drizzle/**`、package 或 lockfile，不发起任何外部 HIS 网络请求。

## 开始前只读盘点结论

- 当前 `main` 已同步 `origin/main`，两者均位于 `7a3a3abcb2ca9de3a5539bb5bdb8fba781859961`。
- 建分支前 working tree 为 clean。
- TC-10 已明确真实 credential provider 只属于服务端内部凭证读取边界，凭证引用原文、secret manager / KMS / Vault 具体后端路径和真实凭证材料全部后置。
- 当前测试连接 route 只接受 path `connectionId` 和空 JSON body，不接受 endpoint override、vendor scenario、provider result、凭证字段、健康状态字段或客户端写回字段。
- 当前测试连接 service 由服务端 access context 绑定 tenant，读取连接快照后调用 fake provider，再由 service 写 audit、写健康摘要和生成安全 DTO。
- 当前 fake provider 输入只包含服务端构造的 `tenantId / connectionId / sourceSystem / vendorType / systemType / credentialConfigured / mode=manual`，不读取真实凭证，不访问网络。
- 当前 TC-09 audit runtime 已记录 `test_connection_requested`、provider result 对应稳定 reason、`test_connection_completed` 和 repository 写回失败 reason，不保存 metadata、请求体、凭证、endpoint、raw HIS payload、SQL 或 stack。
- 现有 HIS connection read model 可供未来 adapter 识别的安全字段为 `sourceSystem`、`vendorType`、`systemType`、`credentialConfigured`、`healthStatus`、`lastCheckedAt` 和 `lastErrorCode`。
- 现有健康状态写回方法为 `writeHisConnectionHealthSummaryForTenant`，只接受内部稳定健康状态和错误码。
- 现有稳定错误码已覆盖 `provider_timeout`、`external_unreachable`、`external_auth_failed`、`external_rate_limited`、`external_service_unavailable`、`unsupported_vendor`、`unsafe_external_response`、`credential_unavailable`、`credential_revoked` 和 `service_unavailable` 等后续可复用项。
- 早期真实 HIS adapter 前置评估文档已明确 adapter 不能直接进入实现，必须先控制租户绑定、凭证安全、raw payload、审计和人工复核边界。
- 当天 devlog 文件已存在。

## 真实 HIS adapter 定位

真实 HIS adapter 是未来连接具体 HIS 厂商系统的服务端内部适配层，用于执行受控测试连接探测，并把外部结果归一化为安全 provider result。

它不是：

1. route。
2. DTO。
3. 前端配置。
4. fake provider。
5. credential provider。
6. secret manager / KMS / Vault。
7. audit writer。
8. repository。
9. runner / scheduler。
10. Webhook / 同步任务。
11. HIS 数据同步任务。
12. 患者 / 预约 / 病历数据拉取能力。

adapter 只负责一次受控探测的外部交互和结果收口，不负责权限、凭证读取、健康状态持久化、审计持久化、DTO 生成、调度或业务数据同步。

## 调用链边界

建议未来真实测试连接调用链保持如下方向：

```text
route
  -> permission / parser
  -> test connection service
  -> repository read connection snapshot
  -> credential provider read by server-side credential handle
  -> real HIS adapter testConnection
  -> adapter result normalization
  -> repository health write
  -> audit
  -> DTO
```

边界要求：

- route 不直接调用真实 HIS adapter。
- route 不直接读取凭证。
- route 不接受 endpoint override。
- route 不接受 vendor scenario。
- fake provider 与 real adapter 必须是可替换的服务端 provider 边界。
- adapter 不写 repository。
- adapter 不写 audit。
- adapter 不生成 DTO。
- adapter 只返回安全、可归一化的 provider result。
- adapter 不保存 raw HIS payload。

service 是真实测试连接的唯一编排层。它负责读取连接快照、读取服务端内部凭证材料、选择 adapter、处理 adapter 结果、写健康摘要、写 audit 和生成 DTO。

## 输入边界

真实 HIS adapter 输入只能由 service 构造，不能来自 HTTP body、query、header、cookie、localStorage、sessionStorage、前端表单或客户端可控字段。

建议输入语义如下：

```ts
type HisAdapterTestConnectionInput = {
  tenantId: string;
  connectionId: string;
  vendorType: string;
  systemType: string;
  sourceSystem: string;
  credential: RedactedHisCredentialMaterial;
  purpose: 'test_connection';
  timeoutMs: number;
  requestId?: string;
};
```

字段来源要求：

- `tenantId` 只能来自服务端 access context。
- `connectionId` 只能来自 route path，经 service 传入。
- `vendorType / systemType / sourceSystem` 只能来自数据库连接快照。
- `credential` 只能来自 TC-10 规划的 credential provider。
- `purpose` 由 service 固定为 `test_connection`。
- `timeoutMs` 只能来自服务端配置白名单。
- `requestId` 只用于内部追踪，不进入外部请求体或 audit。
- 不接受前端传入 endpoint。
- 不接受前端传入 credentialRef。
- 不接受前端传入凭证明文。
- 不接受 query / header / body 中的 adapter 参数。
- 不接受前端传入 `healthStatus / checkedAt / lastErrorCode`。

## 输出边界

真实 HIS adapter 输出必须是安全归一化结果。

建议输出语义如下：

```ts
type HisAdapterTestConnectionResult =
  | {
      ok: true;
      providerCode: 'his_adapter_success';
      healthStatus: 'healthy';
      checkedAt: Date;
      durationMs: number;
    }
  | {
      ok: false;
      providerCode:
        | 'his_adapter_auth_failed'
        | 'his_adapter_timeout'
        | 'his_adapter_unreachable'
        | 'his_adapter_rate_limited'
        | 'his_adapter_service_unavailable'
        | 'his_adapter_unsupported_vendor'
        | 'his_adapter_unsafe_response'
        | 'his_adapter_validation_failed';
      healthStatus: 'failed' | 'degraded';
      errorCode: string;
      checkedAt: Date;
      durationMs: number;
    };
```

输出约束：

- 不返回 raw HIS response body。
- 不返回 external request body。
- 不返回 external headers。
- 不返回 endpoint 原文。
- 不返回 credential。
- 不返回 credentialRef。
- 不返回 secret path。
- 不返回 SQL / stack / `DATABASE_URL`。
- 不返回患者、预约、病历、处方、收费或门店业务数据。
- 不返回 HIS 厂商认证响应原文。
- adapter result 只能由 service 转为健康状态写回、audit reason 和安全 DTO。

`durationMs` 只能表达耗时区间，不得用于泄露外部请求细节。`providerCode` 只能是内部稳定枚举，不能拼接厂商错误原文。

## 厂商 adapter 边界

厂商差异必须收口在服务端 allowlist 与统一 interface 中。

建议首期边界：

- 首期先定义统一 interface，不直接写多个厂商 runtime。
- adapter 通过 `vendorType / systemType` 做服务端 allowlist 选择。
- 未支持厂商返回 `unsupported_vendor`。
- 不允许前端指定 adapter class。
- 不允许 body / query / header 覆盖 vendor。
- 厂商返回的状态必须映射为内部稳定 code。
- 厂商原始错误不得进入 DTO、audit 或 health summary。
- 如果厂商需要特殊认证参数，必须通过 credential provider 输出的受控 credential material 提供，不允许从连接配置明文字段拼接。

未来如需单厂商 runtime，应先选择一个明确厂商和测试环境，并另开 PR 固定输入输出、出站策略、错误码、超时和脱敏测试。

## 出站网络边界

本轮只规划，不实现出站网络。未来 runtime 必须满足：

- 必须设置固定超时。
- 不允许无限重试。
- 不允许跟随不可信重定向。
- 不允许访问内网危险地址，需考虑 SSRF 防护。
- 不允许记录完整 URL、query、header、body。
- 需要明确 allowlist / denylist 策略。
- 需要明确 TLS / certificate 错误如何映射。
- 需要明确 rate limit / throttling 如何映射。
- 需要明确 network timeout 如何映射。
- 需要明确 external service unavailable 如何映射。
- 本轮不新增任何 fetch / axios / HTTP client 代码。

建议后续出站策略至少包含：

- host / scheme / port allowlist。
- 私有网段、link-local、metadata service、localhost 和 loopback denylist。
- DNS rebind 防护。
- redirect 禁止或严格同源限制。
- 响应体大小上限。
- 请求方法白名单。
- TLS 错误统一映射为 `external_unreachable` 或 `external_service_unavailable`，不得透传证书错误原文。

## 错误码映射边界

建议内部稳定错误码只使用可用于 health write、DTO 和 audit 的安全 code：

```text
credential_unavailable
credential_revoked
external_auth_failed
provider_timeout
external_unreachable
external_rate_limited
external_service_unavailable
unsupported_vendor
unsafe_external_response
service_unavailable
validation_failed
```

映射口径：

| adapter 分类 | health write 错误码 | audit reason 建议 | DTO code |
| --- | --- | --- | --- |
| 凭证不可读 | `credential_unavailable` | `test_connection_missing_credential` 或后续专用 reason | `credential_unavailable` |
| 凭证已撤销 | `credential_revoked` | `test_connection_missing_credential` 或后续专用 reason | `credential_revoked` |
| 外部认证失败 | `external_auth_failed` | 后续可新增白名单 reason | `external_auth_failed` |
| 探测超时 | `provider_timeout` | `test_connection_provider_timeout` | `provider_timeout` |
| 外部不可达 | `external_unreachable` | `test_connection_external_unreachable` | `external_unreachable` |
| 外部限流 | `external_rate_limited` | 后续可新增白名单 reason | `external_rate_limited` |
| 外部服务不可用 | `external_service_unavailable` | 后续可新增白名单 reason | `external_service_unavailable` |
| 未支持厂商 | `unsupported_vendor` | `test_connection_unsupported_vendor` | `unsupported_vendor` |
| 响应不安全 | `unsafe_external_response` | `provider_health_failed` 或后续专用 reason | `unsafe_external_response` |
| 内部依赖不可用 | `service_unavailable` | `provider_health_failed` 或 `repository_after_provider_failed` | `service_unavailable` |
| 输入不合法 | `validation_failed` | `provider_validation_failed` | `validation_failed` |

要求：

- 错误码用于 health write、DTO 和 audit。
- 不保存 provider raw error。
- 不返回 HIS 原始认证失败响应体。
- 不返回 endpoint。
- 不返回 credentialRef。
- 不返回 secret path。
- 不返回 SDK exception。
- 不返回 SQL、stack 或 `DATABASE_URL`。
- 所有未知异常默认映射为 `service_unavailable` 或 `unsafe_external_response`，不得透传。

## health write 边界

adapter 不直接写健康状态。adapter result 必须由 service 归一化后调用 `writeHisConnectionHealthSummaryForTenant`。

写回口径：

- `healthy`：测试成功，`lastErrorCode = null`。
- `failed`：明确失败，写内部稳定错误码。
- `degraded`：只用于受控非致命异常或有限健康探测。
- `unknown`：仍由 service 在凭证清空、revoke 或 reset 场景中使用，不由 adapter 随意返回。
- repository 写回失败时不能声称测试成功。
- `expectedUpdatedAt` optimistic lock 仍后置；若真实 adapter runtime 需要，应另开任务。

service 需要保留当前 TC-08 / TC-09 的安全收口：provider 或 adapter 已执行但 repository 写回失败时，返回稳定 `service_unavailable`，并写安全 audit reason，不把 adapter 成功结果直接返回为连接正常。

## audit 边界

TC-09 已完成测试连接 audit runtime。real adapter provider result 后续可以映射到现有 audit reason 或新增稳定 reason。

audit 允许记录：

- 测试连接发起。
- adapter result 已归一化。
- 健康状态写回成功或失败。
- 稳定 reason。
- tenant、connection、actor、action、result 和时间。

audit 禁止记录：

- raw HIS payload。
- credential。
- endpoint / headers。
- provider raw error。
- external response body。
- patient / appointment / medical record data。

如需要新增 real adapter 专用 reason，必须进入 whitelist 并补测试。本轮不修改 audit runtime。

## DTO 边界

DTO 仍沿用 TC-05 / TC-08 安全字段：

```ts
{
  ok: boolean;
  code?: string;
  error?: string;
  healthStatus?: 'healthy' | 'degraded' | 'failed' | 'unknown';
  checkedAt?: string;
}
```

DTO 禁止返回：

- adapter name / class。
- credentialRef。
- credential。
- secret path。
- endpoint。
- headers。
- request body。
- raw response body。
- provider raw error。
- external status text。
- SQL / stack / `DATABASE_URL`。
- 完整连接详情。
- 患者 / 预约 / 病历 / 处方 / 收费等业务数据。

DTO 的 `error` 只能是通用中文提示，不得包含厂商错误原文、外部状态文本、URL、path、header、凭证信息或调用栈。

## 安全 denylist

以下内容禁止出现在任何 DTO、audit、日志、错误、devlog、README、测试快照中：

- credentialRef 原值
- secret path
- token
- api key
- password
- authorization header
- basic auth
- oauth token
- private key
- client_secret
- connection string
- DATABASE_URL
- KMS key id
- Vault path
- secret manager path
- HIS 账号
- HIS 密码
- HIS 厂商认证响应体
- HIS 原始响应体
- HIS 请求体
- endpoint 原文
- external headers
- raw credential
- raw HIS payload
- patient data
- appointment data
- medical record data
- prescription data
- billing data
- SQL
- stack

## 后续 PR 拆分建议

建议在 TC-11 后继续拆小步，不要直接实现真实 HIS adapter runtime，除非用户明确批准并另开任务。

1. 可选：真实 credential provider interface runtime。
2. 可选：server-only credential handle resolver runtime。
3. 可选：secret manager / KMS / Vault adapter Plan Mode。
4. 可选：真实 HIS adapter interface runtime。
5. 可选：单厂商 adapter 最小 runtime。
6. 可选：真实 adapter 测试连接 route / service 切换 Plan Mode。
7. Phase23-TC-12：周期健康检查 runner / scheduler Plan Mode。

## 规划验收口径

- 文档明确真实 HIS adapter 的服务端内部定位。
- 文档明确 route 不直接调用 adapter，不读取凭证，不接受 endpoint override 或 vendor scenario。
- 文档明确 adapter 输入只由 service 构造，凭证只来自 TC-10 规划的 credential provider。
- 文档明确 adapter 输出只返回安全归一化 result，不返回 raw HIS response、endpoint、credential、credentialRef、secret path、SQL 或 stack。
- 文档明确厂商差异通过服务端 allowlist 和统一 interface 收口。
- 文档明确出站网络必须有超时、SSRF 防护、重定向约束、allowlist / denylist 和错误映射，本轮不新增 HTTP client 代码。
- 文档明确错误码用于 health write、DTO 和 audit，未知异常不得透传。
- 文档明确 adapter 不写 repository、不写 audit、不生成 DTO。
- 文档明确 health write、audit、DTO 和 denylist 边界。
- 文档明确后续 PR 拆分，并建议下一步进入 Phase23-TC-12。
