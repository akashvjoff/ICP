import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from '../lib/router';
import { useAppStore, DatasetMeta } from '../lib/store';
import { useAuth } from '../lib/auth';
import { freshAccessToken, isSupabaseConfigured } from '../lib/supabase';
import { AppLayout } from '../components/layout/AppLayout';
import { SectionHeading } from '../components/ui/SectionHeading';
import { SectionEyebrow } from '../components/ui/SectionEyebrow';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { ProgressStepper, StepItem } from '../components/ui/ProgressStepper';
import { TableShell } from '../components/ui/TableShell';
import { StatusChip } from '../components/ui/StatusChip';
import { StickerBadge } from '../components/ui/StickerBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import {
  parseLeadFile,
  processLeadPipeline,
  generateSampleCsvContent,
  ParseResult,
  PipelineProcessResult,
} from '../lib/leadPipeline';
import { UPLOAD_CONFIG, formatBytes } from '../lib/uploadConfig';
import { PLANS } from '../config/plans';
import { savePendingUpload, getPendingUpload, clearPendingUpload, pendingUploadKey } from '../lib/pendingUpload';
import { RawLeadRecord, ColumnMapping } from '../types/lead';
import { formatHeadcount } from '../lib/formatters';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Download,
  ShieldAlert,
  Info,
  Layers,
  FileText,
  Trash2,
  Filter,
} from 'lucide-react';

export const UploadWizardPage: React.FC = () => {
  const { navigate } = useRouter();
  const { addDataset, addToast, isContextComplete, missingContextFields } = useAppStore();
  const { isDemoUser } = useAuth();

  // Wizard Navigation
  const [wizardStep, setWizardStep] = useState<number>(1);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('sample_b2b_leads.csv');
  const [fileSizeStr, setFileSizeStr] = useState<string>('1.4 MB');
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Parsed headers & raw rows
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawLeadRecord[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [piiColumnsDetected, setPiiColumnsDetected] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);

  // Pipeline result
  const [pipelineResult, setPipelineResult] = useState<PipelineProcessResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [activeReviewTab, setActiveReviewTab] = useState<'valid' | 'duplicates' | 'invalid' | 'privacy'>('valid');

  // Step 4 processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('Initializing pipeline...');
  const [progressPercent, setProgressPercent] = useState(0);
  const [createdDatasetId, setCreatedDatasetId] = useState<string>('');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [resumeReady, setResumeReady] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeStarted = useRef(false);

  const wizardSteps: StepItem[] = [
    { id: '1', num: '01', label: 'CHOOSE FILE', pastelBg: 'peach' },
    { id: '2', num: '02', label: 'MAP COLUMNS', pastelBg: 'lavender' },
    { id: '3', num: '03', label: 'REVIEW HYGIENE', pastelBg: 'mint' },
    { id: '4', num: '04', label: 'PROCESS DATASET', pastelBg: 'pink' },
  ];

  // Helper to re-run pipeline when mapping or duplicate preference changes
  const runPipeline = (currentRaw: RawLeadRecord[], currentMapping: ColumnMapping, dedupe: boolean) => {
    if (currentRaw.length === 0) return;
    const res = processLeadPipeline(currentRaw, currentMapping, {
      maxTotalRows: isDemoUser ? UPLOAD_CONFIG.MAX_ROWS_PER_DATASET : PLANS[0].uploadRowLimit,
      maxAiEnrichedDemo: isDemoUser ? UPLOAD_CONFIG.MAX_AI_ENRICHED_ROWS_DEMO : PLANS[0].companiesPerDataset,
      skipDuplicates: dedupe,
      piiColumnsToScrub: piiColumnsDetected,
    });
    setPipelineResult(res);
  };

  // ----------------------------------------------------------------------------
  // STEP 1: FILE SELECTION & PARSING
  // ----------------------------------------------------------------------------
  const handleProcessSelectedFile = async (selectedFile: File, pending?: { mapping: ColumnMapping; skipDuplicates: boolean }) => {
    setFileError(null);
    try {
      const parsed: ParseResult = await parseLeadFile(selectedFile);
      if (!isDemoUser && !selectedFile.name.toLowerCase().endsWith('.csv')) throw new Error('The Free plan accepts CSV files only.');
      if (!isDemoUser && parsed.rawRows.length > PLANS[0].uploadRowLimit) throw new Error(`The Free plan accepts up to ${PLANS[0].uploadRowLimit} rows per file.`);
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setFileSizeStr(formatBytes(selectedFile.size));
      setRawHeaders(parsed.headers);
      setRawRows(parsed.rawRows);
      const activeMapping = pending?.mapping || parsed.detectedMapping;
      const activeDedupe = pending?.skipDuplicates ?? skipDuplicates;
      setMapping(activeMapping);
      setSkipDuplicates(activeDedupe);
      setPiiColumnsDetected(parsed.piiColumnsDetected);
      setParseWarnings(parsed.parseErrors);

      // Run pipeline on raw rows with auto-detected mapping
      const res = processLeadPipeline(parsed.rawRows, activeMapping, {
        maxTotalRows: isDemoUser ? UPLOAD_CONFIG.MAX_ROWS_PER_DATASET : PLANS[0].uploadRowLimit,
        maxAiEnrichedDemo: isDemoUser ? UPLOAD_CONFIG.MAX_AI_ENRICHED_ROWS_DEMO : PLANS[0].companiesPerDataset,
        skipDuplicates: activeDedupe,
        piiColumnsToScrub: parsed.piiColumnsDetected,
      });
      setPipelineResult(res);

      addToast(`Parsed ${parsed.rawRows.length} rows from "${selectedFile.name}".`, 'info');
      setWizardStep(pending ? 4 : 2);
      if (pending) setResumeReady(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse file.';
      setFileError(msg);
      addToast(msg, 'warning');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    handleProcessSelectedFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleProcessSelectedFile(droppedFile);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = generateSampleCsvContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'icp_mode_sample_leads_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('Sample CSV template downloaded.', 'success');
  };

  const handleLoadCalibratedSample = () => {
    const content = generateSampleCsvContent();
    const sampleFile = new File([content], 'Q1_Enterprise_Observed_Leads.csv', { type: 'text/csv' });
    void handleProcessSelectedFile(sampleFile);
  };

  // ----------------------------------------------------------------------------
  // STEP 2: COLUMN MAPPING
  // ----------------------------------------------------------------------------
  const handleUpdateMapping = (field: keyof ColumnMapping, val: string) => {
    const duplicateTarget = Object.entries(mapping).find(
      ([target, source]) => target !== field && Boolean(val) && source === val
    );
    if (duplicateTarget) {
      const message = `Column "${val}" is already mapped to ${duplicateTarget[0]}. Choose a different source column.`;
      setFileError(message);
      addToast(message, 'warning');
      return;
    }
    setFileError(null);
    const updated = { ...mapping, [field]: val || undefined };
    setMapping(updated);
    runPipeline(rawRows, updated, skipDuplicates);
  };

  // ----------------------------------------------------------------------------
  // STEP 3: HYGIENE & REVIEW
  // ----------------------------------------------------------------------------

  // ----------------------------------------------------------------------------
  // STEP 4: PERSISTENCE & PROCESSING
  // ----------------------------------------------------------------------------
  const executeProcessing = async () => {
    if (!pipelineResult || pipelineResult.validLeads.length === 0) {
      setProcessingError('No valid leads found to ingest.');
      return;
    }

    setIsProcessing(true);
    setProcessingError(null);
    setCreatedDatasetId('');
    setProgressPercent(10);
    setProcessingStage('Revalidating the original file at the secure upload boundary...');

    const finalLeads = pipelineResult.validLeads;
    let storedLeads = finalLeads;
    const newDatasetId = `dataset-${Date.now().toString().slice(-6)}`;

    // Compute tier distributions
    const tier1Count = 0;
    const tier2Count = 0;
    const disqualifiedCount = 0;

    const datasetMeta: DatasetMeta = {
      id: newDatasetId,
      filename: fileName,
      fileSize: fileSizeStr,
      totalRows: rawRows.length,
      validRows: finalLeads.length,
      uploadedAt: new Date().toISOString(),
      status: 'Processing',
      processingProgress: 0,
      tier1Count,
      tier2Count,
      disqualifiedCount,
    };

    try {
      if (isDemoUser) {
        throw new Error('Demo only: sign in to save and analyze your file.');
      }
      if (isSupabaseConfigured) {
        if (!file) throw new Error('Select the original CSV or XLSX file before saving to your workspace.');
        setProgressPercent(45);
        setProcessingStage('Saving the validated dataset and leads to your workspace...');
        const fileBase64 = await fileToBase64(file);
        const token = await freshAccessToken();
        const response = await fetch('/api/uploads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileName: file.name,
            fileSizeBytes: file.size,
            fileBase64,
            mapping,
            skipDuplicates,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'The upload could not be saved.');
        if (typeof payload.datasetId !== 'string' || !payload.datasetId) throw new Error('The dataset was not confirmed as saved. Please retry.');
        datasetMeta.id = payload.datasetId;
        datasetMeta.validRows = payload.summary?.validRowsCount ?? finalLeads.length;
        datasetMeta.totalRows = payload.summary?.totalRowsParsed ?? rawRows.length;
        if (Array.isArray(payload.leadIds) && payload.leadIds.length === finalLeads.length) {
          storedLeads = finalLeads.map((lead, index) => ({ ...lead, id: payload.leadIds[index] }));
        }
        setCreatedDatasetId(payload.datasetId);
      } else {
        throw new Error('Saving is unavailable right now. Please try again later.');
      }

      setProgressPercent(100);
      setProcessingStage('Dataset stored. Analysis job queued for the next pipeline stage.');

      // Add to central workspace store
      addDataset(datasetMeta, storedLeads);
      if (sessionStorage.getItem(pendingUploadKey)) {
        await clearPendingUpload().catch(() => undefined);
        sessionStorage.removeItem(pendingUploadKey);
      }
      setIsProcessing(false);
      navigate(`/uploads/${datasetMeta.id}`);
    } catch (err: unknown) {
      setIsProcessing(false);
      const msg = err instanceof Error ? err.message : 'Processing failed.';
      setProcessingError(msg);
      addToast(msg, 'warning');
    }
  };

  useEffect(() => {
    if (isDemoUser || !sessionStorage.getItem(pendingUploadKey) || resumeStarted.current) return;
    resumeStarted.current = true;
    void getPendingUpload().then(pending => {
      if (!pending) throw new Error('Your selected file is no longer available. Please choose it again.');
      return handleProcessSelectedFile(pending.file, pending);
    }).catch(error => setFileError(error instanceof Error ? error.message : 'Could not restore your file.'));
  }, [isDemoUser]);

  useEffect(() => {
    if (resumeReady && pipelineResult && file && !isDemoUser) {
      setResumeReady(false);
      void executeProcessing();
    }
  }, [resumeReady, pipelineResult, file, isDemoUser]);

  const continueToSignIn = async () => {
    if (!file) {
      setProcessingError('Select a file before signing in.');
      return;
    }
    try {
      await savePendingUpload({ file, mapping, skipDuplicates });
      sessionStorage.setItem(pendingUploadKey, '1');
      navigate('/auth');
    } catch {
      setProcessingError('Could not keep your file for sign-in. Please try again.');
    }
  };

  const fileToBase64 = (selectedFile: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      const commaIndex = value.indexOf(',');
      if (commaIndex < 0) reject(new Error('Unable to encode the selected file.'));
      else resolve(value.slice(commaIndex + 1));
    };
    reader.onerror = () => reject(new Error('Unable to read the selected file.'));
    reader.readAsDataURL(selectedFile);
  });

  // Helper to preview sample values for a header
  const getSampleValues = (headerName?: string): string => {
    if (!headerName || rawRows.length === 0) return '';
    const samples = rawRows
      .slice(0, 2)
      .map((r) => String(r[headerName] || '').trim())
      .filter(Boolean);
    return samples.length > 0 ? `e.g. "${samples.join('", "')}"` : '';
  };

  const additionalMappingFields: Array<{ key: keyof ColumnMapping; label: string }> = [
    { key: 'companyType', label: 'COMPANY TYPE' },
    { key: 'product', label: 'PRODUCT / SERVICE' },
    { key: 'currency', label: 'CURRENCY CODE' },
    { key: 'retentionMonths', label: 'RETENTION (MONTHS)' },
    { key: 'reasonWonLost', label: 'REASON WON / LOST' },
    { key: 'description', label: 'DESCRIPTION / NOTES' },
  ];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Header & Stepper */}
        <div className="border-b-[2.5px] border-[#0A0A0A] pb-6">
          <ProgressStepper
            steps={wizardSteps}
            currentStepId={String(wizardStep)}
            onSelectStep={(id) => {
              const target = parseInt(id, 10);
              if (target < wizardStep || (target === 2 && rawRows.length > 0) || (target === 3 && pipelineResult)) {
                setWizardStep(target);
              }
            }}
            className="mb-6"
          />

          <SectionHeading
            eyebrow={`UPLOAD PIPELINE // STEP 0${wizardStep} OF 04`}
            eyebrowColor="bg-[#A1F000]"
            title={
              wizardStep === 1
                ? 'Step 1: Choose Your Lead File'
                : wizardStep === 2
                ? 'Step 2: Map Firmographic & Commercial Columns'
                : wizardStep === 3
                ? 'Step 3: Review Data Hygiene & Duplicates'
                : 'Step 4: Save Your Lead List'
            }
            description={
              wizardStep === 1
                ? isDemoUser ? `Preview CSV or XLSX spreadsheets up to ${UPLOAD_CONFIG.MAX_FILE_SIZE_LABEL}.` : `Upload CSV files up to ${UPLOAD_CONFIG.MAX_FILE_SIZE_LABEL}. Max ${PLANS[0].uploadRowLimit} rows and ${PLANS[0].companiesPerDataset} AI-analyzed companies.`
                : wizardStep === 2
                ? 'Confirm company identifiers, firmographics, and CRM commercial parameters. Personal contact data will be automatically redacted.'
                : wizardStep === 3
                ? 'Verify domain hygiene, duplicate detection, and schema validation before writing to database.'
                : isDemoUser ? 'Preview your validated file before signing in to save it.' : 'Saving your accounts and preparing them for analysis.'
            }
          />
        </div>

        {/* Missing Seller Context Warning Guidance */}
        {!isContextComplete && (
          <div className="bg-[#FFE3B3] border-[2.5px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0" />
              <span className="font-bold text-[#0A0A0A]">
                <strong>Warning:</strong> Seller product context is missing required parameters ({missingContextFields.slice(0, 2).join(', ')}). Incomplete context will lead to ungrounded ICP conclusions.
              </span>
            </div>
            <button
              onClick={() => navigate('/onboarding')}
              className="font-mono text-xs font-black uppercase text-[#0A0A0A] underline hover:text-[#8C6ADE] cursor-pointer whitespace-nowrap"
            >
              CALIBRATE PROFILE NOW →
            </button>
          </div>
        )}

        {/* =========================================================================
            STEP 1: CHOOSE FILE
           ========================================================================= */}
        {wizardStep === 1 && (
          <div className="space-y-6">
            {/* File Error Alert */}
            {fileError && (
              <div className="bg-[#FFB6C2] border-[2.5px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A] flex items-center gap-3 text-xs text-[#0A0A0A]">
                <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0" />
                <div className="font-bold">{fileError}</div>
              </div>

            )}

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`bg-white border-[3px] border-dashed rounded-2xl p-10 sm:p-14 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150 shadow-[4px_5px_0px_#0A0A0A] hover:-translate-y-0.5 group ${
                isDragging ? 'border-[#8C6ADE] bg-[#E4E6FB]/40' : 'border-[#0A0A0A] hover:border-[#8C6ADE]'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept={isDemoUser ? '.csv,.xlsx' : '.csv'}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-full bg-[#A1F000] border-[2.5px] border-[#0A0A0A] flex items-center justify-center text-[#0A0A0A] mb-4 shadow-[2px_2px_0px_#0A0A0A] group-hover:scale-110 transition-transform">
                <UploadCloud className="w-8 h-8 stroke-[2.5]" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-[#0A0A0A] mb-1">
                Drop your CSV or XLSX file here
              </h3>
              <p className="text-xs sm:text-sm text-[#0A0A0A]/70 max-w-md mb-4 font-medium">
                Supports {isDemoUser ? '.csv and .xlsx' : '.csv'} files up to {UPLOAD_CONFIG.MAX_FILE_SIZE_LABEL}. Headers are detected automatically.
              </p>
              <span className="font-mono text-xs font-bold text-[#8C6ADE] underline underline-offset-4">
                Click to browse files on your computer
              </span>
            </div>

            {/* Ingestion Constraints Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[2px_2px_0px_#0A0A0A]">
                <span className="font-black text-[#0A0A0A]/60 block text-[10px] uppercase">MAX FILE SIZE</span>
                <span className="text-base font-black text-[#0A0A0A]">{UPLOAD_CONFIG.MAX_FILE_SIZE_LABEL}</span>
                <span className="text-[10px] text-[#0A0A0A]/70 block mt-1">Single table upload</span>
              </div>
              <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[2px_2px_0px_#0A0A0A]">
                <span className="font-black text-[#0A0A0A]/60 block text-[10px] uppercase">MAX STORED ROWS</span>
                <span className="text-base font-black text-[#0A0A0A]">{isDemoUser ? UPLOAD_CONFIG.MAX_ROWS_PER_DATASET : PLANS[0].uploadRowLimit} Records</span>
                <span className="text-[10px] text-[#0A0A0A]/70 block mt-1">All rows stored & inspectable</span>
              </div>
              <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[2px_2px_0px_#0A0A0A]">
                <span className="font-black text-[#0A0A0A]/60 block text-[10px] uppercase">AI ENRICHMENT TIER</span>
                <span className="text-base font-black text-emerald-900">{isDemoUser ? UPLOAD_CONFIG.MAX_AI_ENRICHED_ROWS_DEMO : PLANS[0].companiesPerDataset} Accounts</span>
                <span className="text-[10px] text-emerald-800 block mt-1">Deep strategic classification</span>
              </div>
            </div>

            {/* Action Bar for Sample & Template */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="font-mono text-xs font-black uppercase text-[#0A0A0A] bg-white border-[2px] border-[#0A0A0A] px-4 py-2.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A] hover:bg-[#FFE3B3] cursor-pointer inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>DOWNLOAD EXAMPLE CSV TEMPLATE</span>
              </button>

              <BrutalistButton
                variant="lavender"
                size="md"
                onClick={handleLoadCalibratedSample}
                icon={<Sparkles className="w-4 h-4 text-[#8C6ADE]" />}
              >
                LOAD BENCHMARK SAMPLE (5 ACCOUNTS)
              </BrutalistButton>
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 2: MAP COLUMNS
           ========================================================================= */}
        {wizardStep === 2 && (
          <div className="space-y-6">
            <BrutalistCard bg="white" shadowSize="lg" className="p-7 sm:p-9 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-[2px] border-[#0A0A0A]/15 pb-4">
                <div>
                  <h3 className="text-xl font-black text-[#0A0A0A]">
                    Column Mapping & Auto-Detection
                  </h3>
                  <p className="text-xs text-[#0A0A0A]/70 font-medium">
                    File: <strong className="text-[#0A0A0A]">{fileName}</strong> ({rawRows.length} rows parsed · {rawHeaders.length} columns)
                  </p>
                </div>
                <StickerBadge color="lime" rotate="-2">AUTO-MAPPED WITH ZOD VALIDATION</StickerBadge>
              </div>

              {fileError && (
                <div className="bg-[#FFB6C2] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A] text-xs font-bold">
                  {fileError}
                </div>
              )}

              {parseWarnings.length > 0 && (
                <div className="bg-[#FFE3B3] border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[2px_2px_0px_#0A0A0A] text-xs">
                  <span className="font-mono font-black uppercase block mb-2">Parser warnings — review before continuing</span>
                  <ul className="list-disc pl-5 space-y-1 font-medium">
                    {parseWarnings.slice(0, 10).map((warning, index) => <li key={index}>{warning}</li>)}
                  </ul>
                </div>
              )}

              {/* PII Alert Banner if personal data columns detected */}
              {piiColumnsDetected.length > 0 && (
                <div className="bg-[#FFE3B3] border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[2px_2px_0px_#0A0A0A] flex items-start gap-3 text-xs">
                  <ShieldAlert className="w-5 h-5 text-amber-900 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black text-[#0A0A0A] block">
                      Privacy Guard: {piiColumnsDetected.length} personal data column(s) detected ({piiColumnsDetected.join(', ')}).
                    </span>
                    <span className="text-[#0A0A0A]/80 font-medium mt-0.5 block">
                      Under our data hygiene protocol, personal contact information is automatically redacted from AI model payloads.
                    </span>
                  </div>
                </div>
              )}

              {/* Requirement Rule Notice */}
              <div className="bg-[#E4E6FB] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A] flex items-center gap-2.5 text-xs">
                <Info className="w-4 h-4 text-[#8C6ADE] shrink-0" />
                <span className="font-bold text-[#0A0A0A]">
                  <strong>Identification Rule:</strong> Each lead must have either a <em>Company Name</em> OR a <em>Website/Domain</em>. A domain is strongly recommended for full AI enrichment.
                </span>
              </div>

              {/* SECTION A: PRIMARY IDENTIFIERS */}
              <div className="space-y-3">
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] block tracking-wider bg-[#F9F8F4] px-3 py-1.5 border-[2px] border-[#0A0A0A] rounded-lg w-fit shadow-[1.5px_1.5px_0px_#0A0A0A]">
                  01 // PRIMARY COMPANY IDENTIFIERS (REQUIRED)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs font-mono">
                  {/* Company Name */}
                  <div className="space-y-1.5 bg-[#F9F8F4] p-3.5 rounded-xl border-[2px] border-[#0A0A0A]">
                    <div className="flex justify-between items-center">
                      <label className="font-black uppercase text-[#0A0A0A]">
                        COMPANY NAME *
                      </label>
                      <span className="text-[10px] text-[#0A0A0A]/60 font-bold">Primary label</span>
                    </div>
                    <select
                      value={mapping.companyName || ''}
                      onChange={(e) => handleUpdateMapping('companyName', e.target.value)}
                      className="w-full bg-white border-[2px] border-[#0A0A0A] rounded-xl px-3 py-2 text-xs font-bold shadow-[2px_2px_0px_#0A0A0A]"
                    >
                      <option value="">[None / Leave Blank]</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-[#0A0A0A]/60 block truncate">
                      {getSampleValues(mapping.companyName)}
                    </span>
                  </div>

                  {/* Domain / Website */}
                  <div className="space-y-1.5 bg-[#F9F8F4] p-3.5 rounded-xl border-[2px] border-[#0A0A0A]">
                    <div className="flex justify-between items-center">
                      <label className="font-black uppercase text-[#0A0A0A]">
                        DOMAIN / WEBSITE *
                      </label>
                      <span className="text-[10px] text-emerald-800 font-bold">Recommended</span>
                    </div>
                    <select
                      value={mapping.domain || ''}
                      onChange={(e) => handleUpdateMapping('domain', e.target.value)}
                      className="w-full bg-white border-[2px] border-[#0A0A0A] rounded-xl px-3 py-2 text-xs font-bold shadow-[2px_2px_0px_#0A0A0A]"
                    >
                      <option value="">[None / Leave Blank]</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-[#0A0A0A]/60 block truncate">
                      {getSampleValues(mapping.domain)}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION B: FIRMOGRAPHICS */}
              <div className="space-y-3 pt-2">
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] block tracking-wider bg-[#F9F8F4] px-3 py-1.5 border-[2px] border-[#0A0A0A] rounded-lg w-fit shadow-[1.5px_1.5px_0px_#0A0A0A]">
                  02 // FIRMOGRAPHIC ATTRIBUTES (OPTIONAL)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
                  {/* Industry */}
                  <div className="space-y-1.5 bg-[#F9F8F4] p-3 rounded-xl border-[2px] border-[#0A0A0A]">
                    <label className="font-black uppercase text-[#0A0A0A] block">INDUSTRY VERTICAL</label>
                    <select
                      value={mapping.industry || ''}
                      onChange={(e) => handleUpdateMapping('industry', e.target.value)}
                      className="w-full bg-white border-[2px] border-[#0A0A0A] rounded-xl px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="">[Ignore Column]</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-[#0A0A0A]/60 block truncate">{getSampleValues(mapping.industry)}</span>
                  </div>

                  {/* Headcount */}
                  <div className="space-y-1.5 bg-[#F9F8F4] p-3 rounded-xl border-[2px] border-[#0A0A0A]">
                    <label className="font-black uppercase text-[#0A0A0A] block">HEADCOUNT / EMPLOYEES</label>
                    <select
                      value={mapping.headcount || ''}
                      onChange={(e) => handleUpdateMapping('headcount', e.target.value)}
                      className="w-full bg-white border-[2px] border-[#0A0A0A] rounded-xl px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="">[Ignore Column]</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-[#0A0A0A]/60 block truncate">{getSampleValues(mapping.headcount)}</span>
                  </div>

                  {/* Annual Revenue */}
                  <div className="space-y-1.5 bg-[#F9F8F4] p-3 rounded-xl border-[2px] border-[#0A0A0A]">
                    <label className="font-black uppercase text-[#0A0A0A] block">ANNUAL REVENUE</label>
                    <select
                      value={mapping.annualRevenue || ''}
                      onChange={(e) => handleUpdateMapping('annualRevenue', e.target.value)}
                      className="w-full bg-white border-[2px] border-[#0A0A0A] rounded-xl px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="">[Ignore Column]</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-[#0A0A0A]/60 block truncate">{getSampleValues(mapping.annualRevenue)}</span>
                  </div>

                  {/* Tech Stack */}
                  <div className="space-y-1.5 bg-[#F9F8F4] p-3 rounded-xl border-[2px] border-[#0A0A0A]">
                    <label className="font-black uppercase text-[#0A0A0A] block">TECHNOLOGIES / STACK</label>
                    <select
                      value={mapping.technologies || ''}
                      onChange={(e) => handleUpdateMapping('technologies', e.target.value)}
                      className="w-full bg-white border-[2px] border-[#0A0A0A] rounded-xl px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="">[Ignore Column]</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-[#0A0A0A]/60 block truncate">{getSampleValues(mapping.technologies)}</span>
                  </div>

                  {/* Geography */}
                  <div className="space-y-1.5 bg-[#F9F8F4] p-3 rounded-xl border-[2px] border-[#0A0A0A]">
                    <label className="font-black uppercase text-[#0A0A0A] block">GEOGRAPHY / COUNTRY</label>
                    <select
                      value={mapping.country || ''}
                      onChange={(e) => handleUpdateMapping('country', e.target.value)}
                      className="w-full bg-white border-[2px] border-[#0A0A0A] rounded-xl px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="">[Ignore Column]</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-[#0A0A0A]/60 block truncate">{getSampleValues(mapping.country)}</span>
                  </div>

                  {/* Business Model */}
                  <div className="space-y-1.5 bg-[#F9F8F4] p-3 rounded-xl border-[2px] border-[#0A0A0A]">
                    <label className="font-black uppercase text-[#0A0A0A] block">BUSINESS MODEL</label>
                    <select
                      value={mapping.businessModel || ''}
                      onChange={(e) => handleUpdateMapping('businessModel', e.target.value)}
                      className="w-full bg-white border-[2px] border-[#0A0A0A] rounded-xl px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="">[Ignore Column]</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-[#0A0A0A]/60 block truncate">{getSampleValues(mapping.businessModel)}</span>
                  </div>
                </div>
              </div>

              {/* SECTION C: CRM & COMMERCIALS */}
              <div className="space-y-3 pt-2">
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] block tracking-wider bg-[#F9F8F4] px-3 py-1.5 border-[2px] border-[#0A0A0A] rounded-lg w-fit shadow-[1.5px_1.5px_0px_#0A0A0A]">
                  03 // COMMERCIAL & PIPELINE CONTEXT (OPTIONAL)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
                  {/* Lead Stage */}
                  <div className="space-y-1.5 bg-[#F9F8F4] p-3 rounded-xl border-[2px] border-[#0A0A0A]">
                    <label className="font-black uppercase text-[#0A0A0A] block">LEAD STAGE / STATUS</label>
                    <select
                      value={mapping.leadStage || ''}
                      onChange={(e) => handleUpdateMapping('leadStage', e.target.value)}
                      className="w-full bg-white border-[2px] border-[#0A0A0A] rounded-xl px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="">[Ignore Column]</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Deal Value */}
                  <div className="space-y-1.5 bg-[#F9F8F4] p-3 rounded-xl border-[2px] border-[#0A0A0A]">
                    <label className="font-black uppercase text-[#0A0A0A] block">DEAL VALUE / ACV</label>
                    <select
                      value={mapping.dealValue || ''}
                      onChange={(e) => handleUpdateMapping('dealValue', e.target.value)}
                      className="w-full bg-white border-[2px] border-[#0A0A0A] rounded-xl px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="">[Ignore Column]</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Customer Pain */}
                  <div className="space-y-1.5 bg-[#F9F8F4] p-3 rounded-xl border-[2px] border-[#0A0A0A]">
                    <label className="font-black uppercase text-[#0A0A0A] block">CUSTOMER PAIN / CHALLENGE</label>
                    <select
                      value={mapping.customerPain || ''}
                      onChange={(e) => handleUpdateMapping('customerPain', e.target.value)}
                      className="w-full bg-white border-[2px] border-[#0A0A0A] rounded-xl px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="">[Ignore Column]</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {additionalMappingFields.map((field) => (
                    <div key={field.key} className="space-y-1.5 bg-[#F9F8F4] p-3 rounded-xl border-[2px] border-[#0A0A0A]">
                      <label className="font-black uppercase text-[#0A0A0A] block">{field.label}</label>
                      <select
                        value={mapping[field.key] || ''}
                        onChange={(event) => handleUpdateMapping(field.key, event.target.value)}
                        className="w-full bg-white border-[2px] border-[#0A0A0A] rounded-xl px-2.5 py-1.5 text-xs font-bold"
                      >
                        <option value="">[Ignore Column]</option>
                        {rawHeaders.map((header) => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-[#0A0A0A]/60 block truncate">{getSampleValues(mapping[field.key])}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation Actions */}
              <TableShell title="Parsed File Preview" countLabel={`FIRST ${Math.min(10, rawRows.length)} OF ${rawRows.length}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b-[2px] border-[#0A0A0A] bg-[#F9F8F4]">
                        {rawHeaders.slice(0, 6).map((header) => (
                          <th key={header} className="px-3 py-2 font-black uppercase whitespace-nowrap">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0A0A0A]/15">
                      {rawRows.slice(0, 10).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {rawHeaders.slice(0, 6).map((header) => (
                            <td key={header} className="px-3 py-2 max-w-48 truncate">{String(row[header] ?? '') || '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TableShell>

              <div className="flex justify-between items-center border-t-[2px] border-[#0A0A0A]/15 pt-5">
                <BrutalistButton variant="white" size="sm" onClick={() => setWizardStep(1)}>
                  ← BACK TO FILE
                </BrutalistButton>
                <BrutalistButton
                  variant="lime"
                  size="md"
                  onClick={() => {
                    if (!mapping.companyName && !mapping.domain) {
                      addToast('Please map at least Company Name or Website/Domain.', 'warning');
                      return;
                    }
                    setWizardStep(3);
                  }}
                >
                  REVIEW DATA HYGIENE →
                </BrutalistButton>
              </div>
            </BrutalistCard>
          </div>
        )}

        {/* =========================================================================
            STEP 3: REVIEW DATA HYGIENE & DUPLICATES
           ========================================================================= */}
        {wizardStep === 3 && pipelineResult && (
          <div className="space-y-6">
            {/* Top Hygiene Summary Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="bg-white border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A]">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/70 block">TOTAL UPLOADED ROWS</span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-[#0A0A0A]">{pipelineResult.summary.totalRowsParsed}</span>
                <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/60 block mt-1">Before validation</span>
              </div>
              <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A]">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/70 block">
                  VALID STORED LEADS
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-[#0A0A0A]">
                  {pipelineResult.validLeads.length}
                </span>
                <span className="font-mono text-[10px] font-bold text-emerald-800 block mt-1">
                  Ready for database
                </span>
              </div>

              <div className="bg-[#E4E6FB] border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A]">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/70 block">
                  LATER AI ALLOWANCE
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-[#0A0A0A]">
                  {pipelineResult.summary.aiEligibleCount}
                </span>
                <span className="font-mono text-[10px] font-bold text-[#8C6ADE] block mt-1">
                  {pipelineResult.summary.storedOnlyCount > 0
                    ? `+ ${pipelineResult.summary.storedOnlyCount} stored-only`
                    : '100% within AI limit'}
                </span>
              </div>

              <div className="bg-[#FFE3B3] border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A]">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/70 block">
                  POSSIBLE DUPLICATES
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-[#0A0A0A]">
                  {pipelineResult.summary.duplicateRowsCount}
                </span>
                <span className="font-mono text-[10px] font-bold text-amber-900 block mt-1">
                  Exact domains merged; all contacts kept
                </span>
              </div>

              <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A]">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/70 block">CONFLICTING COMPANY VALUES</span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-[#0A0A0A]">{pipelineResult.summary.conflictCount}</span>
                <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/60 block mt-1">Most frequent value selected for each field</span>
              </div>

              <div className="bg-[#E4E6FB] border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A]">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/70 block">MISSING OPTIONAL VALUES</span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-[#0A0A0A]">{pipelineResult.summary.missingOptionalValuesCount}</span>
                <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/60 block mt-1">
                  Across {pipelineResult.summary.recordsWithMissingOptionalValues} records
                </span>
              </div>

              <div className={`border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A] ${
                pipelineResult.invalidRows.length > 0 ? 'bg-[#FFB6C2]' : 'bg-white'
              }`}>
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/70 block">
                  INVALID / INCOMPLETE
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-[#0A0A0A]">
                  {pipelineResult.invalidRows.length}
                </span>
                <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/70 block mt-1">
                  {pipelineResult.invalidRows.length > 0 ? 'Missing name & domain' : 'Zero parsing errors'}
                </span>
              </div>
            </div>

            {/* Deduplication & Tab Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[3px_3px_0px_#0A0A0A]">
              {/* Tab Selector */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveReviewTab('valid')}
                  className={`font-mono text-xs font-black px-3 py-1.5 rounded-lg border-[1.5px] border-[#0A0A0A] cursor-pointer transition-colors ${
                    activeReviewTab === 'valid' ? 'bg-[#A1F000]' : 'bg-[#F9F8F4] hover:bg-slate-100'
                  }`}
                >
                  VALID LEADS ({pipelineResult.validLeads.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReviewTab('duplicates')}
                  className={`font-mono text-xs font-black px-3 py-1.5 rounded-lg border-[1.5px] border-[#0A0A0A] cursor-pointer transition-colors ${
                    activeReviewTab === 'duplicates' ? 'bg-[#FFE3B3]' : 'bg-[#F9F8F4] hover:bg-slate-100'
                  }`}
                >
                  DUPLICATES ({pipelineResult.summary.duplicateRowsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReviewTab('invalid')}
                  className={`font-mono text-xs font-black px-3 py-1.5 rounded-lg border-[1.5px] border-[#0A0A0A] cursor-pointer transition-colors ${
                    activeReviewTab === 'invalid' ? 'bg-[#FFB6C2]' : 'bg-[#F9F8F4] hover:bg-slate-100'
                  }`}
                >
                  INVALID ({pipelineResult.invalidRows.length})
                </button>
                {piiColumnsDetected.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveReviewTab('privacy')}
                    className={`font-mono text-xs font-black px-3 py-1.5 rounded-lg border-[1.5px] border-[#0A0A0A] cursor-pointer transition-colors ${
                      activeReviewTab === 'privacy' ? 'bg-[#E4E6FB]' : 'bg-[#F9F8F4] hover:bg-slate-100'
                    }`}
                  >
                    PRIVACY REDACTIONS ({piiColumnsDetected.length})
                  </button>
                )}
              </div>

              <span className="font-mono text-xs font-bold">Same-domain rows become one company with all contacts retained.</span>
            </div>

            {/* TAB CONTENT: VALID LEADS */}
            {activeReviewTab === 'valid' && (
              <TableShell
                title={`Normalized Leads (${pipelineResult.validLeads.length} Total Records)`}
                countLabel={`${pipelineResult.summary.aiEligibleCount} AI-ELIGIBLE`}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b-[2.5px] border-[#0A0A0A] bg-[#F9F8F4] text-[#0A0A0A]">
                        <th className="py-3 px-4 font-black uppercase">COMPANY</th>
                        <th className="py-3 px-4 font-black uppercase">NORMALIZED DOMAIN</th>
                        <th className="py-3 px-4 font-black uppercase">VERTICAL</th>
                        <th className="py-3 px-4 font-black uppercase text-right">HEADCOUNT</th>
                        <th className="py-3 px-4 font-black uppercase">ENRICHMENT TIER</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-[1.5px] divide-[#0A0A0A]/15 font-sans font-medium">
                      {pipelineResult.validLeads.slice(0, 15).map((lead, idx) => (
                        <tr key={lead.id || idx} className="hover:bg-[#FFE3B3]/20">
                          <td className="py-3 px-4">
                            <span className="font-extrabold text-[#0A0A0A] block">{lead.companyName}</span>
                            {lead.country && <span className="font-mono text-[10px] text-[#0A0A0A]/60">{lead.country}</span>}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px]">
                            {lead.domain ? (
                              <span className="text-[#0A0A0A] font-bold">{lead.domain}</span>
                            ) : (
                              <span className="text-amber-800 italic">[No domain - limited]</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#0A0A0A]/85">{lead.industry}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {formatHeadcount(lead.headcount)}
                          </td>
                          <td className="py-3 px-4">
                            <StatusChip
                              color={
                                lead.enrichmentTier === 'full'
                                  ? 'mint'
                                  : lead.enrichmentTier === 'limited'
                                  ? 'peach'
                                  : 'lavender'
                              }
                            >
                              {lead.enrichmentTier === 'full'
                                ? 'Full AI'
                                : lead.enrichmentTier === 'limited'
                                ? 'Limited AI'
                                : 'Stored Only'}
                            </StatusChip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pipelineResult.validLeads.length > 15 && (
                  <div className="p-3 bg-[#F9F8F4] text-center font-mono text-xs font-bold text-[#0A0A0A]/70 border-t-[1.5px] border-[#0A0A0A]/20">
                    Showing first 15 of {pipelineResult.validLeads.length} valid rows. All {pipelineResult.validLeads.length} rows will be persisted.
                  </div>
                )}
              </TableShell>
            )}

            {/* TAB CONTENT: DUPLICATES */}
            {activeReviewTab === 'duplicates' && (
              <div className="space-y-4">
                {pipelineResult.duplicateGroups.length === 0 ? (
                  <BrutalistCard bg="white" className="p-8 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
                    <h4 className="font-black text-[#0A0A0A]">No duplicate collisions found</h4>
                    <p className="text-xs text-[#0A0A0A]/70 font-medium">All accounts in this batch have distinct domains and identifiers.</p>
                  </BrutalistCard>
                ) : (
                  pipelineResult.duplicateGroups.map((group) => (
                    <div
                      key={group.key}
                      className="bg-white border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A] space-y-3"
                    >
                      <div className="flex items-center justify-between border-b-[1.5px] border-[#0A0A0A]/15 pb-2">
                        <div className="flex items-center gap-2">
                          <StickerBadge color="peach" rotate="-2">
                            {group.type === 'exact_domain' ? 'EXACT DOMAIN COLLISION' : 'NAME COLLISION'}
                          </StickerBadge>
                          <span className="font-mono text-xs font-black text-[#0A0A0A]">
                            {group.normalizedDomain || group.companyName}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-[#0A0A0A]/70">
                          {group.leads.length} records matching
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                        {group.leads.map((l, i) => (
                          <div key={i} className="p-2.5 bg-[#F9F8F4] rounded-lg border-[1px] border-[#0A0A0A]/20">
                            <span className="font-black text-[#0A0A0A] block">{l.companyName}</span>
                            <span className="text-[11px] text-[#0A0A0A]/70 block">{l.domain || 'No domain'} · {l.industry}</span>
                            <span className="text-[10px] text-amber-800 font-bold block mt-1">
                              {i === 0 ? 'Primary account' : 'Merged contact'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT: INVALID ROWS */}
            {activeReviewTab === 'invalid' && (
              <div className="space-y-4">
                {pipelineResult.invalidRows.length === 0 ? (
                  <BrutalistCard bg="white" className="p-8 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
                    <h4 className="font-black text-[#0A0A0A]">All rows passed Zod schema validation</h4>
                    <p className="text-xs text-[#0A0A0A]/70 font-medium">Every row contains at least one reliable company identifier.</p>
                  </BrutalistCard>
                ) : (
                  <div className="space-y-3">
                    {pipelineResult.invalidRows.map((inv, idx) => (
                      <div
                        key={idx}
                        className="bg-[#FFB6C2]/30 border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[2px_2px_0px_#0A0A0A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-mono font-black text-[#0A0A0A] block">
                            Row #{inv.rowNumber} — Disqualified from Ingestion
                          </span>
                          <span className="font-medium text-[#0A0A0A]/80 mt-0.5 block">
                            {inv.reason}
                          </span>
                        </div>
                        <StatusChip color="pink">DROPPED</StatusChip>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: PRIVACY REDACTIONS */}
            {activeReviewTab === 'privacy' && (
              <BrutalistCard bg="white" className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-800" />
                  <h4 className="font-black text-[#0A0A0A]">Redacted Personal Contact Attributes</h4>
                </div>
                <p className="text-xs text-[#0A0A0A]/70 font-medium">
                  The following columns were detected in your input file and flagged as personal or private contact details. Values from these columns are excluded from outbound model requests:
                </p>
                <div className="flex flex-wrap gap-2">
                  {piiColumnsDetected.map((col) => (
                    <span
                      key={col}
                      className="font-mono text-xs font-black bg-[#FFE3B3] border-[2px] border-[#0A0A0A] px-3 py-1.5 rounded-lg shadow-[1.5px_1.5px_0px_#0A0A0A]"
                    >
                      {col} [SCRUBBED]
                    </span>
                  ))}
                </div>
              </BrutalistCard>
            )}

            {/* Navigation Actions */}
            <div className="flex justify-between items-center pt-2">
              <BrutalistButton variant="white" size="sm" onClick={() => setWizardStep(2)}>
                ← BACK TO MAPPING
              </BrutalistButton>
              <BrutalistButton
                variant="lime"
                size="md"
                onClick={() => {
                  setWizardStep(4);
                  if (!isDemoUser) void executeProcessing();
                }}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                {isDemoUser ? 'PREVIEW' : 'CONFIRM & INGEST'} {pipelineResult.validLeads.length} LEADS →
              </BrutalistButton>
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 4: EXECUTE INGESTION & JOB STATUS
           ========================================================================= */}
        {wizardStep === 4 && (
          <BrutalistCard bg="white" shadowSize="lg" className="p-8 sm:p-10 text-center space-y-6">
            <div className="max-w-lg mx-auto space-y-3">
              <SectionEyebrow color="bg-[#A1F000]">
                {isDemoUser ? 'DEMO PREVIEW' : isProcessing ? 'SECURE DATASET INGESTION' : processingError ? 'UPLOAD NEEDS ATTENTION' : createdDatasetId ? 'DATASET SAVED' : 'READY TO SAVE'}
              </SectionEyebrow>

              <h3 className="text-2xl sm:text-3xl font-black text-[#0A0A0A]">
                {isDemoUser ? 'Demo only: sign in to save and analyze your file' : isProcessing ? processingStage : processingError ? 'Your file was not saved' : createdDatasetId ? 'Dataset Saved & Queued' : 'Ready to save your dataset'}
              </h3>

              <p className="text-xs text-[#0A0A0A]/70 font-medium">
                {isDemoUser
                  ? `Your ${pipelineResult?.validLeads.length || 0} valid leads in "${fileName}" are only previewed in this browser.`
                  : isProcessing
                  ? 'Checking your file and saving valid accounts to your workspace.'
                  : processingError ? 'Retry the upload after resolving the issue.'
                  : createdDatasetId ? `All ${pipelineResult?.validLeads.length || 0} valid leads in "${fileName}" have been stored. No AI classification has run yet.` : 'Confirm the upload to save your valid leads.'}
              </p>
            </div>

            {processingError && (
              <div className="max-w-lg mx-auto bg-[#FFB6C2] border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A] text-left text-xs font-bold">
                {processingError}
              </div>
            )}

            {/* Animated Accessible Progress Bar */}
            {!isDemoUser && <div className="max-w-md mx-auto">
              <div className="flex justify-between font-mono text-xs font-bold mb-1.5">
                <span>STAGE PROGRESS</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-4 w-full bg-[#F9F8F4] border-[2.5px] border-[#0A0A0A] rounded-xl overflow-hidden p-0.5 shadow-[2px_2px_0px_#0A0A0A]">
                <div
                  className="h-full bg-[#A1F000] rounded-lg transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>}

            {/* Processing Skeleton or Completed Actions */}
            {isDemoUser ? (
              <BrutalistButton variant="lime" size="md" onClick={() => void continueToSignIn()} icon={<ArrowRight className="w-4 h-4" />}>SIGN IN TO SAVE & ANALYZE</BrutalistButton>
            ) : processingError ? (
              <BrutalistButton variant="lime" size="md" onClick={() => void executeProcessing()}>RETRY UPLOAD</BrutalistButton>
            ) : isProcessing || !createdDatasetId ? (
              <div className="max-w-md mx-auto pt-4">
                <LoadingSkeleton lines={3} />
              </div>
            ) : (
              <div className="space-y-6 pt-4">
                {/* Completion Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto font-mono text-xs text-left">
                  <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A]">
                    <span className="font-black text-[#0A0A0A]/60 block text-[10px] uppercase">TOTAL STORED</span>
                    <span className="text-2xl font-black text-[#0A0A0A]">{pipelineResult?.validLeads.length || 0}</span>
                  </div>
                  <div className="bg-[#E4E6FB] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A]">
                    <span className="font-black text-[#0A0A0A]/60 block text-[10px] uppercase">AI-ELIGIBLE LATER</span>
                    <span className="text-2xl font-black text-[#0A0A0A]">{pipelineResult?.summary.aiEligibleCount || 0}</span>
                  </div>
                  <div className="bg-[#FFE3B3] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A]">
                    <span className="font-black text-[#0A0A0A]/60 block text-[10px] uppercase">DEDUPLICATED</span>
                    <span className="text-2xl font-black text-[#0A0A0A]">{pipelineResult?.summary.duplicateRowsCount || 0}</span>
                  </div>
                </div>

                {/* Final Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                  <BrutalistButton
                    variant="white"
                    size="md"
                    onClick={() => navigate('/companies')}
                  >
                    EXPLORE COMPANIES TABLE
                  </BrutalistButton>

                  <BrutalistButton
                    variant="lime"
                    size="md"
                    onClick={() => navigate(`/uploads/${createdDatasetId || 'dataset-01'}`)}
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    VIEW DATASET DETAILS →
                  </BrutalistButton>
                </div>
              </div>
            )}
          </BrutalistCard>
        )}
      </div>
    </AppLayout>
  );
};
