# BASE-B5 historical orphan 权威处置分支决策

> 日期：`2026-08-06`
>
> 前置：BASE-B4 complete；BASE-B5 decision preplanning ready。

## 决策

```text
selected_branch=B5_KEEP_BLOCKED
decision_gate=passed
base_b5_started=true
base_b5_complete=false
can_satisfy_b5_success=false
historical_orphan_remediation_authorized=false
business_reader_release=false
business_capability_release=false
base02_complete=false
```

根据冻结分支矩阵，在没有仓库外权威依据、没有精确 Scope authority、没有无效记录及保留政策依据的情况下，默认且唯一合规分支是 `B5_KEEP_BLOCKED`。

本决策明确排除：

- 不以“当前只有一个 Scope”推断目标并重绑；
- 不从 Binding 反向创建 Scope；
- 不把 revoke-only 冒充 BASE-B5 成功；
- 不执行删除、归档或任何数据库写入；
- 不把 BASE-B5 决策门通过写成 BASE-02 完成。

## 重新开启处置分支的条件

只有在仓库外权威业务依据完成低敏化、来源可追溯、责任人和适用范围明确后，才能重新执行证据准入。若候选仍不唯一、事实冲突或需要猜测，继续保持 `B5_KEEP_BLOCKED`。

未来任何执行分支还必须重新冻结 localhost-only 目标、恢复点、无并发 Writer、现场只读复核、`expected=1`、`affected=1`、`conflict=0`、`unexpected=0`、结果不确定停止和 forward-fix 规则。
