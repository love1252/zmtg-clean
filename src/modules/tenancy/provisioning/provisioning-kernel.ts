import {
  computeProvisioningEntryKeysDigest,
  type ProvisioningCanonicalEntryV1,
} from './provisioning-canonicalization';
import {
  assertParsedProvisioningManifest,
  toProvisioningExpectedTriplet,
  type ProvisioningManifestV1,
} from './provisioning-manifest';
import {
  verifyProvisioningExecutionLease,
  type ProvisioningLeaseAuthorityPortV1,
  type ProvisioningLeaseExpectationV1,
} from './provisioning-lease';
import type {
  ProvisioningExpectedTripletV1,
  ProvisioningRepositoryV1,
  ProvisioningTransactionPortV1,
  ProvisioningTripletSnapshotV1,
} from './provisioning-ports';

export interface ProvisioningAssessmentCountsV1 {
  readonly input: number;
  readonly insertedCandidate: number;
  readonly reusedCandidate: number;
  readonly conflict: number;
  readonly unexpected: number;
}

export type ProvisioningEntryClassificationV1 =
  | 'insertedCandidate'
  | 'reusedCandidate'
  | 'conflict'
  | 'unexpected';

export class ProvisioningKernelError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ProvisioningKernelError';
  }
}

function sameRecord<A extends object, E extends object>(
  actual: A,
  expected: E,
): boolean {
  const actualRecord = actual as Record<string, unknown>;
  const expectedRecord = expected as Record<string, unknown>;
  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(actual).filter(
    (key) => key !== 'createdAt' && key !== 'updatedAt',
  );
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => actualRecord[key] === expectedRecord[key])
  );
}

function classifySnapshot(
  tenantExists: boolean,
  snapshot: ProvisioningTripletSnapshotV1,
  expected: ProvisioningExpectedTripletV1,
): ProvisioningEntryClassificationV1 {
  if (!tenantExists) {
    return 'conflict';
  }
  const total =
    snapshot.scopes.length + snapshot.versions.length + snapshot.heads.length;
  if (total === 0) {
    return 'insertedCandidate';
  }
  if (
    snapshot.scopes.length > 1 ||
    snapshot.versions.length > 1 ||
    snapshot.heads.length > 1
  ) {
    return 'unexpected';
  }
  if (
    snapshot.scopes.length !== 1 ||
    snapshot.versions.length !== 1 ||
    snapshot.heads.length !== 1
  ) {
    return 'conflict';
  }
  return sameRecord(snapshot.scopes[0], expected.scope) &&
    sameRecord(snapshot.versions[0], expected.version) &&
    sameRecord(snapshot.heads[0], expected.head)
    ? 'reusedCandidate'
    : 'conflict';
}

async function classifyEntry(
  repository: ProvisioningRepositoryV1,
  manifest: ProvisioningManifestV1,
  entry: ProvisioningCanonicalEntryV1,
): Promise<ProvisioningEntryClassificationV1> {
  const tenantExists = await repository.tenantExists(entry.tenantId);
  if (!tenantExists) {
    return 'conflict';
  }
  const snapshot = await repository.readTriplet({
    tenantId: entry.tenantId,
    institutionId: entry.institutionId,
  });
  return classifySnapshot(
    tenantExists,
    snapshot,
    toProvisioningExpectedTriplet(manifest, entry),
  );
}

type MutableProvisioningAssessmentCountsV1 = {
  -readonly [Key in keyof ProvisioningAssessmentCountsV1]:
    ProvisioningAssessmentCountsV1[Key];
};

function emptyCounts(input: number): MutableProvisioningAssessmentCountsV1 {
  return {
    input,
    insertedCandidate: 0,
    reusedCandidate: 0,
    conflict: 0,
    unexpected: 0,
  };
}

async function classifyBatch(
  repository: ProvisioningRepositoryV1,
  manifest: ProvisioningManifestV1,
): Promise<{
  readonly counts: ProvisioningAssessmentCountsV1;
  readonly classifications: readonly ProvisioningEntryClassificationV1[];
}> {
  const counts = emptyCounts(manifest.entries.length);
  const classifications: ProvisioningEntryClassificationV1[] = [];
  for (const entry of manifest.entries) {
    let classification: ProvisioningEntryClassificationV1;
    try {
      classification = await classifyEntry(repository, manifest, entry);
    } catch {
      classification = 'unexpected';
    }
    classifications.push(classification);
    counts[classification] += 1;
  }
  return {
    counts: Object.freeze({ ...counts }),
    classifications: Object.freeze(classifications),
  };
}

export function hasConservedProvisioningCounts(
  counts: ProvisioningAssessmentCountsV1,
): boolean {
  return (
    counts.input ===
    counts.insertedCandidate +
      counts.reusedCandidate +
      counts.conflict +
      counts.unexpected
  );
}

export async function dryRunProvisioning(
  manifest: ProvisioningManifestV1,
  transactionPort: ProvisioningTransactionPortV1,
): Promise<ProvisioningAssessmentCountsV1> {
  assertParsedProvisioningManifest(manifest);
  try {
    const result = await transactionPort.read((repository) =>
      classifyBatch(repository, manifest),
    );
    if (!hasConservedProvisioningCounts(result.counts)) {
      throw new ProvisioningKernelError('provisioning_count_invariant_failed');
    }
    return result.counts;
  } catch (error) {
    if (error instanceof ProvisioningKernelError) {
      throw error;
    }
    throw new ProvisioningKernelError('provisioning_read_failed');
  }
}

export interface ExecuteProvisioningInputV1 {
  readonly manifest: ProvisioningManifestV1;
  readonly transactionPort: ProvisioningTransactionPortV1;
  readonly leasePayload: unknown;
  readonly leaseAuthority: ProvisioningLeaseAuthorityPortV1;
  readonly leaseExpectation: Omit<
    ProvisioningLeaseExpectationV1,
    'manifestDigest' | 'entryKeysDigest' | 'entryCount' | 'approverReference'
  >;
  /**
   * 仅允许受信主机 Clock。生产组合不得从 Manifest、argv、环境变量、请求
   * 或调用方业务时间派生；当前可注入形式只用于合成契约测试。
   */
  readonly now: Date;
}

export async function executeProvisioning(
  input: ExecuteProvisioningInputV1,
): Promise<ProvisioningAssessmentCountsV1> {
  assertParsedProvisioningManifest(input.manifest);
  await verifyProvisioningExecutionLease(
    input.leasePayload,
    input.leaseAuthority,
    {
      ...input.leaseExpectation,
      manifestDigest: input.manifest.digest,
      entryKeysDigest: computeProvisioningEntryKeysDigest(
        input.manifest.entries,
      ),
      entryCount: input.manifest.entries.length,
      approverReference: input.manifest.approvedByReference,
    },
    input.now,
  );

  try {
    return await input.transactionPort.write(async (repository) => {
      const assessment = await classifyBatch(repository, input.manifest);
      if (
        assessment.counts.conflict > 0 ||
        assessment.counts.unexpected > 0
      ) {
        throw new ProvisioningKernelError('provisioning_batch_blocked');
      }

      for (let index = 0; index < input.manifest.entries.length; index += 1) {
        if (assessment.classifications[index] !== 'insertedCandidate') {
          continue;
        }
        const expected = toProvisioningExpectedTriplet(
          input.manifest,
          input.manifest.entries[index],
        );
        const scopeRows = await repository.insertScope(expected.scope);
        const versionRows = await repository.insertContextVersion(
          expected.version,
        );
        const headRows = await repository.insertContextHead(expected.head);
        if (scopeRows !== 1 || versionRows !== 1 || headRows !== 1) {
          throw new ProvisioningKernelError(
            'provisioning_write_count_invalid',
          );
        }
      }

      const commitAssessment = await classifyBatch(
        repository,
        input.manifest,
      );
      if (
        commitAssessment.counts.reusedCandidate !==
          input.manifest.entries.length ||
        commitAssessment.counts.insertedCandidate > 0 ||
        commitAssessment.counts.conflict > 0 ||
        commitAssessment.counts.unexpected > 0
      ) {
        throw new ProvisioningKernelError(
          'provisioning_commit_recheck_failed',
        );
      }
      if (!hasConservedProvisioningCounts(assessment.counts)) {
        throw new ProvisioningKernelError(
          'provisioning_count_invariant_failed',
        );
      }
      return assessment.counts;
    });
  } catch (error) {
    if (error instanceof ProvisioningKernelError) {
      throw error;
    }
    throw new ProvisioningKernelError('provisioning_transaction_failed');
  }
}
