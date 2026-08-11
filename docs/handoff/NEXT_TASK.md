# 下一任务

## 唯一下一任务

```text
W6B Credential Compensation domain/port ownership audit + exact Runtime allowlist admission
```

## 当前状态

```text
w2_care_complete=true
w3_knowledge_complete=true
w5_complete=true
w6a_complete=true

w6b_compensation_audit=passed
w6b_direct_mutation_calls=4
w6b_direct_writer_files=2
w6b_active_production_factory_constructors=0
w6b_worker_uses_injected_ports=true
w6b_legacy_server_domain_coupling=true
w6b_runtime_allowlist_frozen=false
w6b_runtime_authorized=false
w6b_blocked_pending_domain_port_ownership_admission=true

w6_institution_system_complete=false
trial_provisioning_classification=separate_provisioning_review
business_writer_phase_complete=false
```

W6B 只覆盖：

```text
hisConnectionCredentialCompensationOperations
hisConnectionCredentialCompensationJobs
```

下一步必须先完成 domain contract ownership、repository port ownership、worker import/type ownership、operation/job state-machine + CAS、coordination boundary、canonical destination、exact Runtime allowlist 和 test matrix 的 docs-only Formal Admission。

在 Formal Admission 合并并收到新的明确 Runtime 授权前，禁止 W6B Runtime、Trial Provisioning Runtime、Schema、Migration、DB execution、API Route change、Reader/Capability release、real HIS 和 production change。
