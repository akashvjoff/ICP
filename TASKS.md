# TASKS & MILESTONE TRACKER: ICP.MODE
**Stage: MVP 1 Roadmap**  
**Status: Visual Design System Implemented / Foundation Active**

---

## Milestone 1: Architecture, Design Foundation & Working Preview [COMPLETED]
- [x] Analyze design reference (Vowmode neo-brutalist aesthetic & editorial precision)
- [x] Establish design tokens, typography (`Inter` + `Space Mono` / `JetBrains Mono`), and color hierarchy (`#F9F8F4`, thick `#0A0A0A` borders, hard offset black shadows, electric lime `#A1F000`, purple `#8C6ADE`, pastel peach, lavender, mint, pink)
- [x] Implement subtle CSS checkerboard texture on canvas using repeating gradients
- [x] Draft foundational documents (`PROJECT_SPEC.md`, `DESIGN_SYSTEM.md`, `ARCHITECTURE.md`, `TASKS.md`, `AGENTS.md`, `DECISIONS.md`)
- [x] Configure server-side runtime (`server.ts`) with Express + Vite middlewares and secure `/api/*` routes
- [x] Build AppNavbar conforming to Vowmode contract (Lime indicator, center wordmark, lime dashboard button)
- [x] Create complete reusable neo-brutalist component catalog:
  - [x] `AppNavbar`
  - [x] `SectionEyebrow` (blue square marker + tracked uppercase mono label)
  - [x] `BrutalistButton` (hard offset shadow, press translation)
  - [x] `BrutalistCard` (3px border, hard shadow, pastel variants)
  - [x] `PastelStepCard` (numbered 01-04 pastel step cards)
  - [x] `StickerBadge` (tilted floating badges)
  - [x] `IconMedallion` (circular icon tokens)
  - [x] `MetricCard` (massive tabular numbers)
  - [x] `SectionHeading` (oversized black titles)
  - [x] `FormField` & `BrutalistInput` / `BrutalistTextarea`
  - [x] `ProgressStepper` (pastel step tiles)
  - [x] `StatusChip` (6px rounded chip)
  - [x] `TableShell` (editorial table container)
  - [x] `EmptyState`
  - [x] `Modal`
  - [x] `Toast`
  - [x] `LoadingSkeleton`
- [x] Apply visual design system across all screens:
  - [x] Landing Hero (Massive titles, electric-lime CTA, pastel card strip)
  - [x] Marketing Sequence (01-04 Pastel step cards, Hypothesis vs Validated governance panel)
  - [x] Interactive Teaser (Account comparison, mathematical ledger, audit chips)
  - [x] Offering Wizard (Step 1)
  - [x] Lead Ingestion & Table (Step 2)
  - [x] Strategic Analysis Pipeline (Step 3: Need Gap, 5C, STP, Marketing Mix)
  - [x] Deterministic Scoring Matrix (Step 4: Calibration sliders, live preview)
  - [x] ICP Report Dossier (Step 5: Metric tiles, search/filter, table, CSV export)
  - [x] Deep-Dive Lead Drawer (Flyout ledger and audit traces)
- [x] Verify applet compilation and clean rendering

---

## Milestone 2: Own Company & Offering Profile (Step 1)
- [ ] Multi-field intake for company value proposition, problem statements, and key capabilities
- [ ] Buyer persona builder (Job titles, key motivations, pain points, budget authority)
- [ ] Explicit ICP Hypothesis form (Distinguishing initial theoretical assumptions from outcome-validated profiles)
- [ ] Offering draft persistence (Supabase / local fallback)

---

## Milestone 3: Lead Ingestion, Cleaning & Column Mapping (Step 2)
- [x] CSV/XLSX upload with click selection and drag-and-drop (5 MB trust-boundary validation)
- [x] Intelligent column auto-detection for company, website, firmographic, and commercial fields
- [x] Interactive column mapper with duplicate-mapping prevention and optional unmapped fields
- [x] Data hygiene engine: exact-domain deduplication, whitespace trimming, URL normalization, and numeric validation
- [x] Pre-flight review: total, valid, invalid, possible duplicates, missing mapped values, skipped rows, and preview
- [x] Authenticated Supabase persistence for datasets and leads with a queued analysis job (AI execution intentionally excluded)
- [x] Additive upload schema migration, synthetic automated tests, and sample CSV

---

## Milestone 4: Gemini-Powered Strategic Marketing Pipeline (Step 3)
- [x] Secure server-side company intelligence provider with runtime Gemini model discovery, structured Zod validation, provenance, confidence, caching, and persisted errors
- [x] Mock provider for synthetic tests and optional Ollama local-development adapter
- [ ] Cohort-level strategic pipeline orchestration beyond individual company intelligence
- [ ] Step 3A: Need Gap Analysis Engine (Quantifies acute vs latent customer pain and capability coverage)
- [ ] Step 3B: 5C / Stakeholder Analysis (Company, Customers, Competitors, Collaborators, Context)
- [ ] Step 3C: STP Engine (Need-based segment clustering, target attractiveness, positioning differentiation)
- [ ] Step 3D: Marketing Mix (4Ps alignment check for Product, Price, Place, Promotion)

---

## Milestone 5: Deterministic ICP Fit Scoring Engine (Step 4)
- [ ] Arithmetic scoring formula with customizable weights:
  - Need Urgency Score (0–35)
  - Capability Alignment Score (0–25)
  - Stakeholder & Economic Feasibility (0–20)
  - Firmographic Fit & Momentum (0–20)
- [ ] Tier classification logic: Tier 1 (High Conviction), Tier 2 (Moderate), Tier 3 (Niche), Tier 4 (Disqualified)
- [ ] Transparent audit trail generator: explains exact reasons for positive points and deductions
- [ ] Hypothesis tag vs. Outcome-Validated flag system

---

## Milestone 6: Explainable ICP Report Dossier & Lead Export (Step 5)
- [ ] High-density sortable and filterable lead table with tabular scores
- [ ] Slide-out Company Dossier drawer displaying full strategic profile
- [ ] Executive ICP summary cards (Top performing segments, primary buying motivations, disqualified patterns)
- [ ] CSV, JSON, and printable summary report exports

---

## Milestone 7: Supabase PostgreSQL Persistence & Team Auth
- [ ] Supabase client configuration & session state management
- [ ] Database migrations: `offerings`, `leads`, `strategic_analyses`, `icp_scores` tables
- [ ] Row Level Security (RLS) policies for user workspace isolation
- [ ] Team invite and project switching capabilities
