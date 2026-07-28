import type { RequestHandler, Response } from 'express';
import type { IdentityVerifier } from './identity-verifier.js';
import {
  principalFromIdentity,
  type Principal,
} from './principal.js';
import { UserModel } from '../models/user.model.js';

const ANONYMOUS_PRINCIPAL: Principal = { kind: 'anonymous' };
const PRINCIPAL_LOCAL = 'principal';

export interface OptionalAuthOptions {
  verifier: IdentityVerifier;
  adminEmails: readonly string[];
}

export function getPrincipal(res: Response): Principal {
  return (res.locals[PRINCIPAL_LOCAL] as Principal | undefined) ?? ANONYMOUS_PRINCIPAL;
}

export function createOptionalAuthMiddleware(options: OptionalAuthOptions): RequestHandler {
  return async (req, res, next) => {
    const authorization = req.header('Authorization');
    if (!authorization) {
      res.locals[PRINCIPAL_LOCAL] = ANONYMOUS_PRINCIPAL;
      next();
      return;
    }

    const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
    if (!match) {
      res.status(401).json({ code: 'invalid_identity_token', error: 'Unauthorized' });
      return;
    }

    try {
      const identity = await options.verifier.verify(match[1]);
      const principal = principalFromIdentity(identity, options.adminEmails);
      UserModel.upsertGoogleIdentity(identity);
      res.locals[PRINCIPAL_LOCAL] = principal;
      next();
    } catch {
      res.status(401).json({ code: 'invalid_identity_token', error: 'Unauthorized' });
    }
  };
}
