export type FriendlyErrorKind = 'auth' | 'network' | 'location' | 'validation' | 'server';

export interface FriendlyErrorResult {
  title: string;
  message: string;
  kind: FriendlyErrorKind;
  isTechnicalHidden: boolean;
}

const TECHNICAL_PATTERNS: RegExp[] = [
  /econnrefused/i,
  /enotfound/i,
  /etimedout/i,
  /econnreset/i,
  /network error/i,
  /cannot reach the server/i,
  /err_network/i,
  /econnaborted/i,
  /timeout of \d+ms exceeded/i,
  /relation ".*" does not exist/i,
  /column ".*" does not exist/i,
  /syntax error at or near/i,
  /connect econn/i,
  /connection terminated/i,
  /neon/i,
  /postgres/i,
  /pool/i,
  /sequelize/i,
  /request failed with status code/i,
  /^\[api error\]/i,
  /getaddrinfo/i,
];

function extractRawDetails(err: unknown): {
  status?: number;
  url: string;
  rawMessage: string;
} {
  if (typeof err === 'string') {
    return { rawMessage: err.trim(), url: '' };
  }
  if (!err || typeof err !== 'object') {
    return { rawMessage: '', url: '' };
  }

  const anyErr = err as Record<string, any>;
  const status: number | undefined =
    typeof anyErr.status === 'number'
      ? anyErr.status
      : typeof anyErr?.response?.status === 'number'
        ? anyErr.response.status
        : undefined;
  const url = String(anyErr?.config?.url || anyErr?.url || '');
  const candidate =
    anyErr?.response?.data?.error ||
    anyErr?.response?.data?.message ||
    anyErr?.rawMessage ||
    anyErr?.message ||
    '';

  return {
    status,
    url,
    rawMessage: String(candidate || '').trim(),
  };
}

/**
 * Converts technical HTTP, network, database, or location errors into calm,
 * user-friendly copy suitable for popups and banners.
 */
export function getFriendlyError(
  err: unknown,
  fallbackContext?: 'login' | 'register' | 'location' | 'checkout' | 'general'
): FriendlyErrorResult {
  const { status, url, rawMessage } = extractRawDetails(err);
  const lower = rawMessage.toLowerCase();

  const isAuthLogin =
    fallbackContext === 'login' ||
    /\/auth\/login/i.test(url) ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid email or password') ||
    lower.includes('wrong password') ||
    lower.includes('incorrect password');

  if (isAuthLogin && (status === 401 || status === 400 || lower.includes('invalid') || lower.includes('credential') || lower.includes('password'))) {
    return {
      title: "Couldn't Sign You In",
      message: "Your email or password didn't match our records. Please double-check your details and try again.",
      kind: 'auth',
      isTechnicalHidden: true,
    };
  }

  if (
    status === 409 ||
    (lower.includes('already') && (lower.includes('exist') || lower.includes('registered') || lower.includes('taken') || lower.includes('in use')))
  ) {
    return {
      title: 'Account Already Exists',
      message: 'An account with this email or phone number already exists. Try signing in instead.',
      kind: 'auth',
      isTechnicalHidden: true,
    };
  }

  if (status === 401) {
    return {
      title: 'Please Sign In Again',
      message: 'Your session expired for your security. Please sign in again to continue.',
      kind: 'auth',
      isTechnicalHidden: true,
    };
  }

  if (
    fallbackContext === 'location' ||
    lower.includes('location services') ||
    lower.includes('location is unavailable') ||
    lower.includes('permission to access location') ||
    lower.includes('error getting location') ||
    lower.includes('kclerror') ||
    lower.includes('current location is unavailable')
  ) {
    return {
      title: 'Location Is Off',
      message: 'Turn on your device location or choose a saved delivery address so we can show restaurants near you.',
      kind: 'location',
      isTechnicalHidden: true,
    };
  }

  const isDbIssue =
    status === 503 ||
    lower.includes('database') ||
    lower.includes('postgres') ||
    lower.includes('neon') ||
    lower.includes('econnrefused') ||
    lower.includes('pool');

  if (isDbIssue) {
    return {
      title: 'Service Temporarily Unavailable',
      message: 'We are having a temporary connection hiccup on our side. Please try again in a few moments.',
      kind: 'server',
      isTechnicalHidden: true,
    };
  }

  if (
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('cannot reach the server') ||
    lower.includes('err_network') ||
    lower.includes('econnaborted') ||
    lower.includes('internet') ||
    lower.includes('offline')
  ) {
    return {
      title: 'Connection Issue',
      message: "We're having trouble connecting right now. Please check your internet connection and try again.",
      kind: 'network',
      isTechnicalHidden: true,
    };
  }

  const looksTechnical =
    TECHNICAL_PATTERNS.some((rx) => rx.test(rawMessage)) ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504;

  if (looksTechnical && lower.includes('connection')) {
    return {
      title: 'Service Temporarily Unavailable',
      message: 'We are having a temporary connection hiccup on our side. Please try again in a few moments.',
      kind: 'server',
      isTechnicalHidden: true,
    };
  }

  if (status && status >= 500) {
    return {
      title: 'Something Went Wrong',
      message: 'We could not complete your request right now. Please try again in a moment.',
      kind: 'server',
      isTechnicalHidden: true,
    };
  }

  if (looksTechnical || !rawMessage) {
    return {
      title: 'Something Went Wrong',
      message: 'Please check your connection and try again in a moment.',
      kind: 'server',
      isTechnicalHidden: true,
    };
  }

  // Clean business validation messages (e.g. "Outside delivery radius", "Restaurant is currently closed")
  const cleaned = rawMessage
    .replace(/^error:\s*/i, '')
    .replace(/^\[api error\][^:]*:\s*/i, '')
    .trim();

  return {
    title: fallbackContext === 'checkout' ? 'Order Needs Attention' : 'Notice',
    message: cleaned || 'Please try again in a moment.',
    kind: 'validation',
    isTechnicalHidden: false,
  };
}

export function getFriendlyErrorMessage(
  err: unknown,
  fallbackContext?: 'login' | 'register' | 'location' | 'checkout' | 'general'
): string {
  return getFriendlyError(err, fallbackContext).message;
}
