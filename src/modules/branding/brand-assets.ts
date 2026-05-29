export const brandAssets = {
  logoHorizontal: '/brand/logo-horizontal.png',
  logoHorizontalLuxury: '/brand/logo-horizontal-luxury.png',
  logoHorizontalNight: '/brand/logo-horizontal-night.png',
  logoMark: '/brand/logo-mark.png',
  logoStacked: '/brand/logo-stacked.png',
  homepageBackground: '/homepage/luxury-clinic-bg.png',
} as const;

export type BrandAssetKey = keyof typeof brandAssets;
