# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B2 旧 Binding 写入口委托或禁用与 AQ008 Binding writer gate 前置预检
```

## 目标

1. 清点全部 Binding current／evidence mutation 入口；
2. 证明 Owner Repository 外直接 Writer 为 0；
3. 核对 raw SQL、generic helper、barrel、alias 与 reverse caller 绕过；
4. 冻结 AQ008 对 Binding current／evidence 的扩展规则；
5. 冻结唯一 Owner allowlist 与测试矩阵。

## 禁止范围

- 不修改 Runtime／Schema／Migration；
- 不连接数据库；
- 不执行 legacy calibration；
- 不处理 historical orphan；
- 不执行 Scope FK VALIDATE；
- 不启动 BASE-B3～B6。
