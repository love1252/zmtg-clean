const validationFailure = Object.freeze({
  ok: false as const,
  reasonCode: 'csrf_validation_failed' as const,
});

const validationSuccess = Object.freeze({ ok: true as const });

export type SameOriginMutationValidationResult =
  | typeof validationSuccess
  | typeof validationFailure;

export function validateSameOriginMutationRequest(
  request: Request,
): SameOriginMutationValidationResult {
  const originHeader = request.headers.get('origin');
  if (!originHeader || originHeader === 'null' || originHeader.includes(',')) {
    return validationFailure;
  }

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite !== null && fetchSite !== 'same-origin') {
    return validationFailure;
  }

  try {
    const requestUrl = new URL(request.url);
    const requestOrigin = requestUrl.origin;
    const suppliedOrigin = new URL(originHeader);
    if (
      (suppliedOrigin.protocol !== 'http:' && suppliedOrigin.protocol !== 'https:')
      || suppliedOrigin.username !== ''
      || suppliedOrigin.password !== ''
      || suppliedOrigin.pathname !== '/'
      || suppliedOrigin.search !== ''
      || suppliedOrigin.hash !== ''
      || originHeader !== suppliedOrigin.origin
      || suppliedOrigin.origin !== requestOrigin
    ) {
      return validationFailure;
    }
  } catch {
    return validationFailure;
  }

  return validationSuccess;
}
