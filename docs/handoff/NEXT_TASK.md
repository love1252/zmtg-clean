# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B5 仓库外权威业务依据补充与重新准入
```

## 当前基线

- BASE-B4：complete；
- BASE-B5 decision gate：passed；
- selected branch：`B5_KEEP_BLOCKED`；
- BASE-B5：started，但未完成；
- authority evidence submitted／admitted：`0／0`；
- historical orphan remediation authorized：false；
- live readonly reprobe：required，尚未执行；
- BASE-02：未完成；
- Reader／Capability：继续关闭。

## 任务目标

1. 获取仓库外权威业务依据，并形成低敏、可追溯的证据清单；
2. 明确证据来源、责任人、适用记录和业务处置意图；
3. 若要求重绑，精确证明目标 tenant／institution Scope；
4. 若 Scope 不存在，退出 BASE-B5 并另立 Tenancy Provisioning；
5. 若要求删除或归档，补齐记录无效证明与数据保留政策；
6. 完成重新准入前继续保持 `B5_KEEP_BLOCKED`。

## 禁止范围

- 不连接数据库；
- 不读取或公开原始双键、PII、连接参数或凭证；
- 不执行 DDL、DML、Migration、Seed 或 FK VALIDATE；
- 不创建 Scope；
- 不放行 Reader 或业务 Capability；
- 不把决策门通过写成 BASE-B5 或 BASE-02 完成。
