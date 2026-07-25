export const brandAssets = {
  logoHorizontal: '/brand/logo-horizontal.png',
  logoHorizontalLuxury: '/brand/zmtg-logo-horizontal-luxury-clean.png',
  logoHorizontalNight: '/brand/zmtg-logo-horizontal-night-clean.png',
  logoMark: '/brand/logo-mark.png',
  logoStacked: '/brand/logo-stacked.png',
  homepageBackground: '/homepage/zmtg-luxury-clinic-bg.png',
} as const;

export type BrandAssetKey = keyof typeof brandAssets;
