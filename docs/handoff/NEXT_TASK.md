# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B6 BASE-02 completion audit、Option 1 supersession reconciliation 与 physical FK terminal strategy preplanning
```

## 已完成

- BASE-B1～B4 治理/实现链已完成；
- BASE-B5 cross-tenant transfer foundation 已完成；
- controlled runner admission / implementation / Independent Review 已完成；
- localhost-only readonly preflight 已通过；
- private manifest / secure lease 已签发并消费；
- one-time execute 已严格执行 1 次；
- execute result=`applied_verified`；
- outcome=`committed`；
- fresh independent postcheck=`passed`；
- active authorization orphan=`0`；
- active Scope relation orphan=`0`；
- retained revoked historical relation orphan=`1`；
- BASE-B5 已完成。

## 当前 BASE-02 状态

```text
base_b5_complete=true
base02_complete=false
reader_release=false
capability_release=false
```

## 为什么下一步是 BASE-B6 audit

早期 BASE-02 readiness plan 的 BASE-B6 硬门形成于 Option 1 ADR 之前，其中包含“全部物理 relation orphan=0”的旧口径。

后续 accepted Option 1 已 supersede 该口径：

```text
active authorization orphan = 0
active Scope relation orphan = 0
retained revoked historical relation orphan = 1 expected
```

因此 BASE-B6 必须先完成：

1. BASE-B1～B5 独立证据总审计；
2. 对旧 BASE-B6 success gate 做 Option 1 supersession reconciliation；
3. 核对 Owner / Session / Membership / Binding / Scope revision / Guard / bypass matrix；
4. 判断 BASE-02 是否已经满足当前业务授权完整性完成标准；
5. 将 physical FK 与业务完成标准明确分离；
6. 冻结 physical FK terminal strategy 的候选路径与后续授权边界；
7. 在没有独立 Schema/Migration 授权时不得选择或实施物理约束改造；
8. Reader / Capability 仍不得放行。

## 当前禁止

- 不自动连接数据库；
- 不执行 DDL/DML/Migration/Seed；
- 不执行 FK VALIDATE；
- 不再执行 BASE-B5 transfer；
- 不修改 historical Binding tuple；
- 不删除/归档 historical Binding；
- 不开放 Reader/Capability；
- 不做生产连接或生产变更。
