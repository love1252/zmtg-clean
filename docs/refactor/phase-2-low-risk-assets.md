# 第二阶段：低风险静态资源去重

- 日期：2026-07-25
- 分支：`refactor/low-risk-assets-20260725-215248`
- 基线：`41013403be4368806fc61d8c561f2513254575f4`

## 已处理

1. 首页背景：
   - 保留 `public/homepage/zmtg-luxury-clinic-bg.png`
   - 删除重复的 `public/homepage/luxury-clinic-bg.png`

2. 浅色品牌 Logo：
   - 保留 `public/brand/zmtg-logo-horizontal-luxury-clean.png`
   - 删除重复的 `public/brand/logo-horizontal-luxury.png`

3. 深色品牌 Logo：
   - 保留 `public/brand/zmtg-logo-horizontal-night-clean.png`
   - 删除重复的 `public/brand/logo-horizontal-night.png`

4. 更新 `src/modules/branding/brand-assets.ts`。

5. 更新逐文件迁移矩阵中的六条资源记录。

## 安全边界

- 未修改 Schema 或 Migration。
- 未修改 package.json 或 lockfile。
- 未修改认证、权限或租户隔离。
- 未连接数据库。
- 未调用真实 HIS 或企业微信。
- 未移动业务模块。
- 历史计划文档中的旧路径记录保持不变。
