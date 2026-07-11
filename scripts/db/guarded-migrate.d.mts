export class MigrationGuardError extends Error {}

export type MigrationEnvironment = Record<string, string | undefined>;
export type MigrationTarget = 'local' | 'production';
export type MigrationState = {
  target: MigrationTarget;
  host: string;
  database: string;
  latestMigration: string;
  migrationTags: string[];
  pendingMigrations: string[];
};

export type MigrationChildProcess = {
  once(event: 'error', listener: (error: Error) => void): unknown;
  once(event: 'close', listener: (code: number | null) => void): unknown;
};

export type MigrationSpawn = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: MigrationEnvironment;
    shell: false;
    stdio: ['ignore', 'ignore', 'ignore'];
  },
) => MigrationChildProcess;

export function assertMigrationAllowed(
  env: MigrationEnvironment,
  rootDir: string,
): MigrationState;

export function runGuardedMigration(options?: {
  env?: MigrationEnvironment;
  rootDir?: string;
  spawnImpl?: MigrationSpawn;
  logger?: { info(message: string): void };
}): Promise<void>;
