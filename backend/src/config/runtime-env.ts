type CorsCallback = (error: Error | null, allow?: boolean) => void;

const LOCAL_FRONTEND_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function normalizeOrigin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function parseOriginList(value: string | undefined): string[] {
  if (!value) return [];

  return [
    ...new Set(
      value
        .split(',')
        .map(normalizeOrigin)
        .filter((origin) => Boolean(origin) && origin !== '*'),
    ),
  ];
}

export function getAllowedCorsOrigins(): string[] {
  const configuredOrigins = [
    ...parseOriginList(process.env.FRONTEND_URL),
    ...parseOriginList(process.env.CORS_ALLOWED_ORIGINS),
  ];

  return configuredOrigins.length > 0
    ? [...new Set(configuredOrigins)]
    : LOCAL_FRONTEND_ORIGINS;
}

export function createCorsOriginDelegate(): (
  origin: string | undefined,
  callback: CorsCallback,
) => void {
  const allowedOrigins = new Set(getAllowedCorsOrigins());

  return (origin, callback) => {
    const normalized = origin ? normalizeOrigin(origin) : '';
    const isProd = process.env.NODE_ENV === 'production';
    const isAllowed = normalized && allowedOrigins.has(normalized);

    if (!isProd) {
      if (!origin || isAllowed) {
        callback(null, true);
        return;
      }
    } else if (isAllowed) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  };
}
