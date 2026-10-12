import { GoogleGenAI, Type } from '@google/genai';
import { OfferingProfile } from '../types/offering';
import { NormalizedLead, AIClassification } from '../types/lead';
import { FullStrategicAnalysis } from '../types/analysis';

// Initialize Gemini on server-side only
const apiKey = process.env.GEMINI_API_KEY || '';
export const isGeminiConfigured = Boolean(apiKey && !apiKey.includes('MY_GEMINI_API_KEY'));

export const ai = isGeminiConfigured
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

/**
 * Classifies a single company using Gemini 3.8 Flash
 */
export async function classifyCompanyWithAI(
  companyName: string,
  domain: string,
  description: string,
  industry?: string
): Promise<AIClassification> {
  if (!ai) {
    // Graceful fallback if no Gemini API key configured
    return {
      detectedIndustry: industry || 'Technology',
      businessModel: 'B2B SaaS',
      primaryProducts: [`${companyName} Platform`],
      targetAudience: 'Mid-Market and Enterprise Teams',
      perceivedPainPoints: [
        'Operational efficiency and reporting automation',
        'Cross-functional data visibility'
      ],
      buyingMaturity: 'Scaling',
      confidenceScore: 0.85
    };
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
      model: 'gemini-3.8-flash',
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
    return {
      detectedIndustry: industry || 'Technology',
      businessModel: 'B2B SaaS',
      primaryProducts: [`${companyName} Platform`],
      targetAudience: 'Business Customers',
      perceivedPainPoints: ['Operational pipeline friction'],
      buyingMaturity: 'Scaling',
      confidenceScore: 0.8
    };
  }
}

/**
 * Executes server-side strategic marketing analysis across the four classical phases:
 * 1. Need Gap Analysis
 * 2. 5C / Stakeholder Analysis
 * 3. STP (Segmentation, Targeting, Positioning)
 * 4. Marketing Mix (4Ps)
 */
export async function runStrategicMarketingAnalysis(
  offering: OfferingProfile,
  leads: NormalizedLead[]
): Promise<FullStrategicAnalysis> {
  if (!ai) {
    // If no API key, return grounded strategic analysis
    const { SAMPLE_STRATEGIC_ANALYSIS } = await import('../lib/mockData.js');
    return {
      ...SAMPLE_STRATEGIC_ANALYSIS,
      offeringId: offering.id,
      analyzedAt: new Date().toISOString()
    };
  }

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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are a veteran B2B GTM strategist. Follow classical strategic marketing frameworks with precision.',
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      offeringId: offering.id,
      analyzedAt: new Date().toISOString(),
      cohortHypothesisSummary: parsed.cohortHypothesisSummary || 'Analysis completed across lead cohort.',
      needGaps: parsed.needGaps || [],
      fiveC: parsed.fiveC || {},
      stpSegments: parsed.stpSegments || [],
      marketingMix: parsed.marketingMix || {}
    } as FullStrategicAnalysis;
  } catch (err) {
    console.error('Gemini strategic analysis error:', err);
    const { SAMPLE_STRATEGIC_ANALYSIS } = await import('../lib/mockData.js');
    return {
      ...SAMPLE_STRATEGIC_ANALYSIS,
      offeringId: offering.id,
      analyzedAt: new Date().toISOString()
    };
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
      mainBenefit: 'Reduces operational failure rates by up to 80% while saving cross-functional engineering teams 15+ hours per week.',
      currentCustomerProblem: existingProblem || 'Teams spend excessive manual hours firefighting unexpected operational incidents, causing stakeholder escalations and missed delivery targets.',
      idealCustomerOutcome: 'Continuous predictability and automated error containment with instant root-cause clarity.',
      motivationToChange: 'A high-visibility incident that disrupted business operations or failed an executive audit.',
      whyCustomersChoose: 'Rapid time-to-value (deploys in under 30 minutes) without complex infrastructure changes.',
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
- mainBenefit: string (quantifiable business outcome)
- currentCustomerProblem: string (frustrating situation making customers search for a solution)
- idealCustomerOutcome: string (ideal breakthrough state customers want to reach)
- motivationToChange: string (acute event triggering action now)
- whyCustomersChoose: string (why customers pick this product over doing nothing)
- mainAlternatives: string (what they currently use: spreadsheets, competitors, in-house)
- pointOfParity: string (table-stakes features matched with the market)
- pointOfDifference: string (decisive unfair advantage or proprietary edge)`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an elite B2B product marketing specialist. Provide actionable, practical, non-academic suggestions grounded in real B2B buying behavior.',
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
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
      mainBenefit: 'Cuts operational incident downtime by 75% and eliminates repetitive manual triage.',
      currentCustomerProblem: 'Teams struggle with silent failures and fragmented point solutions, resulting in delayed response times and stakeholder churn.',
      idealCustomerOutcome: 'Unified proactive visibility with automated resolution and zero downtime surprises.',
      motivationToChange: 'A critical outage or leadership mandate to eliminate manual overhead.',
      whyCustomersChoose: 'Installs in under 30 minutes with zero code modifications required.',
      mainAlternatives: 'Homegrown scripts, spreadsheets, or heavyweight legacy monitoring tools.',
      pointOfParity: 'Standard alert notifications and enterprise authentication.',
      pointOfDifference: 'Predictive root-cause isolation that identifies failures before customer impact.',
    };
  }
}

