import { NormalizedLead } from './lead';
import { OfferingProfile } from './offering';
import { FullStrategicAnalysis } from './analysis';
import { LeadICPScore, ScoringWeights } from './scoring';

export interface ClassifyCompanyRequest {
  companyName: string;
  domain: string;
  description: string;
  industry?: string;
}

export interface StrategicAnalysisRequest {
  offering: OfferingProfile;
  leads: NormalizedLead[];
}

export interface ScoreLeadsRequest {
  offering: OfferingProfile;
  leads: NormalizedLead[];
  analysis?: FullStrategicAnalysis;
  weights?: Partial<ScoringWeights>;
}

export interface HealthResponse {
  status: 'ok';
}
