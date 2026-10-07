export type DailyUsableEnvironment = {
  contract: string; runId: string; container: string; containerId: string; database: string;
  socketPath: string; port: number; appPort: number; password: string; loginPassword: string;
  sessionKey: string; guardKey: string; encryptionKey: string; createdAt: string;
};
export function readState(file: string): Promise<DailyUsableEnvironment>;
export function verifyContainer(state: DailyUsableEnvironment): Promise<unknown>;
export function databaseUrl(state: DailyUsableEnvironment): string;
