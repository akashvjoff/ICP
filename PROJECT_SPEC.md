# PROJECT SPECIFICATION: ICP.MODE
**Stage: MVP 1**  
**Classification: B2B Strategic GTM & ICP Discovery Platform**

---

## 1. Executive Summary & Thesis
`icp.mode` is a specialized intelligence platform engineered for B2B founders, growth leaders, GTM consultants, and agencies who possess raw company lead lists but struggle to discover, validate, and prioritize their true **Ideal Customer Profile (ICP)**.

Unlike superficial firmographic enrichment tools that merely group accounts by employee size or high-level industry labels, `icp.mode` applies rigorous classical strategic marketing frameworks (**Need Gap Analysis**, **5C / Stakeholder Analysis**, **STP - Segmentation, Targeting, Positioning**, and **Marketing Mix**) combined with a **deterministic scoring engine** to generate mathematically explainable ICP fits.

### Core Tenet: Hypothesis vs. Validated ICP
A raw lead list without closed-won / closed-lost historical conversion outcomes can **only** yield an **ICP Hypothesis**. `icp.mode` strictly enforces this distinction in all reporting and analytics: accounts are evaluated against theoretical strategic alignment until actual deal velocity, win rates, and retention data validate the cohort.

---

## 2. Target Personas
1. **B2B Founders & Early Stage CEOs**: Validating product-market fit, needing to understand which market segments truly experience the acute pain their product solves before burning outbound capital.
2. **Growth Marketers & Head of Demand Gen**: Building tight outbound segmentations with tailored messaging hooks based on verified customer decision triggers rather than generic industry verticals.
3. **GTM Consultants & Advisory Agencies**: Delivering institutional-grade ICP discovery reports and lead scoring dossiers for enterprise clients.
4. **Sales Leaders & RevOps**: Eliminating pipeline bloat by triaging thousands of uploaded accounts into High-Fit, Secondary-Fit, and Disqualified tiers with clear explanatory rationales.

---

## 3. End-to-End Product Flow
```
[1. Landing & Positioning]
         ↓
[2. Supabase Auth / Session]
         ↓
[3. Own Company & Offering Profile]
    • Value Proposition & Problem Statement
    • Core Capabilities & Price Tier
    • Buyer Personas & Jobs-to-be-Done (JTBD)
    • Initial ICP Hypothesis
         ↓
[4. Lead List Ingestion & Structuring]
    • Upload CSV / XLSX (drag & drop or paste)
    • Auto-detect and manual column mapping (Name, Domain, Industry, Desc, Rev, Headcount)
    • Data hygiene, deduping, and field standardization
         ↓
[5. AI Strategic Classification (Gemini Server-Side)]
    • Business Model (B2B SaaS, Marketplace, Services, Hardware, Hybrid)
    • Primary Products & Target Customers
    • Latent & Expressed Need Gap Identification
         ↓
[6. Strategic Marketing Pipeline]
    • Step A: Need Gap Analysis (Gap magnitude, urgency, capability coverage)
    • Step B: 5C / Stakeholder Analysis (Company, Customers, Competitors, Collaborators, Context)
    • Step C: STP (Need-based clusters, target prioritization, positioning angles)
    • Step D: Marketing Mix (4Ps resonance check)
         ↓
[7. Deterministic Scoring Engine]
    • Mathematical evaluation (0–100 score) based on transparent weighted rubrics:
      - Need Urgency (35%)
      - Solution-Capability Match (25%)
      - Economic & Stakeholder Feasibility (20%)
      - Firmographic & Timing Fit (20%)
    • Tier assignment: Tier 1 (High Conviction Hypothesis), Tier 2 (Moderate), Tier 3 (Niche/Edge), Tier 4 (Disqualified)
         ↓
[8. Explainable ICP Report & Lead Dossier]
    • Executive strategic report
    • Interactive sortable & filterable lead table
    • Deep-dive Account Dossier drawer with full explanatory breakdown
    • Exportable to CSV / JSON / PDF summary
```

---

## 4. Marketing Framework Rules & Integrity
1. **Rigorous Sequence**: The analysis strictly follows `Need Gap Analysis` → `5C Analysis` → `STP` → `Marketing Mix`.
2. **Need-First Segmentation**: Accounts are clustered primarily by business problem urgency and buying motivation rather than surface industry taxonomies alone.
3. **No Hallucinated Facts**: Firmographic facts must derive from uploaded lead inputs or documented classification; hypotheses must be clearly tagged as inferred.
4. **Transparent Scoring**: Every score is accompanied by an itemized mathematical audit trace explaining why points were awarded or subtracted.

---

## 5. Technology Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion, Lucide React
- **Backend / Runtime**: Node.js with Express, tsx runtime, Vite middlewares
- **Database & Auth**: Supabase PostgreSQL + Supabase Auth (with zero-credential demo sandbox fallback)
- **AI Core**: Google Gemini API (`@google/genai` via server-side Express proxy with `User-Agent: aistudio-build`)
- **Parsing**: PapaParse for CSV ingestion and client/server data hygiene
- **Hosting & Deployability**: Node.js container / Cloud Run / AI Studio preview compatible
