# 智美天工唯一下一任务

## 唯一下一任务

```text
取得并提交 BASE-B5 可核验仓库外权威业务依据
```

## 当前基线

- 输入表已接收并通过低敏安全校验：1；
- 仓库外权威业务依据 submitted／admitted：`0／0`；
- selected branch：`B5_KEEP_BLOCKED`；
- BASE-B5：未完成；
- live readonly reprobe：required，未执行；
- BASE-02：未完成；
- Reader／Capability：继续关闭。

## 需要取得的真实依据

以下任一类均可作为后续重新准入输入：

1. 正式组织归属确认；
2. 具备责任权限的业务负责人决定；
3. 已批准的 Tenancy／Scope Provisioning 决定；
4. 已批准的记录无效认定和数据保留政策；
5. 可审计治理工单。

材料必须具备签发角色、签发日期、适用记录范围和低敏来源引用。不得依赖模型推断、聊天记录、仓库计数或“只有一个 Scope”的推断。

## 当前禁止范围

- 不启动 live readonly reprobe；
- 不连接数据库；
- 不执行 DDL、DML、Migration、Seed 或 FK VALIDATE；
- 不创建 Scope；
- 不放行 Reader 或业务 Capability；
- 不把输入表接收写成权威证据已提交或已准入；
- 不把 BASE-B5 或 BASE-02 写成已完成。
