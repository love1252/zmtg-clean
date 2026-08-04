# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 全量入口 Guard／绕过闭环终检与剩余生命周期入口前置预检
```

## 当前已完成

- Object Fact Port、Action Policy、Object Guard 核心：完成；
- 正式 Route Guard 第一批：5；
- 正式 Route Guard 第二批：5；
- 正式 Route Guard 第三批：4；
- 三批累计正式 Route Guard：14；
- 业务 Reader 与新 Capability：继续关闭。

## 任务目标

1. 以第三批实施和独立审查后的最新 main 重新枚举全部机构入口；
2. 重建 API Route、Page、Server Action、onboarding、reset、Seed、fixture、
   导入、维护任务和旧 Route 的全量清单；
3. 对每个入口重新识别 Scope／Section／Object／Action Guard 状态；
4. 区分已正式接线、capability-off 接线、动态对象、写 Route、数据库接触、
   demo／formal 混用、外部触达和高风险入口；
5. 逐项核对 Membership／Binding 创建、删除和维护入口是否委托 BASE-B2
   唯一 Owner，或保持禁用；
6. 证明 Owner 外直接 Membership／Binding Writer／Deleter 为 0；
7. 冻结 BASE-B4 剩余缺口、精确文件 allowlist、原子实施顺序和完成硬门；
8. 只有终检和独立审查通过后，才允许继续剩余 B4 实施或进入 B4 完成审计。

## BASE-B4 完成前持续硬门

- 不把 14 个 Route 接线写成 BASE-B4 全部完成；
- onboarding、reset、Seed、fixture、导入和维护入口必须完成归类；
- 已证生命周期入口必须委托唯一 Owner 或保持禁用；
- 业务 Reader／Capability 继续关闭；
- 不启动 BASE-B5 historical orphan 处置；
- 不执行 Scope FK VALIDATE。

## 禁止范围

- 本任务先做前置预检、清单和独立审查，不修改生产 Runtime；
- 不修改 Schema、Migration、journal 或 snapshot；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不开放业务 Reader、对象事实 Adapter 或新 Capability；
- 不启动 BASE-B5～B6、业务 Writer、Audit／模板或 MIG-01B／C；
- 不处理 historical orphan。
