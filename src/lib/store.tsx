import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  OfferingProfile,
  SellerProductContext,
  DEFAULT_SELLER_CONTEXT,
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
  toasts: ToastMessage[];
  addToast: (text: string, type?: 'success' | 'warning' | 'info') => void;
  removeToast: (id: string) => void;
  clearToEmptyState: () => void;
  resetToDemoData: () => void;
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

const AppStoreContext = createContext<AppStoreContextType | null>(null);

export const useAppStore = () => {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error('useAppStore must be used within an AppStoreProvider');
  }
  return context;
};

export const AppStoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);

  const [user, setUser] = useState({
    name: 'Alex Vance',
    email: 'alex@synthetix.io',
    company: 'Synthetix Data Cloud',
    role: 'Founder & CEO',
  });

  // Load initial sellerContext from localStorage or default
  const [sellerContext, setSellerContext] = useState<SellerProductContext>(() => {
    try {
      const saved = localStorage.getItem('icp_mode_seller_context');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return DEFAULT_SELLER_CONTEXT;
  });

  const completion = calculateContextCompletion(sellerContext);
  const isContextComplete = completion.isComplete;
  const contextCompletionScore = completion.score;
  const missingContextFields = completion.missingFields;

  const [offering, setOffering] = useState<OfferingProfile>(() => {
    return contextToOfferingProfile(sellerContext);
  });

  const [datasets, setDatasets] = useState<DatasetMeta[]>([INITIAL_DATASET]);
  const [activeDatasetId, setActiveDatasetId] = useState<string>('dataset-01');
  const [leads, setLeads] = useState<NormalizedLead[]>(SAMPLE_LEADS);
  const [analysis, setAnalysis] = useState<FullStrategicAnalysis>(SAMPLE_STRATEGIC_ANALYSIS);
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_SCORING_WEIGHTS);
  const [scores, setScores] = useState<LeadICPScore[]>(SAMPLE_SCORES);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const segments = analysis.stpSegments;

  const toggleDemoMode = () => {
    setIsDemoMode((prev) => !prev);
    addToast(
      !isDemoMode ? 'Demo mode enabled. Synthetic dataset restored.' : 'Live mode enabled. External pipeline awaiting inputs.',
      'info'
    );
  };

  const updateSellerContext = (newContext: SellerProductContext) => {
    setSellerContext(newContext);
    try {
      localStorage.setItem('icp_mode_seller_context', JSON.stringify(newContext));
    } catch {}
    const mapped = contextToOfferingProfile(newContext);
    setOffering(mapped);
    addToast('Seller Product Context saved and calibrated.', 'success');
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
    setDatasets((prev) => [newDataset, ...prev]);
    setActiveDatasetId(newDataset.id);
    setLeads(newLeads);
    const newScores = batchScoreLeads(newLeads, offering, analysis, weights);
    setScores(newScores);
    addToast(`Dataset "${newDataset.filename}" ingested and scored!`, 'success');
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
        toasts,
        addToast,
        removeToast,
        clearToEmptyState,
        resetToDemoData,
      }}
    >
      {children}
    </AppStoreContext.Provider>
  );
};
