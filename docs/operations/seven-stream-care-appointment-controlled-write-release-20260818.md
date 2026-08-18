
# 预约受控写完整闭环发布

- 日期：2026-08-18
- 基线：`1874735510c108e0feff2648c82ccb71bb1afa82`
- 任务：`CARE_APPOINTMENT_CONTROLLED_WRITE_CLOSED_LOOP_RELEASE`

## 完整业务目标

本任务一次完成预约正式 Controlled Write，不再拆分 Admission / Create /
Transition / UI / Workbench 子任务：

- management-only 创建预约；
- 客户 exact tenant/institution ownership；
- 顾问 current Membership 校验；
- `updatedAt` CAS；
- 状态流转；
- 改期；
- 取消；
- institution-attributed audit；
- canonical V1 POST / detail GET+PATCH；
- canonical list/detail page；
- Capability Authority release；
- Workbench management-only quick create。

## 复用既有正式持久化

本任务不新增第二套 appointment persistence，不新增 Migration。

复用：

```text
public.appointments
appointment-command-service
appointment-command-repository
```

正式写入继续以 `tenantId + institutionId` exact predicate 和
`updatedAt` CAS 为并发边界。

## 权限

```text
create:
tenant_admin | tenant_operator

status / reschedule / cancel:
tenant_admin | tenant_operator | assigned consultant
```

`customer_service` 不获得预约写权限。Capability Authority 只发布 release
metadata，实际目标 Runtime 重新执行 formal Care write authorization。

## API / 页面

```text
GET  /api/v1/institution/appointments
POST /api/v1/institution/appointments

GET   /api/v1/institution/appointments/:appointmentId
PATCH /api/v1/institution/appointments/:appointmentId

/hospital/care/appointments
/hospital/care/appointments/:appointmentId
```

对外 DTO 只返回 appointment ID、时间、状态、更新时间与低敏 permissions；
customer/project/note/consultant identity 不从 detail wire 返回。

## Release

```text
PAGE_CARE_APPOINTMENTS=operational/pilot_released
ACTION_CARE_APPOINTMENT_CREATE=operational/pilot_released

GOVERNED_READONLY_PAGE_COUNT=7
CONTROLLED_WRITE_PAGE_COUNT=2
CONTROLLED_CREATE_RELEASE_COUNT=2
```

## 保持关闭

```text
REAL_SEND=false
REAL_INBOUND=false
HIS_MUTATION=false
EXTERNAL_NETWORK_MUTATION=false
AI_AUTOMATION=false
STAGING=false
PRODUCTION=false
```
