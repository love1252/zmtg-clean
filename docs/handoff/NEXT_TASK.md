# 智美天工唯一下一任务

## 唯一下一任务

```text
执行 BASE-B5 B5_DETERMINISTIC_REBIND live readonly reprobe
```

## 当前基线

- 可核验权威业务依据 submitted／admitted：`1／1`；
- admitted branch：`B5_DETERMINISTIC_REBIND`；
- BASE-B5：未完成；
- historical orphan remediation：未授权；
- live readonly reprobe：required，未执行；
- BASE-02：未完成；
- Reader／Capability：继续关闭。

## 下一任务目标

在单独授权的只读数据库连接中核验：

1. 当前 historical orphan 仍然唯一存在；
2. 仓库外权威依据指向的目标机构 Scope 在现场存在；
3. 目标 Scope 唯一，不存在同名或多候选歧义；
4. historical orphan 当前没有被其他任务修改；
5. 当前 Binding、Scope、Membership 和证据表形状符合预期；
6. 只读复核不执行任何 DDL、DML、Migration、Seed 或 FK VALIDATE。

## 当前仍禁止

- 本任务收口本身不连接数据库；
- 不执行确定性重绑；
- 不修改 Binding；
- 不创建 Scope；
- 不执行 DDL、DML、Migration、Seed 或 FK VALIDATE；
- 不开放 Reader 或业务 Capability；
- 不把 BASE-B5 或 BASE-02 写成已完成。

live readonly reprobe 必须由下一份独立脚本明确列出连接边界、SQL 白名单、输出脱敏规则、停止条件和执行授权。
