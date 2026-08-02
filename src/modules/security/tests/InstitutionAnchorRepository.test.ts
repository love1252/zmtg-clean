import { describe, expect, it } from 'vitest';

import * as retiredInstitutionAnchorRepository from '@/modules/security/server/institution-anchor-repository';

describe('已退役的 Security 机构锚点 repository', () => {
  it('不再导出 Scope 类型、数据库入口或兼容 facade', () => {
    expect(Object.keys(retiredInstitutionAnchorRepository)).toEqual([]);
  });
});
