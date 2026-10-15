import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { OfferingProfile } from '../types/offering';
import { NormalizedLead, AIClassification } from '../types/lead';
import { FullStrategicAnalysis } from '../types/analysis';
import { selectPreferredGeminiModel } from './companyAnalyzer';
import { hasOfferingOverlap, hasUnsupportedStat } from '../lib/offeringGrounding';

const strategicResponseSchema = z.object({
  cohortHypothesisSummary: z.string(),
  needGaps: z.array(z.object({
    leadId: z.string(), companyName: z.string(), identifiedNeed: z.string(),
    gapMagnitude: z.enum(['Acute', 'Moderate', 'Latent', 'Negligible']),
    urgencyDriver: z.string(), offeringCapabilityMatch: z.string(),
    consequenceOfInaction: z.string(), gapScore: z.number().min(0).max(100),
  })),
  stpSegments: z.array(z.object({
    id: z.string(), segmentName: z.string().max(60).refine(name => !/cohort[.!?]?$/i.test(name.trim())),
    problemDefinition: z.string(), leadCount: z.number().int().nonnegative(),
    averageNeedScore: z.number().min(0).max(100),
    targetAttractiveness: z.enum(['Tier 1 Priority', 'Tier 2 Secondary', 'Tier 3 Opportunistic', 'Avoid']),
    recommendedPositioningAngle: z.string(), valueNarrative: z.string(), matchedLeadIds: z.array(z.string()),
  })),
  fiveC: z.object({ company: z.any(), customers: z.any(), competitors: z.any(), collaborators: z.any(), context: z.any() }),
  marketingMix: z.object({ productResonance: z.string(), priceAcceptability: z.string(), placeChannelFit: z.string(), promotionHook: z.string() }),
});


// Initialize Gemini on server-side only
const apiKey = process.env.GEMINI_API_KEY || '';
export const isGeminiConfigured = Boolean(apiKey && !apiKey.includes('MY_GEMINI_API_KEY'));

export const ai = isGeminiConfigured
  ? new GoogleGenAI({ apiKey })
  : null;

let resolvedGeminiModel: string | null = null;

async function getAvailableGeminiModel(): Promise<string> {
  if (!ai) throw new Error('GEMINI_API_KEY is not configured on the server.');
  if (resolvedGeminiModel) return resolvedGeminiModel;
  const pager = await ai.models.list({ config: { pageSize: 100, queryBase: true } });
  const models = [];
  for await (const model of pager) models.push(model);
  resolvedGeminiModel = selectPreferredGeminiModel(models, process.env.GEMINI_MODEL || undefined);
  return resolvedGeminiModel;
}

/**
 * Legacy company classification adapter. New code should use the structured
 * company-intelligence endpoint, which includes provenance and persistence.
 */
export async function classifyCompanyWithAI(
  companyName: string,
  domain: string,
  description: string,
  industry?: string
): Promise<AIClassification> {
  if (!ai) {
    throw new Error('Gemini is unavailable. Company classification was not generated.');
  }

  const prompt = `Analyze this B2B company based on its firmographic details:
Company Name: ${companyName}
Domain: ${domain}
Industry: ${industry || 'Unknown'}
Description: ${description}

Classify the company type, business model, primary products, target audience, and perceived operational pain points.
Respond strictly with structured JSON matching the schema.`;

  try {
    const response = await ai.models.generateContent({
      model: await getAvailableGeminiModel(),
      contents: prompt,
      config: {
        systemInstruction: 'You are a senior B2B SaaS market analyst. Provide realistic, un-hallucinated firmographic classifications based solely on given details.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedIndustry: { type: Type.STRING },
            businessModel: {
              type: Type.STRING,
              description: 'One of: B2B SaaS, Enterprise Software, Professional Services, E-Commerce/Retail, FinTech, Healthcare/BioTech, Manufacturing, Unknown'
            },
            primaryProducts: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            targetAudience: { type: Type.STRING },
            perceivedPainPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            buyingMaturity: {
              type: Type.STRING,
              description: 'One of: Early, Scaling, Enterprise Mature'
            },
            confidenceScore: { type: Type.NUMBER }
          },
          required: [
            'detectedIndustry',
            'businessModel',
            'primaryProducts',
            'targetAudience',
            'perceivedPainPoints',
            'buyingMaturity',
            'confidenceScore'
          ]
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      detectedIndustry: parsed.detectedIndustry || industry || 'Technology',
      businessModel: parsed.businessModel || 'B2B SaaS',
      primaryProducts: parsed.primaryProducts || [`${companyName} Solutions`],
      targetAudience: parsed.targetAudience || 'Corporate Teams',
      perceivedPainPoints: parsed.perceivedPainPoints || ['Process inefficiency'],
      buyingMaturity: parsed.buyingMaturity || 'Scaling',
      confidenceScore: parsed.confidenceScore || 0.88
    };
  } catch (err) {
    console.error('Gemini company classification error:', err);
    throw new Error('Company classification failed. Please retry.');
  }
}

/**
 * Executes server-side strategic marketing analysis across the four classical phases:
 * 1. Need Gap Analysis
 * 2. 5C / Stakeholder Analysis
 * 3. STP (Segmentation, Targeting, Positioning)
 * 4. Marketing Mix (4Ps)
 */
export function validateStrategicResponse(raw: unknown, offering: OfferingProfile) {
  return strategicResponseSchema.superRefine((analysis, ctx) => {
    analysis.needGaps.forEach((gap, index) => {
      if (!hasOfferingOverlap(`${gap.identifiedNeed} ${gap.offeringCapabilityMatch}`, offering.primaryProblemSolved, offering.keyCapabilities)) {
        ctx.addIssue({ code: 'custom', path: ['needGaps', index], message: 'Need gap does not match the saved offering.' });
      }
    });
    analysis.stpSegments.forEach((segment, index) => {
      if (!hasOfferingOverlap(`${segment.segmentName} ${segment.problemDefinition}`, offering.primaryProblemSolved, offering.keyCapabilities)) {
        ctx.addIssue({ code: 'custom', path: ['stpSegments', index], message: 'Segment does not match the saved offering.' });
      }
      if (hasUnsupportedStat(`${segment.valueNarrative} ${segment.recommendedPositioningAngle}`, [offering.valueProposition, offering.primaryProblemSolved, ...offering.keyCapabilities].join(' '))) {
        ctx.addIssue({ code: 'custom', path: ['stpSegments', index, 'valueNarrative'], message: 'Unsupported numeric outcome claim.' });
      }
    });
  }).parse(raw);
}

export async function runStrategicMarketingAnalysis(
  offering: OfferingProfile,
  leads: NormalizedLead[]
): Promise<FullStrategicAnalysis> {
  if (!ai) throw new Error('Gemini is unavailable. Strategic analysis was not generated.');

  const leadsSummary = leads.slice(0, 10).map((l, idx) => `
Lead ${idx + 1}: ${l.companyName} (${l.domain})
Industry: ${l.industry} | FTE: ${l.headcount || 'N/A'} | Rev: ${l.annualRevenue || 'N/A'}
Tech: ${l.technologies.join(', ') || 'N/A'}
Desc: ${l.description}
`).join('\n');

  const prompt = `Perform an institutional-grade B2B Strategic Marketing Analysis in four sequential phases:
Sequence: Need Gap Analysis -> 5C Analysis -> STP -> Marketing Mix.

SELLER OFFERING:
Company: ${offering.companyName} (${offering.website})
Product: ${offering.productName} (${offering.category})
Value Prop: ${offering.valueProposition}
Problem Solved: ${offering.primaryProblemSolved}
Capabilities: ${offering.keyCapabilities.join('; ')}
Pricing / ACV: ${offering.typicalACV} (${offering.pricingModel})
ICP Hypothesis: ${offering.icpHypothesis.hypothesisRationale}

LEADS TO EVALUATE:
${leadsSummary}

Follow these strategic marketing rules:
1. For segmentation, prioritize shared customer needs, business problems, and buying behavior over superficial industry labels alone.
2. Distinguish an ICP hypothesis from a validated ICP. Lead lists without deal outcomes cannot prove ideal customer quality.
3. Quantify Need Gaps (Acute, Moderate, Latent, Negligible).
4. Perform 5C Analysis (Company, Customers, Competitors, Collaborators, Context).
5. Output STP Clusters and Marketing Mix (4Ps).`;
  const groundedPrompt = `${prompt}
6. Every need gap and segment must overlap with the saved seller problem or capabilities above. Exclude unrelated accounts instead of inventing fit.
7. Segment names must be short problem labels of at most 60 characters, never sentences ending in "Cohort".
8. Do not claim numeric improvements, savings, or ROI unless those exact figures appear in the seller input.`;

  try {
    const response = await ai.models.generateContent({
      model: await getAvailableGeminiModel(),
      contents: groundedPrompt,
      config: {
        systemInstruction: 'You are a veteran B2B GTM strategist. Follow classical strategic marketing frameworks with precision.',
        responseMimeType: 'application/json'
      }
    });

    const parsed = validateStrategicResponse(JSON.parse(response.text || '{}'), offering);
    return {
      offeringId: offering.id,
      analyzedAt: new Date().toISOString(),
      cohortHypothesisSummary: parsed.cohortHypothesisSummary,
      needGaps: parsed.needGaps,
      fiveC: parsed.fiveC,
      stpSegments: parsed.stpSegments,
      marketingMix: parsed.marketingMix,
    };
  } catch (err) {
    console.error('Gemini strategic analysis error:', err);
    throw new Error('Strategic analysis failed validation or the AI provider was unavailable. Please retry.');
  }
}

/**
 * AI Assistance: Generates structured suggestions for seller product context
 * from whatever partial information the user has entered so far.
 * Follows the Need Gap marketing framework without overwriting user data.
 */
export async function suggestSellerOnboardingContext(partial: Record<string, unknown>): Promise<Record<string, unknown>> {
  const company = String(partial.companyName || 'B2B Software Company');
  const website = String(partial.website || '');
  const product = String(partial.productName || `${company} Solution`);
  const industry = String(partial.industry || 'Technology');
  const existingDesc = String(partial.productDescription || '');
  const existingProblem = String(partial.currentCustomerProblem || '');

  if (!ai) {
    return {
      productDescription: existingDesc || `An enterprise cloud platform designed for ${industry} organizations to streamline operational efficiency and automate mission-critical workflows.`,
      coreFeatures: [
        'Real-time automated workflow diagnostics and continuous monitoring',
        'Direct API integration with legacy and cloud enterprise architectures',
        'Role-based security dashboards with automated anomaly alerting',
        'Custom executive reporting and compliance audit logs',
      ],
      mainBenefit: 'Could help teams reduce manual work and respond to operational issues sooner; validate the outcome with customers.',
      currentCustomerProblem: existingProblem || 'Teams spend excessive manual hours firefighting unexpected operational incidents, causing stakeholder escalations and missed delivery targets.',
      idealCustomerOutcome: 'Continuous predictability and automated error containment with instant root-cause clarity.',
      motivationToChange: 'A high-visibility incident that disrupted business operations or failed an executive audit.',
      whyCustomersChoose: 'Potentially simpler setup and clearer visibility; confirm these advantages with customers.',
      mainAlternatives: 'Manual spreadsheets, ad-hoc internal scripts, or legacy heavyweight enterprise suites.',
      pointOfParity: 'Standard SOC2 compliance, role-based access control, and webhook alerts.',
      pointOfDifference: 'Zero-configuration anomaly prediction engine that flags issues before they cause downstream disruption.',
    };
  }

  const prompt = `You are a world-class B2B Product Marketing Director and Pricing Strategist.
Help an entrepreneur or sales leader articulate their product context using the Need Gap Framework (Current State -> Ideal State -> Gap).

Given these partial details provided by the user:
Company: ${company}
Website: ${website}
Product: ${product}
Industry: ${industry}
Existing Description: ${existingDesc || 'None'}
Existing Problem: ${existingProblem || 'None'}

Generate realistic, high-impact marketing suggestions for their onboarding profile.
Return strictly valid JSON with the following fields:
- productDescription: string (concise, clear, non-jargon B2B description)
- coreFeatures: array of 4 concise strings (specific capabilities)
- mainBenefit: string (potential customer outcome; never invent a percentage, time saving, ROI, or other numeric result)
- currentCustomerProblem: string (frustrating situation making customers search for a solution)
- idealCustomerOutcome: string (ideal breakthrough state customers want to reach)
- motivationToChange: string (acute event triggering action now)
- whyCustomersChoose: string (why customers might pick this product over doing nothing; do not invent deployment times or guarantees)
- mainAlternatives: string (what they currently use: spreadsheets, competitors, in-house)
- pointOfParity: string (table-stakes features matched with the market)
- pointOfDifference: string (decisive unfair advantage or proprietary edge)`;

  try {
    const response = await ai.models.generateContent({
      model: await getAvailableGeminiModel(),
      contents: prompt,
      config: {
        systemInstruction: 'You are an elite B2B product marketing specialist. Provide actionable, practical, non-academic suggestions grounded in real B2B buying behavior.',
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const suppliedText = Object.values(partial).filter((value): value is string => typeof value === 'string').join(' ');
    if (hasUnsupportedStat(String(parsed.mainBenefit || ''), suppliedText)) {
      parsed.mainBenefit = `Could help address ${existingProblem || 'the described customer problem'}; quantify the impact with customer evidence.`;
    }
    if (hasUnsupportedStat(String(parsed.whyCustomersChoose || ''), suppliedText)) {
      parsed.whyCustomersChoose = 'Potential benefits require validation with customers.';
    }
    return parsed;
  } catch (err) {
    console.error('Gemini onboarding suggestion error:', err);
    return {
      productDescription: `Enterprise B2B software designed for ${industry} to automate operations and prevent high-stakes failures.`,
      coreFeatures: [
        'Automated telemetry monitoring and real-time detection',
        'Native connectors for enterprise data and messaging tools',
        'Granular role-based permissions and audit logs',
        'Self-healing automation playbooks',
      ],
      mainBenefit: 'Could reduce manual triage and help teams respond to incidents sooner; quantify the impact with customers.',
      currentCustomerProblem: 'Teams struggle with silent failures and fragmented point solutions, resulting in delayed response times and stakeholder churn.',
      idealCustomerOutcome: 'Unified proactive visibility with automated resolution and zero downtime surprises.',
      motivationToChange: 'A critical outage or leadership mandate to eliminate manual overhead.',
      whyCustomersChoose: 'May simplify setup and incident response; confirm this with customers.',
      mainAlternatives: 'Homegrown scripts, spreadsheets, or heavyweight legacy monitoring tools.',
      pointOfParity: 'Standard alert notifications and enterprise authentication.',
      pointOfDifference: 'Predictive root-cause isolation that identifies failures before customer impact.',
    };
  }
}

