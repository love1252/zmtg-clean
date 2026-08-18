
# 客户受控写完整闭环发布

- 日期：2026-08-18
- 基线：`7079a85bb946536ae9d36e377ad63380255b42e2`
- 任务：`CUSTOMER_CONTROLLED_WRITE_CLOSED_LOOP_RELEASE`

## 完整业务目标

本任务一次完成客户正式 Controlled Write，不拆 Admission / Create / Update /
Owner / UI / Workbench 支线：

- management-only 新建客户；
- exact tenant + institution scope；
- tenant customer quota，create 在 tenant-scoped transaction advisory lock 后检查并写入；
- `updatedAt` CAS：兼容 PostgreSQL 既有微秒值与 V1 毫秒 token，并保证受控更新后的 token 严格前进；
- 客户低敏资料更新；
- 生命周期更新；
- 优先级更新；
- management-only 负责人调整；
- 目标负责人 current Membership 校验；
- institution-attributed audit；
- canonical V1 POST / detail GET+PATCH；
- canonical list/detail page；
- Capability Authority release；
- Workbench management-only customer/appointment/follow-up quick create；下游 `InstitutionWorkbenchCapabilityOff` 同步校验并接受授权过滤后的 canonical 多项菜单。

## V1 Controlled Write 字段

```text
displayName
lifecycle
priority
ownerUserId
projectInterest
```

正式 V1 Controlled Write 不开放 `notes`、`birthDate`、`gender`、
`referralSource`、完整联系方式、完整病历号等高敏字段。

## 权限

```text
create:
tenant_admin | tenant_operator

profile/lifecycle/priority update:
formal customer/update policy

owner reassignment:
tenant_admin | tenant_operator
```

Capability Authority 只发布 release metadata，不充当 target-role permission source。

## API / 页面

```text
GET  /api/v1/institution/customers
POST /api/v1/institution/customers

GET   /api/v1/institution/customers/:customerId
PATCH /api/v1/institution/customers/:customerId

/hospital/customers
/hospital/customers/:customerId
```

## Release

```text
PAGE_CUSTOMER_LIST=operational/pilot_released
ACTION_CUSTOMER_CREATE=operational/pilot_released

GOVERNED_READONLY_PAGE_COUNT=6
CONTROLLED_WRITE_PAGE_COUNT=3
CONTROLLED_CREATE_RELEASE_COUNT=3
```

## 保持关闭

```text
CUSTOMER_DELETE=false
CUSTOMER_IMPORT=false
REAL_SEND=false
REAL_INBOUND=false
HIS_MUTATION=false
EXTERNAL_NETWORK_MUTATION=false
AI_AUTOMATION=false
STAGING=false
PRODUCTION=false
```
