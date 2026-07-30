import { constants as fsConstants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  executeProvisioning,
  dryRunProvisioning,
  ProvisioningKernelError,
} from '../../src/modules/tenancy/provisioning/provisioning-kernel.ts';
import {
  parseProvisioningManifest,
  ProvisioningManifestError,
} from '../../src/modules/tenancy/provisioning/provisioning-manifest.ts';
import { ProvisioningLeaseError } from '../../src/modules/tenancy/provisioning/provisioning-lease.ts';

const MAX_MANIFEST_BYTES = 1024 * 1024;
const ALLOWED_MANIFEST_MODES = new Set([0o400, 0o600]);
const O_NOFOLLOW = fsConstants.O_NOFOLLOW;

class ProvisioningRunnerError extends Error {
  constructor(code, exitCode = 2) {
    super(code);
    this.name = 'ProvisioningRunnerError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

function fail(code, exitCode = 2) {
  throw new ProvisioningRunnerError(code, exitCode);
}

export function parseRunnerArguments(argv) {
  if (!Array.isArray(argv)) {
    fail('runner_arguments_invalid');
  }
  const tokens = argv[0] === '--' ? argv.slice(1) : [...argv];
  let mode = 'dry-run';
  let explicitMode = false;
  let manifestFile = null;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--manifest-file') {
      if (manifestFile !== null || index + 1 >= tokens.length) {
        fail('runner_arguments_invalid');
      }
      const candidate = tokens[index + 1];
      if (
        typeof candidate !== 'string' ||
        candidate.length === 0 ||
        candidate.length > 4096 ||
        !path.isAbsolute(candidate) ||
        candidate.startsWith('--') ||
        /[\u0000-\u001f\u007f{}"']/.test(candidate) ||
        candidate.includes('[') ||
        candidate.includes(']')
      ) {
        fail('runner_arguments_invalid');
      }
      manifestFile = candidate;
      index += 1;
    } else if (token === '--dry-run' || token === '--execute') {
      if (explicitMode) {
        fail('runner_arguments_invalid');
      }
      explicitMode = true;
      mode = token === '--execute' ? 'execute' : 'dry-run';
    } else {
      fail('runner_arguments_invalid');
    }
  }

  if (manifestFile === null) {
    fail('runner_manifest_file_required');
  }
  return Object.freeze({ mode, manifestFile });
}

function assertJsonHasNoDuplicateKeys(source) {
  let index = 0;
  const invalid = () => fail('runner_manifest_json_invalid');
  const whitespace = () => {
    while (
      source[index] === ' ' ||
      source[index] === '\n' ||
      source[index] === '\r' ||
      source[index] === '\t'
    ) {
      index += 1;
    }
  };
  const parseString = () => {
    if (source[index] !== '"') invalid();
    const start = index;
    index += 1;
    while (index < source.length) {
      const character = source[index];
      if (character === '"') {
        index += 1;
        try {
          return JSON.parse(source.slice(start, index));
        } catch {
          invalid();
        }
      }
      if (character === '\\') {
        index += 1;
        const escape = source[index];
        if (escape === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(source.slice(index + 1, index + 5))) {
            invalid();
          }
          index += 5;
          continue;
        }
        if (!'"\\/bfnrt'.includes(escape)) invalid();
        index += 1;
        continue;
      }
      if (character.charCodeAt(0) <= 0x1f) invalid();
      index += 1;
    }
    invalid();
  };
  const parseNumber = () => {
    const match = source
      .slice(index)
      .match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!match) invalid();
    index += match[0].length;
  };
  const parseLiteral = (literal) => {
    if (source.slice(index, index + literal.length) !== literal) invalid();
    index += literal.length;
  };
  const parseValue = () => {
    whitespace();
    const character = source[index];
    if (character === '{') {
      index += 1;
      whitespace();
      const keys = new Set();
      if (source[index] === '}') {
        index += 1;
        return;
      }
      while (index < source.length) {
        const key = parseString();
        if (keys.has(key)) fail('runner_manifest_duplicate_json_key');
        keys.add(key);
        whitespace();
        if (source[index] !== ':') invalid();
        index += 1;
        parseValue();
        whitespace();
        if (source[index] === '}') {
          index += 1;
          return;
        }
        if (source[index] !== ',') invalid();
        index += 1;
        whitespace();
      }
      invalid();
    }
    if (character === '[') {
      index += 1;
      whitespace();
      if (source[index] === ']') {
        index += 1;
        return;
      }
      while (index < source.length) {
        parseValue();
        whitespace();
        if (source[index] === ']') {
          index += 1;
          return;
        }
        if (source[index] !== ',') invalid();
        index += 1;
      }
      invalid();
    }
    if (character === '"') {
      parseString();
      return;
    }
    if (character === '-' || (character >= '0' && character <= '9')) {
      parseNumber();
      return;
    }
    if (character === 't') {
      parseLiteral('true');
      return;
    }
    if (character === 'f') {
      parseLiteral('false');
      return;
    }
    if (character === 'n') {
      parseLiteral('null');
      return;
    }
    invalid();
  };

  parseValue();
  whitespace();
  if (index !== source.length) invalid();
}

function fileIdentityMatches(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.uid === right.uid &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.nlink === right.nlink &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function validateFileStat(stat, currentUid) {
  const mode = Number(stat.mode & 0o7777n);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1n ||
    stat.uid !== BigInt(currentUid) ||
    !ALLOWED_MANIFEST_MODES.has(mode) ||
    stat.size <= 0n ||
    stat.size > BigInt(MAX_MANIFEST_BYTES)
  ) {
    fail('runner_manifest_file_unsafe');
  }
}

async function readBounded(fileHandle, expectedSize) {
  const chunks = [];
  let offset = 0;
  while (offset <= MAX_MANIFEST_BYTES) {
    const remaining = MAX_MANIFEST_BYTES + 1 - offset;
    const buffer = Buffer.alloc(Math.min(64 * 1024, remaining));
    const { bytesRead } = await fileHandle.read(
      buffer,
      0,
      buffer.length,
      offset,
    );
    if (bytesRead === 0) break;
    chunks.push(buffer.subarray(0, bytesRead));
    offset += bytesRead;
  }
  if (offset !== expectedSize || offset > MAX_MANIFEST_BYTES) {
    fail('runner_manifest_file_changed');
  }
  return Buffer.concat(chunks, offset);
}

export async function readManifestFileSecure(
  manifestFile,
  dependencies = {},
) {
  if (typeof O_NOFOLLOW !== 'number') {
    fail('runner_nofollow_unavailable');
  }
  const currentUid =
    dependencies.currentUid ??
    (typeof process.getuid === 'function' ? process.getuid() : null);
  if (!Number.isSafeInteger(currentUid) || currentUid < 0) {
    fail('runner_identity_unavailable');
  }
  const lstatFile = dependencies.lstat ?? lstat;
  const openFile = dependencies.open ?? open;
  let before;
  let fileHandle;
  try {
    before = await lstatFile(manifestFile, { bigint: true });
    validateFileStat(before, currentUid);
    fileHandle = await openFile(
      manifestFile,
      fsConstants.O_RDONLY | O_NOFOLLOW,
    );
    const opened = await fileHandle.stat({ bigint: true });
    validateFileStat(opened, currentUid);
    if (!fileIdentityMatches(before, opened)) {
      fail('runner_manifest_file_changed');
    }

    const bytes = await readBounded(fileHandle, Number(opened.size));
    const afterOpen = await fileHandle.stat({ bigint: true });
    const afterPath = await lstatFile(manifestFile, { bigint: true });
    validateFileStat(afterOpen, currentUid);
    validateFileStat(afterPath, currentUid);
    if (
      !fileIdentityMatches(opened, afterOpen) ||
      !fileIdentityMatches(opened, afterPath)
    ) {
      fail('runner_manifest_file_changed');
    }

    let text;
    try {
      text = new TextDecoder('utf-8', {
        fatal: true,
        ignoreBOM: true,
      }).decode(bytes);
    } catch {
      fail('runner_manifest_encoding_invalid');
    }
    if (text.charCodeAt(0) === 0xfeff) {
      fail('runner_manifest_encoding_invalid');
    }
    assertJsonHasNoDuplicateKeys(text);
    try {
      return JSON.parse(text);
    } catch {
      fail('runner_manifest_json_invalid');
    }
  } catch (error) {
    if (error instanceof ProvisioningRunnerError) {
      throw error;
    }
    fail('runner_manifest_file_unavailable');
  } finally {
    await fileHandle?.close().catch(() => undefined);
  }
}

function lowSensitiveError(error) {
  if (error instanceof ProvisioningRunnerError) {
    return error.code;
  }
  if (error instanceof ProvisioningManifestError) {
    return 'runner_manifest_contract_invalid';
  }
  if (error instanceof ProvisioningLeaseError) {
    return 'runner_execution_lease_invalid';
  }
  if (error instanceof ProvisioningKernelError) {
    if (error.code === 'provisioning_batch_blocked') {
      return 'runner_provisioning_conflict';
    }
    if (error.code === 'provisioning_transaction_failed') {
      return 'runner_provisioning_transaction_failed';
    }
    return 'runner_provisioning_unavailable';
  }
  return 'runner_unexpected_failure';
}

export async function runProvisioningCli(options = {}) {
  const output = options.output ?? {
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  };
  try {
    const args = parseRunnerArguments(options.argv ?? process.argv.slice(2));
    if (!options.contextPolicy) {
      fail('runner_context_policy_unavailable', 3);
    }
    const rawManifest = await readManifestFileSecure(
      args.manifestFile,
      options.fileDependencies,
    );
    const manifest = parseProvisioningManifest(rawManifest, {
      contextPolicy: options.contextPolicy,
    });
    if (!options.transactionPort) {
      fail('runner_repository_adapter_unavailable', 3);
    }

    let counts;
    if (args.mode === 'dry-run') {
      counts = await dryRunProvisioning(manifest, options.transactionPort);
    } else {
      if (
        !options.leasePayload ||
        !options.leaseAuthority ||
        !options.leaseExpectation
      ) {
        fail('runner_execution_authorization_unavailable', 3);
      }
      counts = await executeProvisioning({
        manifest,
        transactionPort: options.transactionPort,
        leasePayload: options.leasePayload,
        leaseAuthority: options.leaseAuthority,
        leaseExpectation: options.leaseExpectation,
        now: options.now ?? new Date(),
      });
    }

    output.stdout(
      JSON.stringify({
        input: counts.input,
        insertedCandidate: counts.insertedCandidate,
        reusedCandidate: counts.reusedCandidate,
        conflict: counts.conflict,
        unexpected: counts.unexpected,
      }),
    );
    return 0;
  } catch (error) {
    output.stderr(JSON.stringify({ code: lowSensitiveError(error) }));
    return error instanceof ProvisioningRunnerError ? error.exitCode : 4;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await runProvisioningCli();
}
