/**
 * 面向机构导航消费者的公共服务端授权兼容面。
 * Canonical Owner 与全部可信判定仍保留在 security server 实现中。
 */
export {
  isInstitutionNavigationAuthorizationV1,
  matchesInstitutionNavigationAuthorizationScopeV1,
  readInstitutionNavigationWorkspaceScopeKeyV1,
  type InstitutionNavigationAuthorizationV1,
} from './server/institution-section-guard';
