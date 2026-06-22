export type DeploymentVersion = {
  commit: string;
  buildAt: string;
  source: 'env' | 'build' | 'unknown';
};

const commitEnvKeys = [
  'ZMTG_DEPLOY_COMMIT',
  'VERCEL_GIT_COMMIT_SHA',
  'NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA',
  'SOURCE_VERSION',
  'GITHUB_SHA',
] as const;

const buildAtEnvKeys = [
  'ZMTG_DEPLOY_BUILT_AT',
  'NEXT_PUBLIC_DEPLOY_BUILT_AT',
  'BUILD_TIMESTAMP',
  'SOURCE_DATE_EPOCH',
] as const;

function firstNonEmptyEnv(keys: readonly string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  return undefined;
}

function normalizeBuildAt(value: string | undefined) {
  if (!value) return 'unknown';

  if (/^\d+$/.test(value)) {
    const timestamp = Number(value) * 1000;
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return value;
}

export function getDeploymentVersion(): DeploymentVersion {
  const commit = firstNonEmptyEnv(commitEnvKeys);

  if (commit) {
    return {
      commit,
      buildAt: normalizeBuildAt(firstNonEmptyEnv(buildAtEnvKeys)),
      source: 'env',
    };
  }

  const buildCommit = process.env.ZMTG_BUILD_COMMIT?.trim();

  if (!buildCommit) {
    return {
      commit: 'unknown',
      buildAt: 'unknown',
      source: 'unknown',
    };
  }

  return {
    commit: buildCommit,
    buildAt: normalizeBuildAt(process.env.ZMTG_BUILD_AT?.trim()),
    source: 'build',
  };
}
