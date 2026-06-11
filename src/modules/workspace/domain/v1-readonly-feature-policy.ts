export type V1ReadonlyFeaturePolicyStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'exception'
  | 'ready';

export type V1ReadonlyFeaturePolicyResultCode =
  | 'skipped'
  | 'denied'
  | 'empty'
  | 'unavailable'
  | 'readonly';

export type V1ReadonlyFeaturePolicyReasonCodes<
  TEmptyReasonCode extends string = string,
  TExceptionReasonCode extends string = string,
  TReadyReasonCode extends string = string,
> = {
  empty: TEmptyReasonCode;
  exception: TExceptionReasonCode;
  ready: TReadyReasonCode;
};

export type V1ReadonlyFeaturePolicyCopies = {
  disabled: string;
  denied: string;
  empty: string;
  exception: string;
};

export type V1ReadonlyFeaturePolicyInput<
  TEmptyReasonCode extends string = string,
  TExceptionReasonCode extends string = string,
  TReadyReasonCode extends string = string,
> = {
  featureEnabled: boolean;
  tenantScopeMatched: boolean;
  canRead: boolean;
  candidateCount: number;
  readonlyItemCount?: number;
  reasonCodes: V1ReadonlyFeaturePolicyReasonCodes<
    TEmptyReasonCode,
    TExceptionReasonCode,
    TReadyReasonCode
  >;
  copies: V1ReadonlyFeaturePolicyCopies;
};

export type V1ReadonlyFeaturePolicyReasonCode<
  TEmptyReasonCode extends string = string,
  TExceptionReasonCode extends string = string,
  TReadyReasonCode extends string = string,
> =
  | 'feature_flag_disabled'
  | 'tenant_scope_mismatch'
  | 'permission_denied'
  | TEmptyReasonCode
  | TExceptionReasonCode
  | TReadyReasonCode;

export type V1ReadonlyFeaturePolicyEvaluation<
  TEmptyReasonCode extends string = string,
  TExceptionReasonCode extends string = string,
  TReadyReasonCode extends string = string,
> = {
  status: V1ReadonlyFeaturePolicyStatus;
  reasonCode: V1ReadonlyFeaturePolicyReasonCode<
    TEmptyReasonCode,
    TExceptionReasonCode,
    TReadyReasonCode
  >;
  resultCode: V1ReadonlyFeaturePolicyResultCode;
  readonly: true;
  emptyCopy?: string;
  exceptionCopy?: string;
};

export function evaluateV1ReadonlyFeaturePolicy<
  TEmptyReasonCode extends string,
  TExceptionReasonCode extends string,
  TReadyReasonCode extends string,
>(
  input: V1ReadonlyFeaturePolicyInput<
    TEmptyReasonCode,
    TExceptionReasonCode,
    TReadyReasonCode
  >,
): V1ReadonlyFeaturePolicyEvaluation<
  TEmptyReasonCode,
  TExceptionReasonCode,
  TReadyReasonCode
> {
  if (!input.featureEnabled) {
    return {
      status: 'disabled',
      reasonCode: 'feature_flag_disabled',
      resultCode: 'skipped',
      readonly: true,
      emptyCopy: input.copies.disabled,
    };
  }

  if (!input.tenantScopeMatched) {
    return {
      status: 'denied',
      reasonCode: 'tenant_scope_mismatch',
      resultCode: 'denied',
      readonly: true,
      exceptionCopy: input.copies.denied,
    };
  }

  if (!input.canRead) {
    return {
      status: 'denied',
      reasonCode: 'permission_denied',
      resultCode: 'denied',
      readonly: true,
      exceptionCopy: input.copies.denied,
    };
  }

  if (input.candidateCount === 0) {
    return {
      status: 'empty',
      reasonCode: input.reasonCodes.empty,
      resultCode: 'empty',
      readonly: true,
      emptyCopy: input.copies.empty,
    };
  }

  if (input.readonlyItemCount === 0) {
    return {
      status: 'exception',
      reasonCode: input.reasonCodes.exception,
      resultCode: 'unavailable',
      readonly: true,
      exceptionCopy: input.copies.exception,
    };
  }

  return {
    status: 'ready',
    reasonCode: input.reasonCodes.ready,
    resultCode: 'readonly',
    readonly: true,
  };
}
