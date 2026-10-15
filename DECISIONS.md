# ARCHITECTURE DECISION RECORDS (ADRs): FIGUREDIT
**Stage: MVP 1**

---

### ADR-001: Node.js Express Runtime with Vite Middlewares & Server-Side Gemini Proxy
- **Status**: Accepted
- **Context**: The app requires both rich interactive client state (React 19) and secure server-side AI inference. Client-side API key exposure is strictly prohibited by security rules.
- **Decision**: Use a single Node.js Express server (`server.ts`) running on port 3000 that mounts Vite middlewares in development. All Gemini calls run server-side via `/api/ai/*` routes.
- **Consequence**: Secure environment variable handling, zero client key leakage, and seamless AI Studio preview deployment.

---

### ADR-002: Supabase (PostgreSQL + Auth) as the Dedicated Database
- **Status**: Accepted
- **Context**: The user explicitly requested: "Do not initialize Firebase or another database unless explicitly requested. Use Supabase."
- **Decision**: Architect persistence using Supabase PostgreSQL and Supabase Auth. Build a client layer (`src/lib/supabase.ts`) that gracefully falls back to local in-memory/localStorage state when Supabase environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are not yet configured, allowing instant out-of-the-box user testing without blocking errors.
- **Consequence**: Complete relational schema design ready for production Supabase while maintaining zero-friction local developer experience.

---

### ADR-003: Separation of Generative AI Inference and Deterministic Fit Scoring
- **Status**: Accepted
- **Context**: Many AI applications suffer from "hallucinated scoreboards" where an LLM fabricates arbitrary single-number scores (e.g. "87/100") without reproducible mathematical justification.
- **Decision**: AI is used solely for **contextual classification and strategic mapping** (extracting business models, identifying latent need gaps, analyzing 5C stakeholder dynamics). The final **ICP Fit Score** is calculated strictly by a **deterministic arithmetic engine** using transparent, inspectable point weights.
- **Consequence**: 100% explainable, reproducible scoring where users can audit every single point added or deducted.

---

### ADR-004: Strict Marketing Sequence (Need Gap -> 5C -> STP -> Marketing Mix)
- **Status**: Accepted
- **Context**: Standard GTM tools jump immediately into superficial industry and headcount filters, missing the underlying business problem and customer motivation.
- **Decision**: Mandate the classical strategic sequence:
  1. *Need Gap Analysis*: Does the customer have an acute, solvable friction?
  2. *5C / Stakeholder Analysis*: Who are the decision makers and what macro/competitive context surrounds them?
  3. *STP (Segmentation, Targeting, Positioning)*: Segment by shared need, target the highest-gravity clusters, and craft tailored positioning.
  4. *Marketing Mix (4Ps)*: Verify offering resonance across Product, Price, Place, and Promotion.
- **Consequence**: Sound marketing strategic foundation that prioritizes customer motivation over superficial firmographics.

---

### ADR-005: Mandatory ICP Hypothesis vs. Validated ICP Distinction
- **Status**: Accepted
- **Context**: A raw lead list without historical closed-won or closed-lost conversion metrics cannot objectively prove ideal customer status. Claiming it does is intellectually dishonest.
- **Decision**: All reports generated from lead lists without CRM conversion data are explicitly labeled as **ICP Hypotheses**. The UI highlights validation checkpoints required to graduate a cohort to a **Validated ICP** (e.g., win rates > 25%, sales cycle < 45 days, NPS/retention metrics).
- **Consequence**: Builds immense user trust and aligns with enterprise GTM best practices.

---

### ADR-006: Vowmode Neo-Brutalist Light Editorial Visual System
- **Status**: Accepted
- **Context**: The user specified a bold editorial visual system for FiguredIt, with original ICP branding and components.
- **Decision**: Adopt the full Vowmode visual language:
  - Warm ivory canvas (`#F9F8F4`) with faint repeating gradient CSS checkerboard texture
  - 3px solid `#0A0A0A` borders with hard offset black shadows (`4px 5px 0 #0A0A0A` / `6px 7px 0 #0A0A0A`)
  - Electric-lime primary CTA buttons (`#A1F000`) with press-state translation toward shadow
  - Purple accents (`#8C6ADE`) and supporting pastel cards in peach (`#FFE3B3`), lavender (`#E4E6FB`), mint (`#E5F7E5`), and pink (`#FFB6C2`)
  - Massive heavy black headings (weight 800-900, tight tracking)
  - Small tracked uppercase monospace micro-labels with blue square markers (`#6AAAFB`)
  - Tilted sticker badges (`-rotate-2`) and circular icon tokens
- **Consequence**: Uniquely branded, tactile, playful, and authoritative aesthetic matching Vowmode.
