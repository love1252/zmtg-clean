# 智美天工唯一下一任务

## 唯一下一任务

```text
W2-P2 Care / Follow-up residual Writer transaction/callgraph admission
```

## W2-P1 已完成

```text
implementation_pr=1106
implementation_merge=3679122f2ea11079660cc16a7d9871f619c81386
independent_review_pr=1107
independent_review_merge=RUN=31309490891 POLL=1 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=2 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=3 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=4 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=5 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=6 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=7 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=8 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=9 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=10 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=11 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=12 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=13 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=14 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=15 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=16 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=17 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=18 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=19 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=20 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=21 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=22 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=23 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=24 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=25 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=26 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=27 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=28 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=29 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=30 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=31 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=32 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=33 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=34 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=35 STATUS=in_progress CONCLUSION=
RUN=31309490891 POLL=36 STATUS=completed CONCLUSION=success
ac66266c78c9e1263959812cbcfc8b7ac9bc632d
w2_p1_complete=true
```

W2-P1 已完成 Care canonical Treatment Summary Writer、tenant + institution attribution、customer / appointment ownership、fail-closed、legacy Writer blockade 与 read/list compatibility；三个 mutation Route 继续 capability-off。

## W2-P2 当前事实

```text
w2_p2_residual_mutation_calls=15
w2_p2_residual_writer_methods=15
w2_p2_production_callers=5
w2_p2_residual_fact_tables=6
w2_p2_runtime_allowlist_frozen=false
w2_p2_runtime_authorized=false
```

下一 admission 必须冻结 Owner、transaction/rollback grouping、timeline evidence Owner、tenant + institution attribution、5 个 production caller rewire、legacy blockade、exact Runtime allowlist 与 atomicity tests。

## Trial Provisioning

`src/modules/institution/server/trial-provisioning-service.ts` 的 `treatmentSummaries` insert 保持独立 Provisioning review：

```text
classification=separate_provisioning_review
ordinary_business_dual_write=false
provisioning_treatment_summary_writer_review_pending=true
```

不得混入 W2-P2，也不得未经单独准入修改。

```text
w2_care_complete=false
business_writer_phase_complete=false
reader_release=false
capability_release=false
```
