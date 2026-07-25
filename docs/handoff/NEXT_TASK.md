# 下一任务

## 任务名称

目录重构第一阶段：逐文件迁移矩阵审核。

## 当前目标

1. 审核 `docs/refactor/file-migration-matrix.csv`。
2. 对文件逐项标记：
   - 保留
   - 移动
   - 拆分
   - 合并
   - 重命名
   - 删除候选
3. 确认客户、预约、治疗、随访、知识库和工作台的模块边界。
4. 确认 API 版本化目标。
5. 本阶段不移动正式代码。

## 禁止范围

- Schema 和 Migration
- package.json 和 lockfile
- 真实凭证
- 真实外部调用
- 生产配置
- 直接修改 main
