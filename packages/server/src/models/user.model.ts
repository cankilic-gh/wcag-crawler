import { getDatabase } from '../db/database.js';
import type { VerifiedGoogleIdentity } from '../auth/principal.js';

export interface User {
  googleSub: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  createdAt: string;
  lastSeenAt: string;
}

interface UserRow {
  google_sub: string;
  email: string;
  name: string | null;
  picture_url: string | null;
  created_at: string;
  last_seen_at: string;
}

function toUser(row: UserRow): User {
  return {
    googleSub: row.google_sub,
    email: row.email,
    name: row.name,
    pictureUrl: row.picture_url,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export const UserModel = {
  upsertGoogleIdentity(identity: VerifiedGoogleIdentity): User {
    const database = getDatabase();
    database.prepare(`
      INSERT INTO users (google_sub, email, name, picture_url, last_seen_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(google_sub) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        picture_url = excluded.picture_url,
        last_seen_at = CURRENT_TIMESTAMP
    `).run(identity.sub, identity.email.trim().toLowerCase(), identity.name, identity.pictureUrl);
    return this.findByGoogleSub(identity.sub)!;
  },

  findByGoogleSub(googleSub: string): User | null {
    const row = getDatabase().prepare(
      'SELECT * FROM users WHERE google_sub = ?',
    ).get(googleSub) as UserRow | undefined;
    return row ? toUser(row) : null;
  },
};
