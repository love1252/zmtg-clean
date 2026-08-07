# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B5 跨 tenant transfer controlled execution runner 2-file 最小实现授权与执行
```

## 已完成

- cross-tenant transfer 4-file foundation 已完成并独立审查；
- controlled execution runner admission 已通过；
- runner exact allowlist 已冻结为 2 个新文件；
- runner 选择 one-shot CLI，不建设长期 API；
- package.json、lockfile、Schema、Migration、现有 transfer foundation 均无需修改。

## Frozen allowlist

```text
scripts/db/base02-b5-cross-tenant-transfer-runner.mjs
scripts/db/base02-b5-cross-tenant-transfer-runner.test.mjs
```

## 下一任务进入条件

必须取得明确的 runner **代码实现授权**。

该授权只允许创建上述 2 文件以及执行纯代码测试、commit/push/PR/CI/merge。

即使 runner 代码完成，仍然禁止：

- 实际连接数据库；
- dry-run 连接 local_acceptance；
- execute；
- DDL/DML/Migration/Seed/FK VALIDATE；
- Membership/Binding 实际数据库写入；
- historical orphan remediation；
- API/composition root wiring；
- Reader/Capability release；
- production change。

未来数据库 dry-run / execute 必须再次取得独立授权。
