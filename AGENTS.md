# AGENTS & PROMPT PROTOCOL: ICP.MODE
**Stage: MVP 1**  
**Role Definitions, Verification Invariants & Execution Contracts**

---

## 1. Multi-Specialist Agent Architecture
In `icp.mode`, AI processing is decomposed into focused specialized agents executing server-side via the `@google/genai` SDK (`gemini-3.8-flash` for high-throughput reasoning). Each agent has strict input/output schemas and guardrails.

```
┌────────────────────────────────────────────────────────┐
│               1. Offering Intake Agent                 │
│  Extracts Value Proposition, JTBD, and Buyer Personas  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│          2. Data Hygiene & Normalizer Agent            │
│  Cleans company descriptions, detects business model   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│         3. Strategic Marketing Pipeline Agent          │
│  Executes: Need Gap -> 5C Analysis -> STP -> 4Ps       │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│      4. Deterministic Scoring Auditor (Pure Math)      │
│  Calculates 0-100 fit score; audits positive & negative│
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│         5. Executive Report Synthesizer Agent          │
│  Generates strategic narrative & ICP Hypothesis report │
└────────────────────────────────────────────────────────┘
```

---

## 2. Agent Execution Specifications

### Agent 1: Offering Intake Specialist
- **Input**: Raw offering text, product URL, pricing notes, target customer ideas.
- **Responsibility**: Structures input into standardized offering vectors:
  - `primary_problem`: Acute customer pain solved.
  - `value_proposition`: Quantifiable business outcome.
  - `buyer_personas`: Target titles, buying motivations, budget hurdles.
  - `icp_hypothesis`: Initial assumption of ideal customer traits.
- **Guardrail**: Never assumes target segment without user confirmation.

### Agent 2: Lead Classification & Firmographic Normalizer
- **Input**: Lead record (company name, domain, industry, description, headcount, revenue).
- **Responsibility**:
  - Classifies `business_model` (B2B SaaS, Professional Services, Enterprise Software, etc.).
  - Extracts `target_customers` and `primary_products`.
  - Infers plausible `latent_needs` and `operational_bottlenecks`.
- **Guardrail**: BANNED from inventing funding amounts, revenue figures, or employee headcounts if missing. Missing data must be marked as `unknown`.

### Agent 3: Strategic Marketing Analyst
- **Sequence Contract**: Strictly operates in the 4-phase sequence:
  1. **Phase 1: Need Gap Analysis**: Maps the target account's business friction against the offering's capability. Computes gap magnitude (Acute, Moderate, Low, None) and urgency triggers.
  2. **Phase 2: 5C / Stakeholder Analysis**: Analyzes Company capabilities, Customer buying unit (economic buyer, champions, blockers), Competitor positioning, Collaborators/channels, and Context (regulatory, macro environment).
  3. **Phase 3: STP (Segmentation, Targeting, Positioning)**: Clusters accounts based on shared business problems; assigns targeting priority; crafts differentiated positioning angles.
  4. **Phase 4: Marketing Mix (4Ps)**: Tests resonance with Product fit, Pricing acceptability, Place (sales channel fit), and Promotion (messaging appeal).

### Agent 4: Deterministic Scoring Auditor (Arithmetic Engine)
- **Nature**: Deterministic algorithm (Non-AI).
- **Formula**:
  $$\text{Score} = (\text{Need Urgency} \times 0.35) + (\text{Capability Match} \times 0.25) + (\text{Stakeholder Feasibility} \times 0.20) + (\text{Firmographic Alignment} \times 0.20)$$
- **Audit Requirement**: Outputs a granular ledger of points awarded, deductions, and missing data penalties.

### Agent 5: Executive Report Synthesizer
- **Input**: Aggregated strategic analysis outputs and scored lead cohort.
- **Responsibility**: Produces an executive-level ICP Hypothesis Report highlighting high-conviction clusters, critical disqualifiers, and recommended go-to-market testing campaigns.
- **Guardrail**: Must explicitly label findings as an "ICP Hypothesis" until closed deal validation metrics are provided.
