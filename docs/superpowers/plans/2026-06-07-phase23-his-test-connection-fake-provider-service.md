# Phase 23 HIS 测试连接 fake provider service 边界规划

## 范围声明

- 本文档只规划 Phase23-TC-07：fake provider service Plan Mode。
- 本轮只做 docs-only Plan Mode，不实现 fake provider runtime、route runtime、repository runtime、service runtime、parser runtime、DTO runtime、audit runtime、real provider、真实凭证读取、真实 secret manager / KMS / Vault、真实 HIS adapter、Webhook / 同步任务、runner / scheduler / cron、schema / migration、compensation runtime 或 recovery runtime。
- 本轮不修改 `src/**`、`drizzle/**`、schema / migration、package / lockfile、`.env` 或 `.codex/**`。
- 本文档承接 TC-01 到 TC-06 的测试连接边界、权限、audit、route parser / DTO 和健康状态 repository 写回规划，只规划 fake provider service 的安全边界。

## 开始前只读盘点结论

1. 本地 `main` 已同步 `origin/main`，两者均位于 `0926a9707775315d8377fc44573c139ba558cc68`。
2. 建分支前 working tree 为 clean。
3. TC-01 已规划测试连接 / 健康检查总边界，明确 fake provider 应先于真实 provider，且不出站、不读真实凭证、不保存 raw HIS payload。
4. TC-02 已规划 `POST /api/institution/his-connections/[connectionId]/test-connection` route、`open_connection:test_connection` 权限和 route 不直接触发外部探测的边界。
5. TC-03 已实现 `open_connection:test_connection` 权限 action，`tenant_admin` 已具备该动作，普通机构角色、平台角色和审计角色默认拒绝。
6. TC-04 已规划测试连接 audit action / reason / query whitelist，建议 service 层负责 test requested、success、failure 和 provider result 相关 audit。
7. TC-05 已规划 route parser / DTO 边界，v1 body 推荐为空，DTO 只允许 `ok`、`code`、`error`、`healthStatus`、`checkedAt` 等安全字段。
8. TC-06 已规划健康状态 repository 写回边界，明确 route 不直接写 repository，健康写回应由 test connection service 编排。
9. 当前代码已有凭证 fake in-memory provider，provider health 明确 `supportsTestConnection: false`，不能把它直接当作测试连接 fake provider service。
10. 当前代码已有 provider failure / audit reason 相关稳定命名，例如 `provider_timeout`、`provider_unavailable`、`provider_health_failed`、`repository_after_provider_failed`、`invalid_his_connection_payload` 和 `not_found_or_not_owned`。
11. 当前没有测试连接专用 service、fake provider service、route runtime、repository health write runtime 或 audit runtime。
12. 当天 devlog 文件 `docs/devlog/2026-06-07.md` 已存在。

## fake provider service 定位

fake provider service 是测试连接主线中的受控 provider 替身，用于后续最小 route runtime 验证完整链路。它的职责是根据服务端构造的连接快照和凭证摘要，返回安全、可归一化的测试连接 provider result。

它不是：

- 真实 HIS adapter。
- 真实 credential provider。
- secret manager / KMS / Vault。
- 外部网络请求。
- 写死到 route 里的临时代码。
- 前端可控制的测试结果。
- 可以保存 raw payload 的 provider。
- compensation / recovery provider。
- 凭证 fake in-memory storage 的扩展能力。

fake provider service 必须作为独立服务边界存在，避免 TC-08 route runtime 直接在 route 中拼装测试结果。

## 调用边界

后续推荐链路：

```text
route
  -> permission / parser
  -> test connection service
  -> fake provider service
  -> result normalization
  -> repository health write
  -> audit
  -> DTO
```

本轮只规划 fake provider service，不实现上述链路。

关键边界：

- route 不直接调用 fake provider service。
- route 不直接构造 provider result。
- route 不直接写健康状态。
- test connection service 负责读取连接快照、判断状态、调用 fake provider service、归一化结果、编排 repository 写回和 audit。
- fake provider service 只返回安全 provider result，不写 repository、不写 audit、不生成 DTO。

## 输入边界

fake provider service 输入只能由服务端 test connection service 构造。推荐输入形态：

```ts
{
  tenantId: string;
  connectionId: string;
  sourceSystem: string;
  vendorType: string;
  systemType: string;
  credentialConfigured: boolean;
  mode: 'manual';
  requestId?: string;
}
```

字段来源：

- `tenantId` 只能来自服务端 access context。
- `connectionId` 只能来自 route path，并经 test connection service 传入。
- `sourceSystem / vendorType / systemType` 只能来自数据库连接快照。
- `credentialConfigured` 只能来自服务端凭证摘要判断。
- `mode` 只允许受控值，v1 默认 `manual`。
- `requestId` 只用于内部追踪，不进入外部请求，不参与 provider 选择，不写入数据库。

fake provider service 不接受：

- 前端传入的 provider result。
- 前端传入的 `healthStatus / checkedAt / lastErrorCode`。
- 真实 `credentialRef`。
- 凭证明文。
- secret path。
- provider path。
- endpoint override。
- header override。
- raw HIS payload。
- SQL、stack 或 `DATABASE_URL`。

## 输入校验边界

后续 runtime 应在 fake provider service 内做最小安全校验：

- `tenantId`、`connectionId`、`sourceSystem`、`vendorType`、`systemType` 必须是非空短字符串。
- `credentialConfigured` 必须是布尔值。
- `mode` 只能是 `manual`。
- `requestId` 如存在，只能是短字符串安全摘要。
- 字段值中不得出现 token、secret、API key、OAuth、basic auth、private key、connection string、raw payload、SQL、stack 或 `DATABASE_URL`。

非法输入返回稳定 validation failure，不抛 raw error，不输出原始输入。

## 输出边界

fake provider service 输出必须是安全、已归一化或可归一化的 provider result。推荐输出形态：

```ts
{
  ok: boolean;
  providerCode:
    | 'fake_success'
    | 'fake_degraded'
    | 'fake_failed'
    | 'fake_missing_credential'
    | 'fake_unsupported_vendor'
    | 'fake_timeout'
    | 'fake_validation_failed';
  healthStatus: 'healthy' | 'degraded' | 'failed';
  errorCode: string | null;
  checkedAt: Date;
}
```

输出要求：

- 不包含 raw HIS payload。
- 不包含外部响应体。
- 不包含真实 endpoint。
- 不包含 header。
- 不包含 token、secret、API key、OAuth token、basic auth、private key、signing key 或 connection string。
- 不包含 `credentialRef`。
- 不包含 SQL、stack 或 `DATABASE_URL`。
- `checkedAt` 由服务端生成。
- `healthStatus` 只能映射到 TC-06 已规划健康状态集合中的 `healthy / degraded / failed`。
- `unknown` 不由 fake provider service 随意返回；如果需要重置为 `unknown`，应由上层 test connection service 明确触发。

## providerCode 与 errorCode 关系

`providerCode` 用于内部 provider result 分类，`errorCode` 用于健康写回和 DTO 稳定错误映射。

建议关系：

- `fake_success` -> `healthStatus=healthy`，`errorCode=null`。
- `fake_degraded` -> `healthStatus=degraded`，`errorCode=provider_warning` 或 `limited_health_probe`。
- `fake_failed` -> `healthStatus=failed`，`errorCode=provider_health_failed` 或后续安全 allowlist code。
- `fake_missing_credential` -> `healthStatus=failed`，`errorCode=missing_credential`。
- `fake_unsupported_vendor` -> `healthStatus=failed`，`errorCode=unsupported_vendor`。
- `fake_timeout` -> `healthStatus=failed`，`errorCode=provider_timeout`。
- `fake_validation_failed` -> `healthStatus=failed`，`errorCode=validation_failed`。

前端不应直接看到所有内部 `providerCode`。DTO 对外只返回 TC-05 规划的稳定 `code / error / healthStatus / checkedAt`。

## 结果场景规划

后续 fake provider service 至少需要支持以下场景：

### 成功

- 输入满足服务端白名单。
- `credentialConfigured=true`。
- `vendorType / systemType` 位于 fake allowlist。
- 返回 `ok=true`、`providerCode=fake_success`、`healthStatus=healthy`、`errorCode=null`。

### 降级

- 输入满足服务端白名单。
- fake allowlist 明确指定该连接类型只支持有限健康探测，或模拟非致命告警。
- 返回 `ok=false` 或后续 service 可接受的稳定降级结果。
- `healthStatus=degraded`。
- `errorCode` 只能使用内部 allowlist，例如 `provider_warning` 或 `limited_health_probe`。

### 失败

- 输入满足服务端白名单，但 fake allowlist 明确指定测试失败场景。
- 返回 `healthStatus=failed`。
- `errorCode` 使用内部 allowlist，不使用 raw message。

### 缺失凭证摘要

- `credentialConfigured=false`。
- 不读取真实凭证。
- 不调用 credential provider。
- 返回 `providerCode=fake_missing_credential`、`healthStatus=failed`、`errorCode=missing_credential`。

### 不支持 vendor / system type

- `vendorType / systemType` 不在 fake allowlist。
- 返回 `providerCode=fake_unsupported_vendor`、`healthStatus=failed`、`errorCode=unsupported_vendor`。
- 不把原始 vendor 参数透传给前端或 audit metadata。

### 模拟超时

- 只规划，不实际 sleep。
- 不引入不稳定测试。
- 可通过受控 fake scenario 或 allowlist 映射返回 `fake_timeout`。
- `errorCode=provider_timeout`。

### 非法输入

- 返回 `providerCode=fake_validation_failed`、`healthStatus=failed`、`errorCode=validation_failed`。
- 不抛 raw error。
- 不回显非法输入。

## fake 场景选择边界

fake 场景不应由前端直接控制。

推荐选择来源：

- 由 test connection service 根据数据库连接快照中的安全字段进行确定性映射。
- v1 可使用 `sourceSystem / vendorType / systemType` 的内部 allowlist。
- v1 不从 body / query / header 读取 scenario、provider result、endpoint、timeout 或 health status。
- 如果后续确需测试专用 scenario，应仅在 server-side test fixture 或受控测试工厂中使用，不暴露给生产 route。

这样可以让 route runtime 测试完整链路，同时避免前端伪造测试结果。

## 与 credential provider 的关系

fake provider service 不读取真实凭证。

明确禁止：

- 不接 secret manager / KMS / Vault。
- 不解析 `credentialRef`。
- 不接收凭证明文。
- 不保存凭证摘要之外的信息。
- 不把 `credentialConfigured=true` 解释为凭证有效或真实 HIS 已授权。

允许：

- 接收 test connection service 给出的 `credentialConfigured` 布尔摘要。
- 根据 `credentialConfigured=false` 返回 `missing_credential`。
- 在安全输出中标记 fake provider 没有读取真实凭证。

真实 credential provider 读取边界留到 Phase23-TC-10。真实 HIS adapter 测试连接留到 Phase23-TC-11。

## 与 repository 写回的关系

fake provider service 不直接写 repository。

明确禁止：

- 不调用 TC-06 规划的健康状态 repository 写回方法。
- 不修改 `healthStatus / lastCheckedAt / lastErrorCode`。
- 不修改连接状态、凭证字段、租户、名称、sourceSystem、vendorType 或 systemType。
- 不实现 optimistic lock 或 `updatedAt` 保护。

repository 写回应由 test connection service 编排：

1. test connection service 调 fake provider service。
2. test connection service 归一化 provider result。
3. test connection service 调用健康摘要 repository 写回方法。
4. repository 写回失败由 test connection service 稳定收口。

repository health write runtime 应单独 PR 实现。若 TC-08 需要完整 route runtime，存在 repository write runtime 是否应先拆出的风险；建议 TC-08 开始前再次确认是否需要先补一个极窄 repository write runtime PR，避免 route runtime 只能返回非持久化结果。

## 与 audit 的关系

fake provider service 不直接写 audit。

audit 由 route 或 test connection service 按 TC-04 / TC-06 统一编排：

- route 层负责权限拒绝、缺失可信 tenant、跨租户 target 和 parser failure denied audit。
- test connection service 负责 test requested、provider result normalized、repository health write attempted、success / failure audit。
- fake provider service 只提供安全 `providerCode`、`healthStatus`、`errorCode` 和 `checkedAt`。

audit metadata 可使用：

- 安全 `providerCode`。
- `healthStatus`。
- `errorCode`。
- `checkedAt`。
- 可选 `durationMs`。

audit metadata 不得包含：

- raw payload。
- 凭证明文。
- `credentialRef`。
- secret path。
- 外部响应体。
- endpoint。
- header。
- SQL、stack 或 `DATABASE_URL`。

audit runtime 留到 Phase23-TC-09。

## 与 route parser / DTO 的关系

route 不直接控制 fake provider 结果。

route parser 延续 TC-05 规划：

- v1 body 仍建议为空。
- future body 如确需存在，只允许 `mode: manual`、`clientRequestId` 等极薄白名单。
- body / query / header 不接受 provider result、scenario、endpoint、health status、checkedAt、lastErrorCode 或凭证。

DTO 延续 TC-05 规划：

- 成功 DTO 可返回 `ok=true`、`healthStatus=healthy`、`checkedAt`。
- 失败 DTO 可返回 `ok=false`、`code`、`error`、`healthStatus`、`checkedAt`。
- DTO 不返回完整连接详情。
- DTO 不返回 `providerCode` 的全部内部细节，除非后续明确将部分 code 映射为稳定对外 code。
- DTO 不返回 raw HIS payload、外部响应体、凭证明文或 `credentialRef`。

## 与真实 provider 的关系

fake provider service 是真实 provider 前的安全替身，不是未来真实 adapter 的简化实现。

后续真实 provider 必须另行规划：

- 真实 credential provider 读取。
- 真实 secret manager / KMS / Vault。
- 真实 HIS adapter health endpoint。
- 出站网络、超时、重试、限流、熔断。
- 外部错误脱敏。
- 厂商差异。
- 生产凭证读取审计。

fake provider service 不应保留任何需要真实 provider 才能解释的参数，例如真实 endpoint、厂商账号、门店号、认证 header 或 HIS payload。

## 后续测试规划

本轮不写 tests。后续 runtime PR 应至少覆盖：

- fake success。
- fake degraded。
- fake failed。
- missing credential summary。
- unsupported vendor。
- invalid input。
- 不返回 raw payload。
- 不读取真实凭证。
- 不写 repository。
- 不写 audit。
- 不访问网络。
- 不依赖环境变量。

建议测试方式：

- 单元测试直接调用 fake provider service。
- 使用 fake timer 或固定 clock 验证 `checkedAt`，不实际 sleep。
- 使用敏感字段正则确认 result 不包含 token、secret、credentialRef、raw payload、SQL、stack 或 `DATABASE_URL`。
- 使用 spy 确认不调用 `fetch`、credential provider、repository 或 audit repository。
- 使用输入白名单测试确认前端无法通过 mode、requestId 或 vendor 字段控制最终 provider result。

## 后续 PR 拆分建议

后续拆分：

1. Phase23-TC-08：fake provider route runtime 最小实现。
2. Phase23-TC-09：测试连接 audit runtime。
3. Phase23-TC-10：真实 credential provider 读取边界 Plan Mode。
4. Phase23-TC-11：真实 HIS adapter 测试连接 Plan Mode。
5. Phase23-TC-12：周期健康检查 runner / scheduler Plan Mode。

风险提示：

- TC-06 只规划了 repository health write，没有实现 runtime。
- 如果 TC-08 要验证“route -> service -> provider -> repository health write -> DTO”的完整持久化链路，可能需要在 TC-08 前先拆一个极窄 repository write runtime PR。
- 如果 TC-08 选择先不持久化健康状态，必须在 route runtime PR 中明确 DTO 返回的是 fake provider service 的安全结果，不代表数据库健康字段已经写回。
- 无论选择哪条路线，都不得把真实 credential provider、真实 HIS adapter、audit runtime 或 runner / scheduler 混入 TC-08。

## 本轮交付边界

本轮只交付：

- 一份 fake provider service 边界规划文档。
- 当天 devlog 记录。

本轮不交付：

- fake provider service 代码。
- test connection service 代码。
- route 代码。
- parser / DTO 代码。
- repository health write 代码。
- audit runtime。
- real provider。
- schema / migration。
- package / lockfile 变更。

