import { z } from 'zod';
import { OfferingProfile } from '../types/offering';
import { NormalizedLead, AIClassification } from '../types/lead';
import { FullStrategicAnalysis } from '../types/analysis';
import { createAIProviders, generateStructured } from './ai/provider';
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


const classificationSchema = z.object({
  detectedIndustry: z.string(), businessModel: z.enum(['B2B SaaS', 'Enterprise Software', 'Professional Services', 'E-Commerce/Retail', 'FinTech', 'Healthcare/BioTech', 'Manufacturing', 'Unknown']), primaryProducts: z.array(z.string()),
  targetAudience: z.string(), perceivedPainPoints: z.array(z.string()),
  buyingMaturity: z.enum(['Early', 'Scaling', 'Enterprise Mature']), confidenceScore: z.number(),
});

const onboardingSchema = z.object({
  productDescription: z.string(), coreFeatures: z.array(z.string()), mainBenefit: z.string(),
  currentCustomerProblem: z.string(), idealCustomerOutcome: z.string(), motivationToChange: z.string(),
  whyCustomersChoose: z.string(), mainAlternatives: z.string(), pointOfParity: z.string(), pointOfDifference: z.string(),
});

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
  const prompt = `Analyze this B2B company based on its firmographic details:
Company Name: ${companyName}
Domain: ${domain}
Industry: ${industry || 'Unknown'}
Description: ${description}

Classify the company type, business model, primary products, target audience, and perceived operational pain points.
Respond strictly with structured JSON matching the schema.`;

  try {
    const { value: parsed } = await generateStructured({ prompt, schema: classificationSchema,
      systemInstruction: 'You are a senior B2B SaaS market analyst. Provide realistic, un-hallucinated firmographic classifications based solely on given details.' }, createAIProviders());
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
    const { value } = await generateStructured({ prompt: groundedPrompt, schema: strategicResponseSchema,
      systemInstruction: 'You are a veteran B2B GTM strategist. Follow classical strategic marketing frameworks with precision.' }, createAIProviders());
    const parsed = validateStrategicResponse(value, offering);
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
    const { value: parsed } = await generateStructured({ prompt, schema: onboardingSchema,
      systemInstruction: 'You are an elite B2B product marketing specialist. Provide actionable, practical, non-academic suggestions grounded in real B2B buying behavior.' }, createAIProviders());
    const suppliedText = Object.values(partial).filter((value): value is string => typeof value === 'string').join(' ');
    if (hasUnsupportedStat(String(parsed.mainBenefit || ''), suppliedText)) {
      parsed.mainBenefit = `Could help address ${existingProblem || 'the described customer problem'}; quantify the impact with customer evidence.`;
    }
    if (hasUnsupportedStat(String(parsed.whyCustomersChoose || ''), suppliedText)) {
      parsed.whyCustomersChoose = 'Potential benefits require validation with customers.';
    }
    return parsed;
  } catch (err) {
    console.error('Onboarding suggestion provider error:', err);
    throw new Error('Onboarding suggestions are unavailable right now. Please retry.');
  }
}

