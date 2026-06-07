# Phase 23 HIS 真实 credential provider 读取边界规划

## 范围声明

本轮只规划 Phase23-TC-10：真实 credential provider 读取边界。本文档用于承接已经完成的测试连接权限、route、DTO、健康状态写回、fake provider 与 audit runtime，并为后续真实 HIS adapter 测试连接提供凭证读取前置边界。

本轮不实现 runtime，不读取真实凭证，不接 secret manager / KMS / Vault，不接真实 HIS adapter，不新增 schema / migration，不修改 `src/**`、`drizzle/**`、package 或 lockfile。

## 开始前只读盘点结论

- 当前测试连接 route 已固定为 `POST /api/institution/his-connections/[connectionId]/test-connection`，只接受 path `connectionId` 和空 JSON body。
- 当前测试连接 route 的权限 action 已固定为 `open_connection:test_connection`。
- 当前测试连接 service 只从服务端上下文绑定 tenant，并从连接 read model 读取 `credentialConfigured` 等非敏感字段。
- 当前 fake provider 只接收服务端构造的 `tenantId / connectionId / sourceSystem / vendorType / systemType / credentialConfigured / mode=manual`，不读取真实凭证。
- 当前 repository read model 不暴露凭证引用原文，只暴露 `credentialConfigured` 和健康摘要字段。
- 当前 credential storage 仍是 test-only placeholder provider，声明不接受真实凭证材料、不保存明文凭证、不支持真实测试连接。
- 当前 audit runtime 已建立测试连接事件、reason 和 query whitelist，并明确禁止记录凭证、endpoint、provider 原始错误、HIS 原始响应、SQL 与 stack。
- 当前字段足以支撑“是否配置凭证”的测试连接前置判断；真实凭证读取需要独立的 provider interface runtime，不应扩展 route body 或公开 DTO。

## 真实 credential provider 定位

真实 credential provider 应是仅在服务端内部使用的凭证读取边界，职责是把服务端内部解析出的凭证引用转换为最小可用、已脱敏约束的连接材料。

它不属于 route、DTO、audit domain、repository read model、UI 或 fake provider。它也不负责真实 HIS 业务探测、健康状态写回、周期调度或 compensation / recovery。

建议后续将 provider 放在 institution server 层的独立模块中，并让真实 HIS adapter 通过 service 编排调用。route 仍只调用 test-connection service，不能直接调用 credential provider。

## 未来调用链边界

建议后续真实测试连接调用链保持如下方向：

```text
route
-> test-connection service
-> repository 读取连接非敏感配置
-> 服务端内部凭证引用解析器
-> credential provider 读取最小凭证材料
-> real HIS adapter 执行测试连接
-> repository 写回健康摘要
-> audit 写入脱敏事件
```

边界要求：

- route 不接收凭证字段、endpoint 覆盖、provider 选项、scenario 或测试模式。
- test-connection service 不把凭证引用原文写入日志、错误、DTO、audit 或健康摘要。
- repository 公开 read model 不新增凭证引用原文字段。
- provider 只返回真实 HIS adapter 必需的最小认证材料。
- real HIS adapter 只能接收脱敏约束后的材料，不接收 audit payload 或前端 body。

## 输入边界

真实 credential provider 的输入只能来自服务端可信来源，不能来自 HTTP body、query、header、cookie、localStorage、sessionStorage、前端表单或客户端可控字段。

建议输入语义如下：

```ts
type HisCredentialProviderReadInput = {
  tenantId: string;
  connectionId: string;
  credentialHandle: ServerOnlyCredentialHandle;
  purpose: "test_connection";
  requestedBy: {
    actorUserId: string;
    actorOrgId: string;
  };
  requestedAt: Date;
};
```

输入约束：

- `tenantId` 必须来自服务端 access context。
- `connectionId` 必须来自 route path 并经过既有 parser。
- `credentialHandle` 必须由服务端内部解析得到，不能来自外部请求。
- `purpose` 首期只允许 `test_connection`。
- `requestedBy` 只用于服务端鉴权、审计关联或 provider 访问控制，不得被下游 adapter 当作 HIS 凭证。
- `requestedAt` 必须由服务端生成。

## 输出边界

真实 credential provider 的输出必须区分“可给 adapter 使用的短生命周期材料”和“可给 service / audit / DTO 使用的脱敏状态”。

建议输出语义如下：

```ts
type CredentialProviderResult =
  | {
      ok: true;
      material: RedactedHisCredentialMaterial;
      expiresAt: Date | null;
      providerName: string;
    }
  | {
      ok: false;
      code:
        | "missing_credential"
        | "credential_provider_unavailable"
        | "credential_unavailable"
        | "credential_revoked"
        | "provider_timeout";
    };
```

输出约束：

- `material` 只能在同一服务端调用链内传给真实 HIS adapter。
- `material` 不得进入 route DTO、audit payload、健康状态字段、日志或测试断言快照。
- provider 失败只返回稳定错误码，不返回 provider 原始错误、外部响应体、路径、账号、密钥或堆栈。
- provider 成功也不能返回可公开展示的凭证标识；如需观测只能使用不可逆摘要或 provider 名称。
- `expiresAt` 只用于 service 判断材料有效期，不得作为凭证来源暴露。

## credentialRef 边界

credentialRef 仍应是服务端内部引用，不能成为测试连接 route 的输入或输出。

边界要求：

- 不在 route body、query、header 或 DTO 中出现凭证引用原文。
- 不在 repository 公开 read model 中返回凭证引用原文。
- 不在 audit payload、reason、query whitelist、日志、错误消息、健康状态摘要或 devlog 中记录凭证引用原文。
- 不在测试 fixture 中写入真实格式的凭证引用样例。
- 如后续需要读取真实凭证，应新增服务端内部 resolver，返回 `ServerOnlyCredentialHandle` 这类不可序列化到客户端的 handle。
- handle 只能在单次 service 调用链内使用，不能长期缓存到全局变量、前端状态或 job payload。

## 与 secret manager / KMS / Vault 的关系

TC-10 只定义读取边界，不选择具体后端。secret manager / KMS / Vault 接入必须后置到独立 PR。

后续接入时应满足：

- provider interface 先稳定，再接具体后端。
- 具体后端路径、密钥标识、Vault path、secret manager path 和 KMS key id 都不能进入 DTO、audit、日志或 devlog。
- 后端访问失败统一映射为稳定错误码。
- 后端超时必须有上限，并映射为 `provider_timeout`。
- 后端权限不足或材料不可用不得回落到环境变量、明文配置或客户端字段。
- 真实后端接入前仍可保留 fake provider，用于 route / service / audit 的无凭证测试。

## 错误码边界

建议首期 credential provider 只允许返回以下稳定错误码：

- `missing_credential`：连接未配置凭证或内部 handle 不存在。
- `credential_provider_unavailable`：provider 服务不可用或未配置。
- `credential_unavailable`：provider 可用但目标材料不可读取。
- `credential_revoked`：材料已撤销、禁用或不再允许使用。
- `provider_timeout`：读取 provider 超时。

这些错误码可映射到测试连接健康状态，但不能携带 provider 原始错误、路径、账号、HIS 响应体、SQL 或 stack。

## audit 边界

测试连接 audit 仍只记录动作、结果、稳定 reason、租户、连接、actor、request id、时间和脱敏上下文。

TC-10 后续 runtime 接入时，audit 只允许知道以下 provider 相关事实：

- 是否尝试读取凭证。
- provider 读取结果是成功还是失败。
- 失败稳定错误码。
- 可选的 provider 类型或名称，但必须是非敏感枚举。

audit 禁止记录：

- 凭证引用原文。
- provider 后端路径。
- 账号、密码、token、api key、authorization header、basic auth、oauth token、private key、client_secret。
- HIS 厂商认证请求体、响应体或错误原文。
- adapter 原始 payload、patient data、appointment data、medical record data。
- SQL、stack 或环境变量。

## 与 TC-08 和 TC-09 的关系

TC-08 的 fake provider route runtime 仍保持不读取真实凭证。TC-09 的 audit runtime 仍保持不记录凭证字段。

TC-10 不能要求回改 TC-08 / TC-09 的安全边界，只能在后续真实 provider runtime 中新增服务端内部读取能力，并继续复用当前 route / DTO / audit denylist。

真实 provider runtime 接入后，fake provider 仍可用于本地测试、权限回归、route parser / DTO 回归和 audit 脱敏回归。

## 安全 denylist

以下内容禁止出现在 route DTO、audit payload、日志、健康状态摘要、provider 错误、测试快照、devlog 和公开文档示例中：

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
- raw credential
- raw HIS payload
- patient data
- appointment data
- medical record data
- SQL
- stack

## 后续 PR 拆分建议

建议在 TC-10 之后按以下顺序拆分：

1. credential provider interface runtime：只定义服务端 interface、稳定 result、错误码映射和脱敏测试，不接真实后端。
2. 服务端内部凭证 handle resolver：只从既有服务端存储边界解析 handle，不暴露到 read model、route、DTO 或 audit。
3. secret manager / KMS / Vault adapter：独立接入一个真实后端，并覆盖超时、不可用、撤销、权限不足和脱敏错误。
4. 真实 HIS adapter 测试连接 Plan Mode：定义 adapter 输入、输出、错误码、健康状态映射和网络超时边界。
5. 真实 HIS adapter 测试连接 runtime：在真实 provider 能力存在后接入，并保持 fake provider 回归路径。
6. 周期健康检查 runner / scheduler Plan Mode：只在手动测试连接链路稳定后规划。

## 规划验收口径

- 文档明确 credential provider 的服务端内部定位。
- 文档明确输入只来自服务端可信来源，不能来自 HTTP body / query / header 或前端状态。
- 文档明确输出只能在服务端调用链内传给真实 HIS adapter，不能进入 DTO、audit、日志或健康摘要。
- 文档明确 credentialRef 不作为 route 输入或输出，不进入公开 read model。
- 文档明确 secret manager / KMS / Vault 后置，并禁止暴露具体后端路径或密钥标识。
- 文档明确 provider 稳定错误码和测试连接健康状态映射边界。
- 文档明确 audit 只记录脱敏事实，不记录凭证材料或原始错误。
- 文档列出安全 denylist。
- 文档给出后续 PR 拆分，不开始 TC-11、runner / scheduler 或 schema / migration。
