import { execSync } from 'node:child_process';
import type { NextConfig } from 'next';

function readBuildCommit() {
  const envCommit =
    process.env.ZMTG_DEPLOY_COMMIT ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    process.env.SOURCE_VERSION ??
    process.env.GITHUB_SHA;

  if (envCommit?.trim()) return envCommit.trim();

  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

function readBuildAt() {
  return process.env.ZMTG_DEPLOY_BUILT_AT ?? process.env.BUILD_TIMESTAMP ?? new Date().toISOString();
}

const nextConfig: NextConfig = {
  env: {
    ZMTG_BUILD_AT: readBuildAt(),
    ZMTG_BUILD_COMMIT: readBuildCommit(),
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
