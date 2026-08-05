# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 剩余正式入口分类校准与完成审计前置预检
```

## 当前基线

- formal guarded Routes：15；
- 第四批严格低风险候选已实施完成；
- business Reader／Capability：继续关闭；
- BASE-B4：未完成；
- BASE-B5：未启动。

## 任务目标

1. 从最新 main 重新枚举剩余未正式接线入口；
2. 按 write／mixed、dynamic object、legacy／retired、direct DB、
   demo／fixture、external touch、高风险和独立 formal Guard 分类；
3. 逐类证明保持禁用、已有独立 Guard，或冻结下一窄实施切片；
4. 重建 BASE-B4 完成条件缺口清单；
5. 只有剩余入口均被证明关闭后，才允许 BASE-B4 完成审计；
6. 不在本任务中启动 BASE-B5 historical orphan 处置。

## 禁止范围

- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不开放业务 Reader、对象事实 Adapter 或新 Capability；
- 不处理 historical orphan，不验证 Scope FK；
- 不启动 BASE-B5～B6、业务 Writer、Audit／模板或 MIG-01B／C。
