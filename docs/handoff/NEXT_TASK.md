# 下一任务

## 唯一下一任务

```text
W6B Credential Compensation exact 18-file Runtime implementation explicit authorization
```

## W6B Formal Admission 状态

```text
w6a_complete=true

w6b_domain_ownership_audit=passed
w6b_port_ownership_audit=passed
w6b_state_machine_cas_audit=passed
w6b_coordination_boundary_audit=passed
w6b_canonical_owner=institution-system

w6b_direct_mutation_calls=4
w6b_direct_writer_files=2
w6b_active_production_factory_constructors=0

w6b_exact_runtime_file_count=18
w6b_runtime_allowlist_frozen=true
w6b_runtime_authorized=false
w6b_canonical_production_activation=false

w6_institution_system_complete=false
business_writer_phase_complete=false
```

冻结清单：

`docs/operations/base02-w6b-exact-runtime-allowlist-20260811.csv`

第 19 个 Runtime 文件必须 `STOP / re-admit`。

本 Runtime 只迁 compensation domain / ports / retry policy / worker / operation+job repositories 的 ownership，并阻断 legacy operation/job/worker surfaces。

不包含 production worker activation、cron、Route、queue consumer、real provider executor、Schema、Migration、DB execution、W6A、Trial Provisioning。

必须收到新的明确 Runtime 授权后才能实施 W6B。
