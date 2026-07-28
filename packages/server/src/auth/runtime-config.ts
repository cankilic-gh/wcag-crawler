export interface AuthRuntimeConfig {
  googleClientId: string;
  adminEmails: string[];
}

export function resolveAuthRuntimeConfig(
  env: Record<string, string | undefined>,
): AuthRuntimeConfig {
  const googleClientId = env.GOOGLE_CLIENT_ID?.trim() ?? '';
  const adminEmails = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);

  if (env.NODE_ENV === 'production') {
    if (!googleClientId) throw new Error('GOOGLE_CLIENT_ID is required in production');
    if (adminEmails.length === 0) throw new Error('ADMIN_EMAILS is required in production');
  }

  return { googleClientId, adminEmails };
}
