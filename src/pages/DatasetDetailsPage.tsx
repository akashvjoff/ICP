import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from '../lib/router';
import { useAppStore } from '../lib/store';
import { useAuth } from '../lib/auth';
import { AppLayout } from '../components/layout/AppLayout';
import { SectionEyebrow } from '../components/ui/SectionEyebrow';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { StatusChip } from '../components/ui/StatusChip';
import { TableShell } from '../components/ui/TableShell';
import { formatScore, formatHeadcount } from '../lib/formatters';
import type { NormalizedLead } from '../types/lead';
import type { AnalysisJobRecord, JobStatus, LeadAnalysisStatus } from '../server/analysisJobService';
import {
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Zap,
  Info,
  Compass,
  Target,
} from 'lucide-react';

export const DatasetDetailsPage: React.FC<{ params: { id: string } }> = ({ params }) => {
  const { navigate } = useRouter();
  const { session, isConfigured: isSupabaseConfigured } = useAuth();
  const {
    datasets,
    leads: storeLeads,
    scores,
    sellerContext,
    isDemoMode,
    addToast,
    updateDatasetProgress,
    updateLeadAnalysisStatuses,
  } = useAppStore();

  const datasetId = params.id || 'dataset-01';
  const dataset = datasets.find((d) => d.id === datasetId) || datasets[0] || {
    id: datasetId,
    filename: 'Q1_North_America_SaaS_Pipeline.csv',
    fileSize: '1.4 MB',
    totalRows: 5,
    validRows: 5,
    uploadedAt: '2026-03-20T08:15:00Z',
    status: 'Completed' as const,
    processingProgress: 100,
    tier1Count: 2,
    tier2Count: 2,
    disqualifiedCount: 1,
  };

  // Local job & lead states for live reactive UI
  const [job, setJob] = useState<AnalysisJobRecord>(() => {
    // Check localStorage checkpoint for demo/offline persistence
    if (!session?.access_token) {
      try {
        const savedJob = localStorage.getItem(`icp_mode_job_${datasetId}`);
        if (savedJob) return JSON.parse(savedJob);
      } catch {}
    }

    const eligibleCount = Math.min(100, storeLeads.filter((l) => l.isAiEnriched !== false).length);
    const skippedCount = Math.max(0, storeLeads.length - eligibleCount);
    return {
      id: `job-${datasetId}`,
      dataset_id: datasetId,
      owner_user_id: session?.user?.id || 'demo-user-id',
      status: (session?.access_token ? 'queued' : dataset.status === 'Completed' ? 'completed' : 'queued') as JobStatus,
      total_count: eligibleCount || dataset.validRows || 5,
      completed_count: !session?.access_token && dataset.status === 'Completed' ? (eligibleCount || dataset.validRows || 5) : 0,
      failed_count: 0,
      skipped_count: skippedCount,
      last_error: null,
      created_at: dataset.uploadedAt,
      updated_at: new Date().toISOString(),
    };
  });

  const [datasetLeads, setDatasetLeads] = useState<NormalizedLead[]>(() => {
    // Merge store leads with any saved local analysis status
    try {
      const savedStatuses = localStorage.getItem(`icp_mode_lead_statuses_${datasetId}`);
      if (savedStatuses) {
        const parsedMap: Record<string, LeadAnalysisStatus> = JSON.parse(savedStatuses);
        return storeLeads.map((l) => ({
          ...l,
          analysisStatus: parsedMap[l.id] || l.analysisStatus || (l.isAiEnriched === false ? 'skipped' : 'pending'),
        }));
      }
    } catch {}
    return storeLeads.map((l) => ({
      ...l,
      analysisStatus: l.analysisStatus || (l.isAiEnriched === false ? 'skipped' : 'pending'),
    }));
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quotaWarning, setQuotaWarning] = useState<boolean>(false);
  const [batchSize, setBatchSize] = useState<number>(3);

  // Execution refs to prevent race conditions or duplicate batch calls
  const isLoopActiveRef = useRef<boolean>(false);
  const isBatchInFlightRef = useRef<boolean>(false);

  // Sync to localStorage for resilient refresh recovery in demo mode
  const persistJobCheckpoint = useCallback((updatedJob: AnalysisJobRecord, updatedLeads?: NormalizedLead[]) => {
    try {
      localStorage.setItem(`icp_mode_job_${datasetId}`, JSON.stringify(updatedJob));
      if (updatedLeads) {
        const statusMap = Object.fromEntries(updatedLeads.map((l) => [l.id, l.analysisStatus || 'pending']));
        localStorage.setItem(`icp_mode_lead_statuses_${datasetId}`, JSON.stringify(statusMap));
      }
    } catch {}
  }, [datasetId]);

  // Load latest server state on mount
  useEffect(() => {
    let isMounted = true;
    async function fetchServerState() {
      setIsLoading(true);
      try {
        const token = session?.access_token || 'demo-token';
        const response = await fetch(`/api/analysis-jobs/by-dataset/${datasetId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (response.ok && isMounted) {
          const data = await response.json();
          if (data.job) {
            setJob(data.job);
            persistJobCheckpoint(data.job);
          }
          if (Array.isArray(data.leads)) {
            setDatasetLeads(data.leads.map((lead: {
              id: string; company_name: string; normalized_domain: string | null; website: string | null;
              industry_raw: string | null; employee_count: number | null; annual_revenue: number | null;
              notes: string | null; geography: string | null; analysis_eligible: boolean;
              analysis_status: LeadAnalysisStatus; created_at: string;
            }): NormalizedLead => ({
              id: lead.id, companyName: lead.company_name, domain: lead.normalized_domain,
              website: lead.website, industry: lead.industry_raw || '', headcount: lead.employee_count,
              annualRevenue: lead.annual_revenue == null ? null : String(lead.annual_revenue),
              description: lead.notes || '', country: lead.geography || '', technologies: [],
              isClean: true, isAiEnriched: lead.analysis_eligible,
              analysisStatus: lead.analysis_status || 'pending', ingestedAt: lead.created_at,
            })));
          }
        }
      } catch (err) {
        console.warn('[DatasetDetails] Server sync warning, using local checkpoint:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void fetchServerState();

    return () => {
      isMounted = false;
      isLoopActiveRef.current = false;
    };
  }, [datasetId, session?.access_token, persistJobCheckpoint]);

  // ----------------------------------------------------------------------------
  // BROWSER-DRIVEN SUCCESSIVE BATCH LOOP (Prompt 9 Architecture)
  // ----------------------------------------------------------------------------
  const processNextBatch = useCallback(async () => {
    if (isBatchInFlightRef.current || !isLoopActiveRef.current) return;
    isBatchInFlightRef.current = true;

    try {
      const token = session?.access_token || 'demo-token';
      const response = await fetch(`/api/analysis-jobs/${job.id}/process-batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchSize,
          enrichWebsite: false,
          sellerContext,
        }),
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.error || `Server responded with ${response.status}`);
      }

      const data = await response.json();
      const updatedJob: AnalysisJobRecord = data.job;

      // Update lead statuses from the batch response
      let nextLeads: NormalizedLead[] = datasetLeads;
      if (Array.isArray(data.processedLeads) && data.processedLeads.length > 0) {
        const processedMap = new Map<string, LeadAnalysisStatus>(
          data.processedLeads.map((pl: { id: string; status: LeadAnalysisStatus }) => [pl.id, pl.status])
        );

        nextLeads = datasetLeads.map((l): NormalizedLead => {
          const newStatus = processedMap.get(l.id);
          return newStatus ? { ...l, analysisStatus: newStatus } : l;
        });

        setDatasetLeads(nextLeads);

        // Update central store
        const statusMapRecord: Record<string, LeadAnalysisStatus> = {};
        for (const pl of data.processedLeads) {
          statusMapRecord[pl.id] = pl.status;
        }
        updateLeadAnalysisStatuses(statusMapRecord);
      }

      setJob(updatedJob);
      persistJobCheckpoint(updatedJob, nextLeads);

      const percent = updatedJob.total_count > 0
        ? Math.min(100, Math.round((updatedJob.completed_count / updatedJob.total_count) * 100))
        : 100;
      updateDatasetProgress(
        datasetId,
        percent,
        updatedJob.status === 'completed' ? 'Completed' : 'Processing'
      );

      // Handle Quota Exhaustion
      if (data.quotaExceeded) {
        setQuotaWarning(true);
        isLoopActiveRef.current = false;
        setErrorMessage('AI rate limit or free tier quota reached. Job has paused safely. Resume when quota resets.');
        addToast('AI rate limit reached. Progress preserved. Processing paused gracefully.', 'warning');
        return;
      }

      // Check termination conditions
      if (
        updatedJob.status === 'completed' ||
        updatedJob.status === 'completed_with_errors' ||
        updatedJob.status === 'failed' ||
        updatedJob.status === 'paused' ||
        updatedJob.status === 'cancelled' ||
        data.remainingCount === 0
      ) {
        isLoopActiveRef.current = false;
        if (updatedJob.status === 'completed') {
          addToast(`Batch analysis completed! All ${updatedJob.completed_count} companies analyzed.`, 'success');
        } else if (updatedJob.status === 'completed_with_errors') {
          addToast(`Analysis finished with ${updatedJob.failed_count} failure(s).`, 'warning');
        }
        return;
      }

      // If more pending leads remain and job is running, schedule next batch
      if (isLoopActiveRef.current && data.remainingCount > 0) {
        setTimeout(() => {
          void processNextBatch();
        }, 200);
      }
    } catch (err) {
      isLoopActiveRef.current = false;
      const msg = err instanceof Error ? err.message : 'Batch processing encountered a network error.';
      setErrorMessage(msg);
      addToast(msg, 'warning');
    } finally {
      isBatchInFlightRef.current = false;
    }
  }, [
    job.id,
    batchSize,
    sellerContext,
    session?.access_token,
    datasetLeads,
    datasetId,
    persistJobCheckpoint,
    updateDatasetProgress,
    updateLeadAnalysisStatuses,
    addToast,
  ]);

  // ----------------------------------------------------------------------------
  // USER ACTIONS
  // ----------------------------------------------------------------------------
  const handleStartAnalysis = async () => {
    setErrorMessage(null);
    setQuotaWarning(false);
    setIsLoading(true);

    try {
      const token = session?.access_token || 'demo-token';
      const response = await fetch(`/api/analysis-jobs/${job.id}/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to start analysis job.');
      }

      const data = await response.json();
      setJob(data.job);
      persistJobCheckpoint(data.job);

      addToast(`Batch analysis started for ${job.total_count} companies (batch size: ${batchSize}).`, 'info');
      isLoopActiveRef.current = true;
      setIsLoading(false);

      // Begin successive batch loop
      void processNextBatch();
    } catch (err) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Unable to start job.';
      setErrorMessage(msg);
      addToast(msg, 'warning');
    }
  };

  const handlePause = async () => {
    isLoopActiveRef.current = false;
    setIsLoading(true);
    try {
      const token = session?.access_token || 'demo-token';
      const response = await fetch(`/api/analysis-jobs/${job.id}/pause`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setJob(data.job);
        persistJobCheckpoint(data.job);
        addToast('Analysis paused. Remaining companies saved at checkpoint.', 'info');
      }
    } catch {
      // Local fallback
      setJob((prev) => ({ ...prev, status: 'paused' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setErrorMessage(null);
    setQuotaWarning(false);
    setIsLoading(true);
    try {
      const token = session?.access_token || 'demo-token';
      const response = await fetch(`/api/analysis-jobs/${job.id}/resume`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to resume analysis job.');
      }

      const data = await response.json();
      setJob(data.job);
      persistJobCheckpoint(data.job);

      addToast('Analysis resumed from saved checkpoint.', 'info');
      isLoopActiveRef.current = true;
      setIsLoading(false);

      void processNextBatch();
    } catch (err) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Unable to resume job.';
      setErrorMessage(msg);
      addToast(msg, 'warning');
    }
  };

  const handleRetryFailed = async () => {
    setErrorMessage(null);
    setQuotaWarning(false);
    setIsLoading(true);
    try {
      const token = session?.access_token || 'demo-token';
      const response = await fetch(`/api/analysis-jobs/${job.id}/retry-failed`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to retry failed leads.');
      }

      const data = await response.json();
      setJob(data.job);

      // Reset failed leads in local state to pending
      const nextLeads = datasetLeads.map((l) =>
        l.analysisStatus === 'failed' ? { ...l, analysisStatus: 'pending' as LeadAnalysisStatus } : l
      );
      setDatasetLeads(nextLeads);
      persistJobCheckpoint(data.job, nextLeads);

      addToast('Failed companies reset to pending. Retrying analysis now...', 'info');
      isLoopActiveRef.current = true;
      setIsLoading(false);

      void processNextBatch();
    } catch (err) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Unable to retry.';
      setErrorMessage(msg);
      addToast(msg, 'warning');
    }
  };

  const handleCancel = async () => {
    isLoopActiveRef.current = false;
    setIsLoading(true);
    try {
      const token = session?.access_token || 'demo-token';
      const response = await fetch(`/api/analysis-jobs/${job.id}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setJob(data.job);
        persistJobCheckpoint(data.job);
        addToast('Batch analysis job cancelled.', 'warning');
      }
    } catch {
      setJob((prev) => ({ ...prev, status: 'cancelled' }));
    } finally {
      setIsLoading(false);
    }
  };

  // Calculations
  const processedCount = job.completed_count + job.failed_count;
  const remainingCount = Math.max(0, job.total_count - processedCount);
  const percentCompleted = job.total_count > 0
    ? Math.min(100, Math.round((job.completed_count / job.total_count) * 100))
    : 100;
  const inFlightCount = job.status === 'running' ? Math.min(batchSize, remainingCount) : 0;

  return (
    <AppLayout>
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-[2.5px] border-[#0A0A0A] pb-6">
          <div>
            <SectionEyebrow color="bg-[#8C6ADE]">
              BATCH ANALYSIS ENGINE · STAGE 1
            </SectionEyebrow>
            <h1 className="text-3xl sm:text-4xl font-black text-[#0A0A0A] tracking-tight">
              {dataset.filename}
            </h1>
            <p className="font-mono text-xs text-[#0A0A0A]/60 font-bold mt-1">
              DATASET ID: {dataset.id} · SIZE: {dataset.fileSize} · UPLOADED: {new Date(dataset.uploadedAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto flex-wrap">
            <BrutalistButton
              variant="white"
              size="sm"
              onClick={() => navigate('/uploads/new')}
            >
              UPLOAD NEW FILE
            </BrutalistButton>

            <BrutalistButton
              variant="lime"
              size="sm"
              onClick={() => navigate(`/companies`)}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              VIEW ALL COMPANIES
            </BrutalistButton>

            <BrutalistButton
              variant="lime"
              size="sm"
              onClick={() => navigate(`/icp/report/${dataset.id}`)}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              VIEW ICP REPORT
            </BrutalistButton>
          </div>
        </div>

        {/* Demo Mode Notice */}
        {(!isSupabaseConfigured || isDemoMode) && (
          <div className="bg-[#FFE3B3]/40 border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[3px_3px_0px_#0A0A0A] flex items-center gap-3 text-xs font-mono font-bold text-[#0A0A0A]">
            <Info className="w-4 h-4 text-[#8C6ADE] shrink-0" />
            <span>
              DEMO PERSISTENCE SANDBOX: Job states & completed profiles are cached across browser refreshes in local storage. Production mode persists durably to PostgreSQL.
            </span>
          </div>
        )}

        {/* Error / Quota Alert Banner */}
        {(errorMessage || job.last_error || quotaWarning) && (
          <div className="bg-[#FFB6C2] border-[2.5px] border-[#0A0A0A] p-4 rounded-xl shadow-[4px_4px_0px_#0A0A0A] flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-900 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-mono text-xs font-black uppercase text-rose-950">
                {quotaWarning ? 'AI RATE LIMIT / QUOTA REACHED' : 'BATCH PROCESSING NOTICE'}
              </div>
              <p className="text-sm font-sans font-bold text-[#0A0A0A]">
                {errorMessage || job.last_error}
              </p>
              <p className="text-xs font-mono text-[#0A0A0A]/70">
                All previously analyzed company records remain saved. You can resume processing at any time without losing completed work.
              </p>
            </div>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Status */}
          <div className="bg-[#E4E6FB] border-[2.5px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_4px_0px_#0A0A0A]">
            <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block mb-1">
              JOB STATUS
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <StatusChip
                color={
                  job.status === 'completed'
                    ? 'mint'
                    : job.status === 'running'
                    ? 'lime'
                    : job.status === 'paused'
                    ? 'peach'
                    : job.status === 'failed' || job.status === 'completed_with_errors'
                    ? 'pink'
                    : 'lavender'
                }
              >
                {job.status === 'running' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-black animate-ping mr-1" />}
                {job.status.toUpperCase()}
              </StatusChip>
            </div>
          </div>

          {/* Total Companies */}
          <div className="bg-[#FFE3B3] border-[2.5px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_4px_0px_#0A0A0A]">
            <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block mb-1">
              TOTAL LEADS
            </span>
            <span className="text-2xl font-black font-mono text-[#0A0A0A]">
              {dataset.totalRows}
            </span>
            <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/70 block mt-0.5">
              {job.total_count} AI-eligible
            </span>
          </div>

          {/* Completed */}
          <div className="bg-[#E5F7E5] border-[2.5px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_4px_0px_#0A0A0A]">
            <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block mb-1">
              COMPLETED
            </span>
            <span className="text-2xl font-black font-mono text-emerald-900">
              {job.completed_count}
            </span>
            <span className="font-mono text-[10px] font-bold text-emerald-800 block mt-0.5">
              {percentCompleted}% analyzed
            </span>
          </div>

          {/* In Flight */}
          <div className="bg-white border-[2.5px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_4px_0px_#0A0A0A]">
            <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block mb-1">
              IN FLIGHT
            </span>
            <span className="text-2xl font-black font-mono text-[#0A0A0A]">
              {inFlightCount}
            </span>
            <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/60 block mt-0.5">
              {job.status === 'running' ? 'Processing now' : 'Idle'}
            </span>
          </div>

          {/* Failed */}
          <div className="bg-[#FFB6C2] border-[2.5px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_4px_0px_#0A0A0A]">
            <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block mb-1">
              FAILED
            </span>
            <span className="text-2xl font-black font-mono text-rose-950">
              {job.failed_count}
            </span>
            <span className="font-mono text-[10px] font-bold text-rose-800 block mt-0.5">
              {job.failed_count > 0 ? 'Retry available' : '0 errors'}
            </span>
          </div>

          {/* Remaining */}
          <div className="bg-[#F9F8F4] border-[2.5px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_4px_0px_#0A0A0A]">
            <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block mb-1">
              REMAINING
            </span>
            <span className="text-2xl font-black font-mono text-[#0A0A0A]">
              {remainingCount}
            </span>
            <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/60 block mt-0.5">
              {job.skipped_count > 0 ? `${job.skipped_count} skipped` : 'Pending queue'}
            </span>
          </div>
        </div>

        {/* Large Brutalist Progress Bar Section */}
        <div className="bg-white border-[2.5px] border-[#0A0A0A] p-6 rounded-2xl shadow-[4px_5px_0px_#0A0A0A] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]/70 tracking-wider">
                BATCH ANALYSIS PROGRESS
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-[#0A0A0A]">
                {job.completed_count} of {job.total_count} Companies Analyzed
              </h2>
            </div>
            <div className="font-mono text-2xl font-black text-[#0A0A0A] tabular-nums">
              {percentCompleted}%
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="w-full bg-[#F0EFEA] border-[2.5px] border-[#0A0A0A] h-8 rounded-lg overflow-hidden shadow-[2px_2px_0px_#0A0A0A] relative">
            <div
              className="bg-[#A1F000] h-full transition-all duration-300 ease-out flex items-center justify-end pr-2 border-r-[2px] border-[#0A0A0A]"
              style={{ width: `${percentCompleted}%` }}
            >
              {percentCompleted > 15 && (
                <span className="font-mono text-[10px] font-black text-[#0A0A0A] tracking-wider">
                  {percentCompleted}%
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t-[1.5px] border-[#0A0A0A]/15">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Start Button */}
              {job.status === 'queued' && (
                <BrutalistButton
                  variant="lime"
                  size="md"
                  onClick={handleStartAnalysis}
                  disabled={isLoading}
                  icon={<Play className="w-4 h-4 fill-black" />}
                >
                  START ANALYSIS
                </BrutalistButton>
              )}

              {/* Pause Button */}
              {job.status === 'running' && (
                <BrutalistButton
                  variant="peach"
                  size="md"
                  onClick={handlePause}
                  disabled={isLoading}
                  icon={<Pause className="w-4 h-4 fill-black" />}
                >
                  PAUSE
                </BrutalistButton>
              )}

              {/* Resume Button */}
              {job.status === 'paused' && (
                <BrutalistButton
                  variant="lime"
                  size="md"
                  onClick={handleResume}
                  disabled={isLoading}
                  icon={<Play className="w-4 h-4 fill-black" />}
                >
                  RESUME ANALYSIS
                </BrutalistButton>
              )}

              {/* Retry Failed Button */}
              {job.failed_count > 0 && job.status !== 'running' && (
                <BrutalistButton
                  variant="peach"
                  size="md"
                  onClick={handleRetryFailed}
                  disabled={isLoading}
                  icon={<RotateCcw className="w-4 h-4" />}
                >
                  RETRY {job.failed_count} FAILED
                </BrutalistButton>
              )}

              {/* Cancel Button */}
              {(job.status === 'running' || job.status === 'paused') && (
                <BrutalistButton
                  variant="white"
                  size="md"
                  onClick={handleCancel}
                  disabled={isLoading}
                  icon={<XCircle className="w-4 h-4 text-rose-700" />}
                >
                  CANCEL
                </BrutalistButton>
              )}

              {/* Completed: View Results */}
              {(job.status === 'completed' || job.status === 'completed_with_errors') && (
                <>
                  <BrutalistButton
                    variant="lime"
                    size="md"
                    onClick={() => navigate('/companies')}
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    VIEW RESULTS
                  </BrutalistButton>

                  <BrutalistButton
                    variant="purple"
                    size="md"
                    onClick={() => navigate(`/strategy/${datasetId}`)}
                    icon={<Compass className="w-4 h-4 text-white" />}
                  >
                    VIEW 5C STRATEGY
                  </BrutalistButton>
                </>
              )}
            </div>

            {/* Batch Size Selector */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#0A0A0A]/70">
                BATCH SIZE:
              </span>
              <div className="flex items-center gap-1 border-[2px] border-[#0A0A0A] rounded-lg p-0.5 bg-[#F9F8F4]">
                {[3, 4, 5].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setBatchSize(size)}
                    disabled={job.status === 'running'}
                    className={`font-mono text-xs font-black px-2.5 py-1 rounded transition-colors ${
                      batchSize === size
                        ? 'bg-[#A1F000] text-[#0A0A0A] border-[1.5px] border-[#0A0A0A]'
                        : 'text-[#0A0A0A]/70 hover:bg-[#FFE3B3]'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Strategic Marketing Analysis (Need Gap & 5C) Callout */}
        <div className="bg-[#FFE3B3] border-[2.5px] border-[#0A0A0A] p-5 rounded-xl shadow-[4px_4px_0px_#0A0A0A] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-mono text-xs font-black uppercase text-[#0A0A0A]">
              <Target className="w-4 h-4 text-[#8C6ADE]" />
              <span>PHASE 1 &amp; 2: NEED GAP &amp; 5C STAKEHOLDER FEASIBILITY</span>
            </div>
            <p className="text-xs text-[#0A0A0A]/85 font-medium leading-relaxed max-w-2xl">
              Evaluate operational need gaps across this cohort. Discovers shared acute customer friction points and synthesizes 5C marketing feasibility before running STP segmentation.
            </p>
          </div>

          <BrutalistButton
            variant="lime"
            size="sm"
            onClick={() => navigate(`/strategy/${datasetId}`)}
            icon={<Compass className="w-4 h-4" />}
          >
            OPEN STRATEGIC ANALYSIS
          </BrutalistButton>
        </div>

        {/* Ingested Accounts Table with Live Analysis Status */}
        <TableShell
          title="Ingested Accounts in this Batch"
          countLabel={`${datasetLeads.length} ACCOUNTS`}
        >
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b-[2.5px] border-[#0A0A0A] bg-[#F9F8F4] text-[#0A0A0A]">
                <th className="py-3 px-4 font-black tracking-wider uppercase">COMPANY</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase">VERTICAL</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase text-right">HEADCOUNT</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase text-center">ANALYSIS STATUS</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase text-right">FIT SCORE</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y-[1.5px] divide-[#0A0A0A]/15 font-sans font-medium">
              {datasetLeads.map((lead) => {
                const score = scores.find((candidate) => candidate.leadId === lead.id);
                const leadStatus = lead.analysisStatus || (lead.isAiEnriched === false ? 'skipped' : 'pending');

                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-[#FFE3B3]/20 transition-colors cursor-pointer"
                    onClick={() => navigate(`/companies/${lead.id}`)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-[#0A0A0A] text-sm">
                        {lead.companyName}
                      </div>
                      <div className="font-mono text-[11px] text-[#0A0A0A]/60 font-bold">
                        {lead.domain || 'No website'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#0A0A0A]/85 font-semibold">
                      {lead.industry || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-[#0A0A0A]">
                      {formatHeadcount(lead.headcount)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusChip
                        color={
                          leadStatus === 'completed'
                            ? 'mint'
                            : leadStatus === 'processing'
                            ? 'peach'
                            : leadStatus === 'failed'
                            ? 'pink'
                            : leadStatus === 'skipped'
                            ? 'lavender'
                            : 'white'
                        }
                      >
                        {leadStatus === 'processing' && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-black animate-ping mr-1" />
                        )}
                        {leadStatus.toUpperCase()}
                      </StatusChip>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      <span className="text-base font-black text-[#0A0A0A]">
                        {score ? formatScore(score.totalScore) : '—'}
                      </span>
                      {score && <span className="text-[#0A0A0A]/40 text-xs font-bold"> / 100</span>}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/companies/${lead.id}`);
                        }}
                        className="font-mono text-xs font-black text-[#0A0A0A] bg-[#FFE3B3] border-[1.5px] border-[#0A0A0A] px-2.5 py-1 rounded-md shadow-[1.5px_1.5px_0px_#0A0A0A] hover:bg-[#A1F000] cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>VIEW DOSSIER</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      </div>
    </AppLayout>
  );
};
