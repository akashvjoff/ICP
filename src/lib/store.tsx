import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  OfferingProfile,
  SellerProductContext,
  DEFAULT_SELLER_CONTEXT,
  EMPTY_SELLER_CONTEXT,
  calculateContextCompletion,
  contextToOfferingProfile,
} from '../types/offering';
import { NormalizedLead } from '../types/lead';
import { FullStrategicAnalysis, STPCluster } from '../types/analysis';
import { LeadICPScore, ScoringWeights } from '../types/scoring';
import {
  SAMPLE_OFFERING,
  SAMPLE_LEADS,
  SAMPLE_STRATEGIC_ANALYSIS,
  SAMPLE_SCORES,
} from './mockData';
import { DEFAULT_SCORING_WEIGHTS, batchScoreLeads } from './scoring';
import { useAuth } from './auth';
import { dbService } from './supabase';
import type { DbLeadScore } from '../types/database';

export interface DatasetMeta {
  id: string;
  filename: string;
  fileSize: string;
  totalRows: number;
  validRows: number;
  uploadedAt: string;
  status: 'Completed' | 'Processing' | 'Failed';
  processingProgress: number; // 0 - 100
  tier1Count: number;
  tier2Count: number;
  disqualifiedCount: number;
}

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'warning' | 'info';
}

interface AppStoreContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  user: {
    name: string;
    email: string;
    company: string;
    role: string;
  };
  updateDemoProfile: (profile: { name: string; email: string; company: string; role: string }) => void;
  sellerContext: SellerProductContext;
  updateSellerContext: (context: SellerProductContext) => void;
  isContextComplete: boolean;
  contextCompletionScore: number;
  missingContextFields: string[];
  offering: OfferingProfile;
  updateOffering: (offering: OfferingProfile) => void;
  datasets: DatasetMeta[];
  activeDatasetId: string;
  setActiveDatasetId: (id: string) => void;
  leads: NormalizedLead[];
  scores: LeadICPScore[];
  analysis: FullStrategicAnalysis;
  segments: STPCluster[];
  weights: ScoringWeights;
  updateWeights: (weights: ScoringWeights) => void;
  addDataset: (newDataset: DatasetMeta, newLeads: NormalizedLead[]) => void;
  updateDatasetProgress: (datasetId: string, progress: number, status: DatasetMeta['status']) => void;
  updateLeadAnalysisStatuses: (updatedStatuses: Record<string, NormalizedLead['analysisStatus']>) => void;
  updateLeadDescription: (leadId: string, description: string) => void;
  toasts: ToastMessage[];
  addToast: (text: string, type?: 'success' | 'warning' | 'info') => void;
  removeToast: (id: string) => void;
  clearToEmptyState: () => void;
  resetToDemoData: () => void;
  refreshLiveWorkspace: () => void;
}

const INITIAL_DATASET: DatasetMeta = {
  id: 'dataset-01',
  filename: 'Q1_North_America_SaaS_Pipeline.csv',
  fileSize: '1.4 MB',
  totalRows: 5,
  validRows: 5,
  uploadedAt: '2026-03-20T08:15:00Z',
  status: 'Completed',
  processingProgress: 100,
  tier1Count: 2,
  tier2Count: 2,
  disqualifiedCount: 1,
};

const EMPTY_STRATEGIC_ANALYSIS: FullStrategicAnalysis = {
  offeringId: '',
  analyzedAt: '',
  needGaps: [],
  fiveC: {
    company: { internalCapabilities: '', resourceReadiness: '', strategicPriority: '' },
    customers: { economicBuyer: '', championPersona: '', primaryObstacle: '', decisionCycleEstimate: '' },
    competitors: { currentAlternative: '', switchingFriction: '', differentiationAdvantage: '' },
    collaborators: { systemIntegrators: '', ecosystemPartners: '' },
    context: { regulatoryFactors: '', economicClimate: '', technologicalShifts: '' },
  },
  stpSegments: [],
  marketingMix: { productResonance: '', priceAcceptability: '', placeChannelFit: '', promotionHook: '' },
  cohortHypothesisSummary: '',
};

const AppStoreContext = createContext<AppStoreContextType | null>(null);

export const useAppStore = () => {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error('useAppStore must be used within an AppStoreProvider');
  }
  return context;
};

export const AppStoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user: authUser } = useAuth();
  const isLiveUser = Boolean(authUser?.id);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(!isLiveUser);

  const [user, setUser] = useState(() => {
    const fallback = { name: 'Alex Vance', email: 'alex@synthetix.io', company: 'Synthetix Data Cloud', role: 'Founder & CEO' };
    try {
      const saved = JSON.parse(localStorage.getItem('icp_mode_demo_profile') || 'null');
      if (saved && ['name', 'email', 'company', 'role'].every((key) => typeof saved[key] === 'string')) return saved as typeof fallback;
    } catch {}
    return fallback;
  });

  // Load initial sellerContext from localStorage or default
  const [sellerContext, setSellerContext] = useState<SellerProductContext>(() => {
    if (isLiveUser) return EMPTY_SELLER_CONTEXT;
    try {
      const saved = localStorage.getItem('icp_mode_seller_context');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return isLiveUser ? EMPTY_SELLER_CONTEXT : DEFAULT_SELLER_CONTEXT;
  });

  const completion = calculateContextCompletion(sellerContext);
  const isContextComplete = completion.isComplete;
  const contextCompletionScore = completion.score;
  const missingContextFields = completion.missingFields;

  const [offering, setOffering] = useState<OfferingProfile>(() => {
    return contextToOfferingProfile(sellerContext);
  });

  const [datasets, setDatasets] = useState<DatasetMeta[]>(() => {
    try {
      const saved = localStorage.getItem('icp_mode_datasets');
      return isLiveUser ? [] : (saved ? JSON.parse(saved) : [INITIAL_DATASET]);
    } catch { return isLiveUser ? [] : [INITIAL_DATASET]; }
  });
  const [activeDatasetId, setActiveDatasetId] = useState<string>(() => {
    try { return isLiveUser ? '' : (localStorage.getItem('icp_mode_active_dataset') || 'dataset-01'); }
    catch { return isLiveUser ? '' : 'dataset-01'; }
  });
  const [leads, setLeads] = useState<NormalizedLead[]>(() => {
    try {
      const saved = localStorage.getItem('icp_mode_leads');
      return isLiveUser ? [] : (saved ? JSON.parse(saved) : SAMPLE_LEADS);
    } catch { return isLiveUser ? [] : SAMPLE_LEADS; }
  });
  const [analysis, setAnalysis] = useState<FullStrategicAnalysis>(isLiveUser ? EMPTY_STRATEGIC_ANALYSIS : SAMPLE_STRATEGIC_ANALYSIS);
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_SCORING_WEIGHTS);
  const [scores, setScores] = useState<LeadICPScore[]>(isLiveUser ? [] : SAMPLE_SCORES);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refreshLiveWorkspace = useCallback(() => setRefreshVersion((value) => value + 1), []);

  const segments = analysis.stpSegments;

  useEffect(() => {
    if (!authUser?.id) return;
    let current = true;
    const ownerId = authUser.id;
    setIsDemoMode(false);
    if (refreshVersion === 0) {
      setDatasets([]);
      setLeads([]);
      setScores([]);
      setActiveDatasetId('');
      setSellerContext(EMPTY_SELLER_CONTEXT);
      setAnalysis(EMPTY_STRATEGIC_ANALYSIS);
    }
    void (async () => {
      try {
        const [savedContext, savedDatasets, jobs] = await Promise.all([
          dbService.loadSellerProductContext(ownerId),
          dbService.getDatasets(ownerId),
          dbService.getAnalysisJobs(ownerId),
        ]);
        if (!current) return;
        if (savedContext) {
          const context = { ...EMPTY_SELLER_CONTEXT, ...savedContext } as SellerProductContext;
          setSellerContext(context);
          setOffering(contextToOfferingProfile(context));
        }
        const jobByDataset = new Map(jobs.map((job) => [job.dataset_id, job]));
        const mappedDatasets: DatasetMeta[] = savedDatasets.map((dataset) => {
          const job = jobByDataset.get(dataset.id);
          const complete = job?.status === 'completed' || job?.status === 'completed_with_errors';
          return {
            id: dataset.id,
            filename: dataset.original_filename,
            fileSize: dataset.original_file_size_bytes ? `${dataset.original_file_size_bytes} B` : 'Unknown',
            totalRows: dataset.row_count,
            validRows: dataset.row_count,
            uploadedAt: dataset.created_at,
            status: complete ? 'Completed' : dataset.status === 'failed' ? 'Failed' : 'Processing',
            processingProgress: job?.total_count ? Math.round(((job.completed_count + job.failed_count) / job.total_count) * 100) : 0,
            tier1Count: 0, tier2Count: 0, disqualifiedCount: 0,
          };
        });
        setDatasets(mappedDatasets);
        const selected = mappedDatasets[0];
        if (!selected) return;
        setActiveDatasetId(selected.id);
        const savedLeads = await dbService.getLeads(ownerId, selected.id);
        if (!current) return;
        const mappedLeads: NormalizedLead[] = savedLeads.map((lead) => ({
          id: lead.id, companyName: lead.company_name, domain: lead.normalized_domain,
          website: lead.website, industry: lead.industry_raw || '', headcount: lead.employee_count ?? null,
          annualRevenue: lead.annual_revenue == null ? null : String(lead.annual_revenue),
          description: lead.notes || '', country: lead.geography || '', technologies: [],
          isClean: true, isAiEnriched: lead.analysis_eligible,
          analysisStatus: lead.analysis_status || 'pending',
          userCorrectedDescription: lead.user_corrected_description || null,
          rawRow: lead.raw_row as NormalizedLead['rawRow'], ingestedAt: lead.created_at,
        }));
        setLeads(mappedLeads);
        const savedScores = await dbService.getLeadScores(ownerId, mappedLeads.map((lead) => lead.id));
        if (!current) return;
        const leadById = new Map(mappedLeads.map((lead) => [lead.id, lead]));
        const mappedScores: LeadICPScore[] = savedScores.map((saved: DbLeadScore) => {
          const details = saved.scoring_breakdown as Record<string, unknown>;
          const lead = leadById.get(saved.lead_id);
          return {
            leadId: saved.lead_id, companyName: lead?.companyName || String(details.companyName || ''),
            domain: lead?.domain || null, totalScore: saved.fit_score,
            tier: saved.fit_tier as LeadICPScore['tier'], confidence: Number(details.confidence || 0),
            isHypothesisOnly: true, breakdown: (details.items || []) as LeadICPScore['breakdown'],
            primaryStrengths: (details.primaryStrengths || []) as string[],
            primaryDisqualifiers: (details.primaryDisqualifiers || []) as string[],
            recommendedAction: (details.recommendedAction || 'Further Discovery') as LeadICPScore['recommendedAction'],
            scoredAt: saved.created_at, evidenceCoverage: saved.coverage_score,
            isDisqualified: saved.is_disqualified || false,
            disqualificationReason: saved.disqualification_reason || null,
            intentLabel: String(details.intentLabel || 'BUYING INTENT: UNKNOWN'),
          };
        });
        setScores(mappedScores);
        const savedStp = await dbService.getDatasetSTPAnalysis(ownerId, selected.id);
        if (!current) return;
        const mappedSegments: STPCluster[] = (savedStp?.segments || [])
          .filter((segment) => !segment.isInsufficientEvidenceGroup)
          .map((segment) => {
            const assessment = savedStp?.targetingAssessments[segment.id];
            const positioning = savedStp?.positioningRecommendations[segment.id];
            const targetAttractiveness: STPCluster['targetAttractiveness'] =
              assessment?.recommendationTier === 'Recommended Target'
                ? 'Tier 1 Priority'
                : assessment?.recommendationTier === 'Provisional Shortlist' || assessment?.recommendationTier === 'Secondary Priority'
                  ? 'Tier 2 Secondary'
                  : assessment?.recommendationTier === 'Avoid'
                    ? 'Avoid'
                    : 'Tier 3 Opportunistic';
            return {
              id: segment.id,
              segmentName: segment.name,
              problemDefinition: segment.sharedProblem,
              leadCount: segment.companyCount,
              averageNeedScore: assessment?.attractivenessScore || 0,
              targetAttractiveness,
              recommendedPositioningAngle: positioning?.positioningStatement || 'Positioning requires buyer validation.',
              valueNarrative: segment.desiredOutcome,
              matchedLeadIds: segment.primaryCompanyIds,
            };
          })
          .sort((a, b) => b.averageNeedScore - a.averageNeedScore);
        setAnalysis((previous) => ({
          ...previous,
          offeringId: savedStp?.sellerOfferingId || previous.offeringId,
          analyzedAt: savedStp?.generatedAt || previous.analyzedAt,
          stpSegments: mappedSegments,
        }));
        setDatasets((previous) => previous.map((dataset) => dataset.id === selected.id ? {
          ...dataset,
          tier1Count: mappedScores.filter((score) => score.tier.includes('Tier 1')).length,
          tier2Count: mappedScores.filter((score) => score.tier.includes('Tier 2')).length,
          disqualifiedCount: mappedScores.filter((score) => score.isDisqualified).length,
        } : dataset));
      } catch (error) {
        console.error('[Workspace] Could not load the signed-in user data:', error);
      }
    })();
    return () => { current = false; };
  }, [authUser?.id, refreshVersion]);

  const toggleDemoMode = () => {
    setIsDemoMode((prev) => !prev);
    addToast(
      !isDemoMode ? 'Demo mode enabled. Synthetic dataset restored.' : 'Live mode enabled. External pipeline awaiting inputs.',
      'info'
    );
  };

  const updateSellerContext = (newContext: SellerProductContext) => {
    setSellerContext(newContext);
    if (!isLiveUser) {
      try { localStorage.setItem('icp_mode_seller_context', JSON.stringify(newContext)); } catch {}
    }
    const mapped = contextToOfferingProfile(newContext);
    setOffering(mapped);
    addToast('Seller Product Context saved and calibrated.', 'success');
  };

  const updateDemoProfile = (profile: { name: string; email: string; company: string; role: string }) => {
    if (isLiveUser) return;
    setUser(profile);
    try { localStorage.setItem('icp_mode_demo_profile', JSON.stringify(profile)); } catch {}
  };

  const updateOffering = (updated: OfferingProfile) => {
    setOffering(updated);
    addToast('Offering profile saved successfully.', 'success');
  };

  const updateWeights = (newWeights: ScoringWeights) => {
    setWeights(newWeights);
    const recomputed = batchScoreLeads(leads, offering, analysis, newWeights);
    setScores(recomputed);
    addToast('Fit scoring weights updated and recomputed.', 'success');
  };

  const addDataset = (newDataset: DatasetMeta, newLeads: NormalizedLead[]) => {
    setDatasets((prev) => {
      const next = [newDataset, ...prev.filter((dataset) => dataset.id !== newDataset.id)];
      try { localStorage.setItem('icp_mode_datasets', JSON.stringify(next)); } catch {}
      return next;
    });
    setActiveDatasetId(newDataset.id);
    setLeads(newLeads);
    setScores([]);
    try {
      localStorage.setItem('icp_mode_active_dataset', newDataset.id);
      localStorage.setItem('icp_mode_leads', JSON.stringify(newLeads));
    } catch {}
    addToast(`Dataset "${newDataset.filename}" stored. Analysis is queued.`, 'success');
  };

  const updateLeadDescription = (leadId: string, description: string) => {
    setLeads((prev) => {
      const next = prev.map((lead) =>
        lead.id === leadId
          ? { ...lead, description, userCorrectedDescription: description }
          : lead
      );
      try {
        localStorage.setItem('icp_mode_leads', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const updateDatasetProgress = (datasetId: string, progress: number, status: DatasetMeta['status']) => {
    setDatasets((prev) => {
      const next = prev.map((d) =>
        d.id === datasetId
          ? { ...d, processingProgress: progress, status }
          : d
      );
      try {
        localStorage.setItem('icp_mode_datasets', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const updateLeadAnalysisStatuses = (updatedStatuses: Record<string, NormalizedLead['analysisStatus']>) => {
    setLeads((prev) => {
      const next = prev.map((lead) => {
        const newStatus = updatedStatuses[lead.id];
        return newStatus !== undefined ? { ...lead, analysisStatus: newStatus } : lead;
      });
      try {
        localStorage.setItem('icp_mode_leads', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const addToast = (text: string, type: 'success' | 'warning' | 'info' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const clearToEmptyState = () => {
    setDatasets([]);
    setLeads([]);
    setScores([]);
    setActiveDatasetId('');
    try {
      localStorage.removeItem('icp_mode_datasets');
      localStorage.removeItem('icp_mode_active_dataset');
      localStorage.removeItem('icp_mode_leads');
    } catch {}
    addToast('All lead datasets cleared. Empty state active.', 'warning');
  };

  const resetToDemoData = () => {
    setSellerContext(DEFAULT_SELLER_CONTEXT);
    setOffering(SAMPLE_OFFERING);
    setDatasets([INITIAL_DATASET]);
    setActiveDatasetId('dataset-01');
    setLeads(SAMPLE_LEADS);
    setAnalysis(SAMPLE_STRATEGIC_ANALYSIS);
    setWeights(DEFAULT_SCORING_WEIGHTS);
    setScores(SAMPLE_SCORES);
    setIsDemoMode(true);
    addToast('Synthetic B2B demo dataset restored.', 'success');
  };

  return (
    <AppStoreContext.Provider
      value={{
        isDemoMode,
        toggleDemoMode,
        user,
        updateDemoProfile,
        sellerContext,
        updateSellerContext,
        isContextComplete,
        contextCompletionScore,
        missingContextFields,
        offering,
        updateOffering,
        datasets,
        activeDatasetId,
        setActiveDatasetId,
        leads,
        scores,
        analysis,
        segments,
        weights,
        updateWeights,
        addDataset,
        updateDatasetProgress,
        updateLeadAnalysisStatuses,
        updateLeadDescription,
        toasts,
        addToast,
        removeToast,
        clearToEmptyState,
        resetToDemoData,
        refreshLiveWorkspace,
      }}
    >
      {children}
    </AppStoreContext.Provider>
  );
};
