import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  classifyCompanyWithAI,
  runStrategicMarketingAnalysis,
  suggestSellerOnboardingContext,
  isGeminiConfigured,
} from './src/server/gemini.ts';
import { calculateDeterministicICPScore, batchScoreLeads } from './src/lib/scoring.ts';
import { SAMPLE_OFFERING, SAMPLE_LEADS, SAMPLE_STRATEGIC_ANALYSIS, SAMPLE_SCORES } from './src/lib/mockData.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));

// Server-side Supabase client (using service role or anon key if present)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseServiceKey &&
  !supabaseUrl.includes('YOUR_PROJECT_ID') &&
  supabaseUrl.startsWith('https://')
);

const serverSupabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Authenticated request extension
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

// Server Auth Verification Middleware
async function verifyAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // If Supabase is not configured or demo mode is active, proceed with fallback
    return next();
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!serverSupabase) {
    return next();
  }

  try {
    const { data: { user }, error } = await serverSupabase.auth.getUser(token);
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
}

app.use(verifyAuth);

// Health Endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'icp.mode',
    timestamp: new Date().toISOString(),
    geminiConfigured: isGeminiConfigured,
    supabaseConfigured: isSupabaseConfigured,
  });
});

// Supabase Status Endpoint
app.get('/api/supabase/status', async (req: Request, res: Response) => {
  if (!serverSupabase) {
    return res.json({
      configured: false,
      message: 'Supabase credentials not configured in environment.',
      mode: 'demo-persistence',
    });
  }

  try {
    const { data, error } = await serverSupabase
      .from('datasets')
      .select('count', { count: 'exact', head: true });

    res.json({
      configured: true,
      mode: 'live-postgresql',
      connected: !error,
      error: error ? error.message : null,
    });
  } catch (err) {
    res.json({
      configured: true,
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// Mock/Sample Leads Route
app.get('/api/sample-data', (req: Request, res: Response) => {
  res.json({
    offering: SAMPLE_OFFERING,
    leads: SAMPLE_LEADS,
    analysis: SAMPLE_STRATEGIC_ANALYSIS,
    scores: SAMPLE_SCORES,
  });
});

// AI Company Classification Endpoint
app.post('/api/ai/classify-company', async (req: Request, res: Response) => {
  try {
    const { companyName, domain, description, industry } = req.body;
    if (!companyName || !domain) {
      return res.status(400).json({ error: 'companyName and domain are required.' });
    }

    const classification = await classifyCompanyWithAI(companyName, domain, description || '', industry);
    res.json({ success: true, classification });
  } catch (error) {
    console.error('Error in /api/ai/classify-company:', error);
    res.status(500).json({ error: 'Failed to classify company.' });
  }
});

// Strategic Marketing Analysis Endpoint (Need Gap -> 5C -> STP -> Marketing Mix)
app.post('/api/ai/strategic-analysis', async (req: Request, res: Response) => {
  try {
    const { offering, leads } = req.body;
    if (!offering || !leads || !Array.isArray(leads)) {
      return res.status(400).json({ error: 'offering and leads array are required.' });
    }

    const analysis = await runStrategicMarketingAnalysis(offering, leads);
    res.json({ success: true, analysis });
  } catch (error) {
    console.error('Error in /api/ai/strategic-analysis:', error);
    res.status(500).json({ error: 'Failed to run strategic analysis.' });
  }
});

// AI Suggest Onboarding Context Endpoint (Need Gap Framework Assistance)
app.post('/api/ai/suggest-onboarding', async (req: Request, res: Response) => {
  try {
    const partialData = req.body || {};
    const suggestions = await suggestSellerOnboardingContext(partialData);
    res.json({ success: true, suggestions });
  } catch (error) {
    console.error('Error in /api/ai/suggest-onboarding:', error);
    res.status(500).json({ error: 'Failed to generate onboarding suggestions.' });
  }
});

// Deterministic Lead Scoring Endpoint
app.post('/api/leads/score', (req: Request, res: Response) => {
  try {
    const { leads, offering, analysis, weights } = req.body;
    if (!leads || !offering) {
      return res.status(400).json({ error: 'leads and offering are required.' });
    }

    const scores = batchScoreLeads(leads, offering, analysis, weights);
    res.json({ success: true, scores });
  } catch (error) {
    console.error('Error in /api/leads/score:', error);
    res.status(500).json({ error: 'Failed to score leads.' });
  }
});

// Vite Middlewares in Dev or Static Serve in Prod
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[icp.mode] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
