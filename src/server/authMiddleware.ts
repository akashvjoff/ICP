import type { Request, Response, NextFunction } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getBearerToken } from './upload';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  accessToken?: string;
}

export interface AuthMiddlewareConfig {
  isSupabaseConfigured: boolean;
  serverSupabase?: SupabaseClient | null;
  isProduction?: boolean;
  allowProductionDemo?: boolean;
}

export function createRequireAuthenticatedUser(config: AuthMiddlewareConfig) {
  return async function requireAuthenticatedUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const token = getBearerToken(req.headers.authorization);

    if (!config.isSupabaseConfigured) {
      if (config.isProduction && !config.allowProductionDemo) {
        res.status(503).json({
          error: 'Production authentication is not configured. Server is operating in secure fail-closed mode.',
        });
        return;
      }
      req.user = { id: 'demo-user-id', email: 'alex@synthetix.io' };
      req.accessToken = token || 'demo-token';
      return next();
    }

    // Production Mode: must be an authenticated session; demo tokens and missing tokens are rejected
    if (!token || token === 'demo-token') {
      res.status(401).json({ error: 'Sign in to continue. Production authentication required.' });
      return;
    }

    if (!config.serverSupabase) {
      res.status(503).json({ error: 'Authentication service temporarily unavailable.' });
      return;
    }

    try {
      const { data: { user }, error } = await config.serverSupabase.auth.getUser(token);
      if (error || !user) {
        res.status(401).json({ error: 'Your session is invalid or expired. Please sign in again.' });
        return;
      }
      req.user = { id: user.id, email: user.email };
      req.accessToken = token;
      return next();
    } catch {
      res.status(401).json({ error: 'Unable to verify your session. Please sign in again.' });
      return;
    }
  };
}

export function createVerifyAuth(config: Pick<AuthMiddlewareConfig, 'serverSupabase'>) {
  return async function verifyAuth(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!config.serverSupabase) {
      return next();
    }

    try {
      const { data: { user }, error } = await config.serverSupabase.auth.getUser(token);
      if (!error && user) {
        req.user = {
          id: user.id,
          email: user.email,
        };
      }
    } catch (err) {
      console.warn('[Server Auth] Token verification warning:', err);
    }
    next();
  };
}

export function createUserScopedSupabase(
  supabaseUrl: string,
  supabaseAnonKey: string,
  accessToken: string
): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
