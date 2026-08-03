# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B2 Binding 高水位／冲突／Owner Writer 清零复核
```

## 任务目标

1. 只读核验 residual uncalibrated Binding 为 0；
2. 核验 evidence identity、tenant command 与 Binding version 冲突均为 0；
3. 核验 Owner 外 Binding current／evidence Writer 为 0；
4. 重跑并冻结 AQ008 Membership／Binding current／Binding evidence gate；
5. 核验 evidence UPDATE／DELETE／TRUNCATE 为 0；
6. 核验第二 Membership／Binding fact source 为 0；
7. 形成 BASE-B2 完整关闭清单与独立审查准入。

## 禁止范围

- 不运行或改写 0045；
- 不连接非 localhost 数据库；
- 不修改 Binding、Membership、Scope、Context 或 orphan；
- 不执行 Scope FK VALIDATE；
- 不启动 BASE-B3～B6；
- 不放行项目级 Writer、Audit、MIG-01B／C 或业务 Reader。
