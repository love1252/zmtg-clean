# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B5 historical orphan 权威处置分支决策与证据准入
```

## 当前基线

- BASE-B4 completion audit：passed；
- BASE-B4 independent review：passed；
- BASE-B4：complete；
- BASE-B5 decision preplanning：ready；
- BASE-B5 started：false；
- historical orphan remediation authorized：false；
- accepted low-sensitive evidence：active historical orphan／Scope relation orphan=`1／1`；
- live readonly reprobe：required；
- BASE-02：未完成；
- Reader／Capability：继续关闭。

## 任务目标

1. 获取并核验仓库外权威业务依据；
2. 在 5 个冻结分支中作出明确选择；
3. 明确保持阻断、撤销、确定性重绑、独立 Provisioning 或受控删除的适用性；
4. 若选择重绑，必须精确证明目标 Scope；
5. 冻结未来只读探针、恢复点、并发门禁、affected rows 和停止条件；
6. 只形成决策与证据准入，不执行实际处置。

## 禁止范围

- 不连接数据库；
- 不读取或公开原始双键、PII、连接参数或凭证；
- 不执行 DDL、DML、Migration、Seed 或 FK VALIDATE；
- 不创建 Scope；
- 不放行 Reader 或业务 Capability；
- 不把 BASE-B4 complete 写成 BASE-02 complete。
