# DESIGN SYSTEM: ICP.MODE
**Aesthetic Heritage: Vowmode-Inspired Neo-Brutalist & Editorial Precision**

---

## 1. Aesthetic Thesis & Core Philosophy
`icp.mode` adopts the authentic visual character of Vowmode (`vowmode.ai.studio`):
- **Neo-brutalist, playful, editorial, bold, premium, and exceptionally well organized.**
- It feels like a high-quality, thoughtfully designed startup product—never a default AI dashboard.

### Anti-Slop Discipline
- **Zero generic purple-to-blue gradients**
- **Zero glassmorphism**
- **Zero thin grey dashboard cards**
- **Zero stock photographs**
- **Zero random emoji as core UI icons**
- **Zero tiny illegible text or excessive blurred shadows**

---

## 2. Color Tokens & Distribution

```css
:root {
  --canvas: #F9F8F4;   /* Warm ivory canvas */
  --ink: #0A0A0A;      /* Near-black text and borders */
  --lime: #A1F000;     /* Electric-lime CTA buttons */
  --purple: #8C6ADE;   /* Purple highlights & tags */
  --peach: #FFE3B3;    /* Pastel yellow/peach cards */
  --lavender: #E4E6FB; /* Pastel lavender cards */
  --mint: #E5F7E5;     /* Pastel mint cards */
  --pink: #FFB6C2;     /* Pastel pink disqualified cards */
  --blue: #6AAAFB;     /* Section marker squares */
  --white: #FFFFFF;    /* Clean white content panels */
  --muted: #696969;    /* Subdued secondary text */
  --grid: #E8E8E4;     /* Checkerboard texture */
}
```

### Canvas Texture
- Background is a **very subtle, light-grey checkerboard texture** implemented purely in CSS using repeating gradients:
  - Faint opacity (`rgba(215, 215, 208, 0.3)`)
  - Never competes with text
  - Zero external images

---

## 3. Borders, Shadows & Radius

### Borders
- **Main panels & table shells**: `3px solid #0A0A0A`
- **Interactive cards**: `2.5px - 3px solid #0A0A0A`
- **Buttons & inputs**: `2.5px solid #0A0A0A`
- **Micro-badges & chips**: `1.5px - 2px solid #0A0A0A`

### Hard Offset Black Shadows
- **Standard Card / Button**: `4px 5px 0px #0A0A0A`
- **Elevated Hero / Modal**: `6px 7px 0px #0A0A0A`
- **Micro-Chips / Inputs**: `2px 2px 0px #0A0A0A` or `3px 3px 0px #0A0A0A`

### Radius
- **Main Panels & Containers**: `14px - 20px` (`rounded-2xl`)
- **Buttons & Form Fields**: `10px - 12px` (`rounded-xl`)
- **Step Tiles**: `8px - 10px`
- **Small Chips**: `6px` (`rounded-[6px]`)
- **Icon Medallions**: Fully round (`rounded-full`)

---

## 4. Typography & Scale Hierarchy

- **Display**: `Inter` / system-ui (weight 800–900, tight tracking).
- **Body**: `Inter`, 400–600 weight.
- **Metadata & Telemetry**: `Space Mono` / `JetBrains Mono` (`font-mono`, `tabular-nums`).

### Scale Hierarchy
- **Desktop Hero Headings**: `clamp(44px, 6vw, 84px)` (massive, heavy black, tight tracking)
- **Dashboard Page Headings**: `44px - 60px`
- **Section Headings**: `36px - 52px`
- **Card Headings**: `19px - 27px`
- **Body**: `15px - 17px`
- **Micro-Labels**: `10px - 12px`, uppercase, letter-spaced monospace

---

## 5. Navigation Contract (AppNavbar)
- Top border-heavy horizontal navbar (`3px solid #0A0A0A`):
  - **Left**: Small lime square (`w-3.5 h-3.5 bg-[#A1F000] border-2 border-[#0A0A0A]`) + `"THE CUSTOMER-FIT ENGINE"`
  - **Center**: `icp.mode` wordmark (heavy black font 900, tight tracking)
  - **Right**: Outlined/lime `"MY DASHBOARD →"` button with hard offset black shadow
  - Graceful collapse into a bold mobile dropdown menu on small screens.

---

## 6. Component Library Catalog
1. `AppNavbar`: Heavy border top navigation with lime indicator, center wordmark, and action button.
2. `SectionEyebrow`: Blue square marker (`#6AAAFB`) + tracked uppercase monospace label.
3. `BrutalistButton`: Hard offset shadow, press-state translation (`translate-x-[3px] translate-y-[4px]`), electric-lime, white, purple, peach, lavender variants.
4. `BrutalistCard`: 3px border, hard black shadow, hover lift, white or pastel fills.
5. `PastelStepCard`: Numbered pastel cards (peach, lavender, mint, pink) with icon medallions.
6. `StickerBadge`: Tilted floating badge (`-rotate-2` / `rotate-2`), hard shadow, vibrant pastel background.
7. `IconMedallion`: Fully round circular icon token with 2px border and centered icon.
8. `MetricCard`: Massive tabular numbers, micro-labels, and status badges.
9. `SectionHeading`: Heavy oversized title, SectionEyebrow, and sub-prose.
10. `FormField`: Micro-label, 2.5px border input/textarea with active ring and shadow.
11. `ProgressStepper`: Horizontal step progress with pastel step tiles.
12. `StatusChip`: 6px rounded chip, bold border, and dot status.
13. `TableShell`: Editorial table with 3px border, bold dividers, and hard shadow.
14. `EmptyState`: Brutalist card with icon medallion, bold copy, and action button.
15. `Modal`: Thick bordered dialog with backdrop and hard shadow.
16. `Toast`: Snappy bottom-right notification pill with shadow.
17. `LoadingSkeleton`: Pulse skeleton with bold borders.

---

## 7. Interaction States
- **Button Press**: Translates 3px down, 4px right toward its shadow (`active:translate-x-[3px] active:translate-y-[4px] active:shadow-[1px_1px_0px_#0A0A0A]`).
- **Card Hover**: Lifts 2px up with shadow expansion.
- **Inputs**: 2.5px solid border with lime focus ring (`focus:ring-2 focus:ring-[#A1F000]`).
- **Timing**: 120ms–180ms ease transitions.
- **Accessibility**: Visible focus rings (`focus-visible:ring-2`), WCAG contrast compliant.
