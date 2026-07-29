export type AccessRole = 'anonymous' | 'user' | 'admin';

export interface ClientTierPolicy {
  /** Page-count cap. `null` means unlimited (admin), mirroring the server. */
  maxPages: number | null;
  maxDepth: number;
  concurrency: number;
  allowAuthentication: boolean;
}

const POLICIES: Record<AccessRole, ClientTierPolicy> = {
  anonymous: { maxPages: 10, maxDepth: 2, concurrency: 1, allowAuthentication: false },
  user: { maxPages: 50, maxDepth: 3, concurrency: 2, allowAuthentication: false },
  admin: { maxPages: null, maxDepth: 5, concurrency: 3, allowAuthentication: true },
};

export function clientPolicyForRole(role: AccessRole): ClientTierPolicy {
  return POLICIES[role];
}
