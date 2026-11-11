export function getRequiredJwtSecret(rawSecret = process.env.JWT_SECRET): string {
  const normalized = typeof rawSecret === 'string' ? rawSecret.trim() : '';
  if (!normalized) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is required and must be a non-empty secret.',
    );
  }
  return normalized;
}

