import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';

interface RailwayUsageResponse {
  estimatedUsage: number;
  creditsRemaining: number;
  daysRemaining: number;
  plan: string;
  billingPeriodEnd: string;
}

export function createSystemRoutes(): Router {
  const router = Router();

  // GET /api/system/railway-usage - Get Railway usage stats
  router.get('/railway-usage', async (_req: Request, res: Response) => {
    const railwayToken = process.env.RAILWAY_API_TOKEN;

    if (!railwayToken) {
      return res.status(503).json({
        error: 'Railway API token not configured',
        usage: null,
      });
    }

    try {
      // GraphQL query to get workspace usage
      const query = `
        query {
          me {
            id
            email
          }
          workspaces {
            edges {
              node {
                id
                name
                subscription {
                  planId
                  billingCycleAnchor
                }
                usage {
                  estimatedUsage
                  creditsAvailable
                }
              }
            }
          }
        }
      `;

      const response = await fetch(RAILWAY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${railwayToken}`,
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Railway API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.errors) {
        logger.warn('Railway API errors', { errors: data.errors });

        // Try alternative query for personal account
        const altQuery = `
          query {
            me {
              id
              email
              customer {
                billingEmail
                creditBalance
                hasPaymentMethod
              }
            }
          }
        `;

        const altResponse = await fetch(RAILWAY_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${railwayToken}`,
          },
          body: JSON.stringify({ query: altQuery }),
        });

        const altData = await altResponse.json();

        if (altData.data?.me?.customer) {
          const customer = altData.data.me.customer;
          return res.json({
            usage: {
              creditsRemaining: customer.creditBalance || 0,
              plan: customer.hasPaymentMethod ? 'hobby' : 'trial',
              email: altData.data.me.email,
            },
          });
        }
      }

      // Parse the response
      const workspace = data.data?.workspaces?.edges?.[0]?.node;

      if (workspace) {
        const usage = workspace.usage || {};
        const subscription = workspace.subscription || {};

        // Calculate days remaining in billing cycle
        let daysRemaining = 0;
        if (subscription.billingCycleAnchor) {
          const cycleEnd = new Date(subscription.billingCycleAnchor);
          cycleEnd.setMonth(cycleEnd.getMonth() + 1);
          daysRemaining = Math.max(0, Math.ceil((cycleEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        }

        const result: RailwayUsageResponse = {
          estimatedUsage: usage.estimatedUsage || 0,
          creditsRemaining: usage.creditsAvailable || 5,
          daysRemaining,
          plan: subscription.planId || 'hobby',
          billingPeriodEnd: subscription.billingCycleAnchor || '',
        };

        return res.json({ usage: result });
      }

      return res.json({
        usage: null,
        message: 'No workspace data found',
      });

    } catch (error) {
      logger.error('Failed to fetch Railway usage', { error: (error as Error).message });
      return res.status(500).json({
        error: 'Failed to fetch Railway usage',
        message: (error as Error).message,
      });
    }
  });

  // GET /api/system/health - Extended health check
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  return router;
}
