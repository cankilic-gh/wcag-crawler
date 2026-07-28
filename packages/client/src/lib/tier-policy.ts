export type AccessRole = 'anonymous' | 'user' | 'admin';

export interface ClientTierPolicy {
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  allowAuthentication: boolean;
}

const POLICIES: Record<AccessRole, ClientTierPolicy> = {
  anonymous: { maxPages: 10, maxDepth: 2, concurrency: 1, allowAuthentication: false },
  user: { maxPages: 50, maxDepth: 3, concurrency: 2, allowAuthentication: false },
  admin: { maxPages: 100, maxDepth: 5, concurrency: 3, allowAuthentication: true },
};

export function clientPolicyForRole(role: AccessRole): ClientTierPolicy {
  return POLICIES[role];
}
