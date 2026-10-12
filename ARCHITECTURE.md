# ARCHITECTURE: ICP.MODE
**Stage: MVP 1**  
**Full-Stack Architecture & Component Topology**

---

## 1. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENT (React 19)                       │
│                                                                        │
│  ┌───────────────────────┐  ┌────────────────────────────────────────┐ │
│  │   Marketing Website   │  │           Workspace Shell              │ │
│  │ • Hero Thesis         │  │ • Top Bar Contract (3 Zones)           │ │
│  │ • Strategic Flow (4P) │  │ • Step 1: Offering Profile             │ │
│  │ • Interactive Preview │  │ • Step 2: Leads Ingestion & Cleaning   │ │
│  │ • Sample Lead Loader  │  │ • Step 3: Need Gap & 5C & STP Pipeline │ │
│  └───────────────────────┘  │ • Step 4: Deterministic Fit Scoring    │ │
│                             │ • Step 5: Explainable ICP Dossier      │ │
│                             └────────────────────────────────────────┘ │
│                                                  ▲                     │
│                                                  │ Supabase Client /   │
│                                                  │ Local State Bridge  │
│                                                  ▼                     │
│                             ┌────────────────────────────────────────┐ │
│                             │     Client Domain Logic & Parsers      │ │
│                             │ • PapaParse CSV Ingestion & Normalizer │ │
│                             │ • Deterministic Scoring Engine (Local) │ │
│                             │ • Filter & Table State Managers        │ │
│                             └────────────────────────────────────────┘ │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP Fetch (/api/*)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        NODE.JS SERVER (Express)                        │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Express Router / Security Boundary                               │  │
│  │ • GET  /api/health                                               │  │
│  │ • POST /api/ai/classify-company                                  │  │
│  │ • POST /api/ai/strategic-analysis (Need Gap, 5C, STP, 4Ps)      │  │
│  │ • POST /api/leads/score                                          │  │
│  │ • GET  /api/supabase/status                                      │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Server AI Provider (@google/genai)                               │  │
│  │ • Uses process.env.GEMINI_API_KEY (Never sent to client)         │  │
│  │ • User-Agent: 'aistudio-build'                                   │  │
│  │ • Structured JSON Output via responseSchema                      │  │
│  │ • Zero-hallucination prompt guardrails                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE PERSISTENCE                           │
│  • PostgreSQL Tables: offerings, leads, classifications, analyses,     │
│    and deterministic_scores                                            │
│  • Supabase Auth for team sessions & project isolation                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory & File Taxonomy
To ensure modularity and strict separation of concerns, the codebase is organized as follows:

```
├── .env.example                     # Environment variable blueprint
├── server.ts                        # Full-stack Node/Express server & API proxy
├── src/
│   ├── main.tsx                     # React root mount
│   ├── index.css                    # Tailwind v4 theme & font declarations
│   ├── App.tsx                      # Root application shell & router
│   │
│   ├── types/                       # Domain data contracts
│   │   ├── offering.ts              # Own company offering, value prop, buyer personas
│   │   ├── lead.ts                  # Raw lead, normalized lead, company firmographics
│   │   ├── analysis.ts              # Need Gap, 5C Analysis, STP, Marketing Mix types
│   │   ├── scoring.ts               # Weights, rubric criteria, tier classifications
│   │   └── api.ts                   # Server-client request/response payloads
│   │
│   ├── lib/                         # Pure deterministic logic & helpers
│   │   ├── supabase.ts              # Supabase client singleton & auth session helpers
│   │   ├── parser.ts                # PapaParse CSV ingestion & field normalizer
│   │   ├── scoring.ts               # Deterministic scoring engine with audit traces
│   │   ├── mockData.ts              # Realistic B2B lead datasets for instant preview
│   │   └── formatters.ts            # Tabular numbers, currency, percentages
│   │
│   ├── components/
│   │   ├── ui/                      # Atoms & primitives (no pills, hairline borders)
│   │   │   ├── Header.tsx           # 3-Zone Top Bar conforming to contract
│   │   │   ├── Button.tsx           # Segmented/flat button variants
│   │   │   ├── Tabs.tsx             # Clean interactive tab navigation
│   │   │   ├── Table.tsx            # High-density data grid with tabular figures
│   │   │   ├── Drawer.tsx           # Lead detail inspection flyout
│   │   │   └── Modal.tsx            # Clean dialog surface
│   │   │
│   │   ├── marketing/               # Landing page & strategic education
│   │   │   ├── LandingHero.tsx      # Main thesis, headline containment
│   │   │   ├── MarketingSequence.tsx# Need Gap -> 5C -> STP -> 4Ps walk-through
│   │   │   └── InteractiveTeaser.tsx# Live micro-demo preview on landing
│   │   │
│   │   └── workspace/               # Core application screens
│   │       ├── OfferingWizard.tsx   # Step 1: Company & offering definition
│   │       ├── LeadIngestion.tsx    # Step 2: Upload CSV, mapper, cleaning
│   │       ├── StrategicPipeline.tsx# Step 3: Need Gap, 5C, STP, Mix analysis
│   │       ├── ScoringMatrix.tsx    # Step 4: Deterministic fit engine & weights
│   │       └── ICPReportDossier.tsx # Step 5: Executive report & lead table
│   │
│   └── server/                      # Server-side utilities (imported in server.ts)
│       └── gemini.ts                # GoogleGenAI client & prompt schemas
```

---

## 3. Data Flow & Security Boundaries
1. **Secrets Isolation**: `process.env.GEMINI_API_KEY` is loaded exclusively inside `server.ts` / `src/server/gemini.ts`. No Vite `VITE_GEMINI_*` variable exists.
2. **Deterministic vs. Generative Boundary**:
   - Generative AI is used strictly for **linguistic & contextual inference**: extracting latent business needs, classifying business models, evaluating competitive positioning angles.
   - Fit Scoring is strictly **deterministic**: computed mathematically via transparent arithmetic rubrics ($0 - 100$). The AI does not output arbitrary single numbers.
3. **Database Architecture**:
   - Primary database: **Supabase PostgreSQL**.
   - Tables:
     - `profiles`: user identities and workspaces
     - `offerings`: product capabilities, pricing tier, problem statement, hypothesis
     - `leads`: uploaded accounts with raw and normalized columns
     - `strategic_analyses`: Need Gap, 5C, STP outputs
     - `scores`: itemized points, tier classification, audit log
