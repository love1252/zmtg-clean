export type StrictDataRecordSnapshot = Readonly<Record<string, unknown>>;

/**
 * Captures an untrusted plain object exactly once through own property descriptors. Callers must
 * validate the returned snapshot rather than reading the original object again. Symbols,
 * accessors, non-enumerable fields, arrays, and class instances are rejected.
 */
export function snapshotStrictDataRecord(
  value: unknown,
): StrictDataRecordSnapshot | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some((key) => typeof key !== 'string')) return null;

    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of keys as string[]) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
      Object.defineProperty(snapshot, key, {
        value: descriptor.value,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }

    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

export function hasExactSnapshotKeys(
  snapshot: StrictDataRecordSnapshot,
  expectedKeys: readonly string[],
): boolean {
  try {
    const descriptors = Object.getOwnPropertyDescriptors(snapshot);
    const actualKeys = Reflect.ownKeys(descriptors);
    if (
      actualKeys.length !== expectedKeys.length ||
      actualKeys.some((key) => typeof key !== 'string') ||
      expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(descriptors, key))
    ) {
      return false;
    }

    return expectedKeys.every((key) => {
      const descriptor = descriptors[key];
      return Boolean(descriptor?.enumerable && 'value' in descriptor);
    });
  } catch {
    return false;
  }
}

export function snapshotExactDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
): StrictDataRecordSnapshot | null {
  const snapshot = snapshotStrictDataRecord(value);
  return snapshot && hasExactSnapshotKeys(snapshot, expectedKeys) ? snapshot : null;
}

/** Captures a dense, ordinary array once and rejects holes, accessors, symbols, and extra keys. */
export function snapshotStrictArray(
  value: unknown,
  maximumLength: number,
): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const descriptorMap = descriptors as unknown as Record<
      PropertyKey,
      PropertyDescriptor
    >;
    const descriptorKeys = Reflect.ownKeys(descriptors);
    if (descriptorKeys.some((key) => typeof key !== 'string')) return null;

    const lengthDescriptor = descriptorMap.length;
    if (!lengthDescriptor || !('value' in lengthDescriptor)) return null;
    const length = lengthDescriptor.value;
    if (
      typeof length !== 'number' ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > maximumLength
    ) {
      return null;
    }

    const expectedKeys = [
      ...Array.from({ length }, (_, index) => String(index)),
      'length',
    ];
    if (
      descriptorKeys.length !== expectedKeys.length ||
      expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(descriptorMap, key))
    ) {
      return null;
    }

    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptorMap[String(index)];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
      snapshot.push(descriptor.value);
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}
