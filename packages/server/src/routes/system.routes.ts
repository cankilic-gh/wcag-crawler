import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';

// WCAG Crawler project ID on Railway
const RAILWAY_PROJECT_ID = 'f8a9f954-8691-42c3-acc5-cb2c51e6a71e';

interface RailwayUsageResponse {
  creditsRemaining: number;
  daysRemaining: number;
  plan: string;
  billingPeriodEnd: string;
  projectName: string;
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
      // GraphQL query to get project and workspace billing info
      const query = `
        query {
          project(id: "${RAILWAY_PROJECT_ID}") {
            id
            name
            subscriptionType
            workspace {
              id
              name
              plan
              customer {
                creditBalance
                billingPeriod {
                  start
                  end
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
        return res.status(500).json({
          error: 'Railway API error',
          details: data.errors,
        });
      }

      const project = data.data?.project;
      const workspace = project?.workspace;
      const customer = workspace?.customer;

      if (!project || !workspace || !customer) {
        return res.json({
          usage: null,
          message: 'No billing data found',
        });
      }

      // Calculate days remaining
      const billingEnd = new Date(customer.billingPeriod.end);
      const now = new Date();
      const daysRemaining = Math.max(0, Math.ceil((billingEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      const result: RailwayUsageResponse = {
        creditsRemaining: customer.creditBalance || 0,
        daysRemaining,
        plan: workspace.plan || 'hobby',
        billingPeriodEnd: customer.billingPeriod.end,
        projectName: project.name,
      };

      return res.json({ usage: result });

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
