# BASE-02 旧 Binding 写入口与 AQ008 Binding writer gate 前置预检

> 日期：2026-08-03

## 结论

```text
base02_binding_writer_aq008_preflight=passed
binding_current_direct_writer_files=1
binding_evidence_direct_writer_files=1
raw_binding_current_writer_files=0
raw_binding_evidence_writer_files=0
owner_outside_binding_writer_count=0
legacy_auth_binding_writers=disabled_by_absence
aq008_membership_gate_present=true
aq008_binding_writer_gate_extended=false
implementation_allowlist_files=2
eligible_for_aq008_binding_writer_implementation=true
legacy_binding_calibration_complete=false
base_b2_complete=false
eligible_for_base_b3=false
```

Binding current 与 evidence 的唯一直接生产 Writer 均为 `src/modules/access-control/server/membership-command-repository.ts`；其他模块 Drizzle／raw SQL Writer 为 0。旧直接入口按不存在即禁用收口。

现有 AQ008 已覆盖 Drizzle、raw SQL、alias、barrel、generic helper、reverse caller、copy／rename 与 commit blob，但尚未保护 `auth_account_institution_bindings` 和 `auth_account_institution_binding_transitions`。

## 精确实施 allowlist

1. `scripts/verify/architecture-quality.mjs`
2. `scripts/verify/architecture-quality.test.mjs`

实施保持现有 AQ008 rule identity，把两张 Binding canonical 表纳入同一 Owner gate；rules.json 不允许例外。

Runtime、Schema、Migration、数据库、calibration、orphan、FK VALIDATE 与 BASE-B3 均禁止。
