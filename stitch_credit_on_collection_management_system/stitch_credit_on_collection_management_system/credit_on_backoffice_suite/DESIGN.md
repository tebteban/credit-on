---
name: CREDIT-ON Backoffice Suite
colors:
  surface: '#fbf9f9'
  surface-dim: '#dcd9da'
  surface-bright: '#fbf9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f4'
  surface-container: '#f0edee'
  surface-container-high: '#eae7e8'
  surface-container-highest: '#e4e2e3'
  on-surface: '#1b1b1c'
  on-surface-variant: '#45464c'
  inverse-surface: '#303031'
  inverse-on-surface: '#f3f0f1'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#545c72'
  on-primary: '#ffffff'
  primary-container: '#6c748b'
  on-primary-container: '#fefcff'
  inverse-primary: '#bec6e0'
  secondary: '#5b5e68'
  on-secondary: '#ffffff'
  secondary-container: '#dddfea'
  on-secondary-container: '#5f626c'
  tertiary: '#6e5938'
  on-tertiary: '#ffffff'
  tertiary-container: '#88714f'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fc'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3e465b'
  secondary-fixed: '#e0e2ed'
  secondary-fixed-dim: '#c4c6d1'
  on-secondary-fixed: '#181c24'
  on-secondary-fixed-variant: '#434750'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#fbf9f9'
  on-background: '#1b1b1c'
  surface-variant: '#e4e2e3'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  currency-xl:
    fontFamily: JetBrains Mono
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.03em
  currency-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.02em
  currency-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.01em
  tabular-label:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  spacing-2xs: 0.125rem
  spacing-xs: 0.25rem
  spacing-sm: 0.5rem
  spacing-md: 0.75rem
  spacing-base: 1rem
  spacing-lg: 1.25rem
  spacing-xl: 1.5rem
  spacing-2xl: 2rem
  table-cell-py: 0.375rem
  table-cell-px: 0.75rem
  gutter-desktop: 1rem
---

## Brand & Style

This design system establishes a high-density, authoritative financial operating environment tailored for institutional backoffice workflows, daily credit collections, cash-desk reconciliations, and portfolio audits. 

The aesthetic is precision-driven corporate modernism engineered for operational speed, high legibility, and uncompromising data integrity. Visual noise is minimized in favor of crisp spatial compartmentalization, micro-scale status indicators, and unambiguous data hierarchy.

### Core Character
- **Audience:** Financial analysts, credit controllers, field collection managers, and treasury auditors working across multi-monitor desktop environments.
- **Tone:** Methodical, unshakeable, vigilant, and mathematically precise.
- **Interaction Philosophy:** Zero frivolous animation; high-efficiency keyboard navigation, dense grid alignments, and explicit audit states that immediately flag balancing surpluses, deficits, and arrears.

## Colors

The color palette reflects financial gravity and rapid state comprehension:
- **Primary Steel Gray (`#6F778E`):** Anchors headers, sidebars, primary control bars, high-value metrics, and structural dividers.
- **Secondary Slate Neutral (`#747781`):** Applied strictly to validated cash flow, reconciled ledger items, positive daily delta, and primary audit verification actions.
- **Tertiary Deep Umber (`#231500`):** Dedicated to ledger discrepancies, arrears (mora), uncollected quotas, and cash reconciliation variances.
- **Surfaces & Grounds:** Clean layered slate neutrals (`#FFFFFF`, `#F8FAFC`, `#F1F5F9`, and borders at `#E2E8F0`) ensure tabular data and figure-heavy records remain distinct during long operational sessions without eye fatigue.

## Typography

Typography prioritizes numerical precision, scanning speed, and strict column alignment:
- **Inter (Headings & UI Copy):** Set with tight letter-spacing for sharp, high-density layouts. Standard text must use standard tabular lining numbers (`font-variant-numeric: tabular-nums`).
- **JetBrains Mono (Monospace / Currency / Reconciliations):** Reserved for financial amounts, balance counters, transaction hashes, voucher series IDs, and audit flags. This ensures decimals, digit groupings, and credit columns line up to the exact pixel.

## Layout & Spacing

This design system uses a high-density, 12-column desktop-first fluid grid optimized for screen widths from 1366px to 2560px (dual-monitor treasury workstations).

- **Screen Architecture:** Rigid top status bar (40px) atop a collapsible dual-tier navigation sidebar (56px collapsed / 240px expanded). The central operational viewport distributes cards and ledger grids with a standard `16px` gutter.
- **Vertical Density:** Table rows operate on compact padding scales (`6px` vertical / `12px` horizontal) to support inspection of 25–40 ledger entries without pagination scrolling.
- **Responsiveness:** While primarily designed for desktop cockpits, tablet breakpoints (768px - 1024px) collapse side-by-side reconciliation panels into stacked tabs, maintaining full tabular figures without clipping.

## Elevation & Depth

This system avoids expressive drop shadows in favor of low-contrast outlines and structural surface layering. Depth represents containment rather than floating height.

- **Level 0 (App Canvas):** `#F8FAFC` base surface.
- **Level 1 (Panels & Data Grids):** Pure white `#FFFFFF` surface enclosed by a 1px uniform border (`#E2E8F0`).
- **Level 2 (Active Drawer & Reconcile Modals):** White `#FFFFFF` backed by a 1px border (`#CBD5E1`) and a low-diffusion utilitarian shadow: `0 4px 12px -2px rgba(15, 23, 42, 0.08)`.
- **Audit Focus Layer:** Active balancing rows receive an inset 2px border in `#747781` (for balance matches) or `#DC2626` (for mismatches) alongside a 4% tinted background wash.

## Shapes

The design system enforces a disciplined `roundedness: 1` (soft/micro-radii):
- Buttons, inputs, filter chips, and table badges employ a compact `4px` border radius (`rounded`).
- Cards, ledger containers, and modal sheets use `8px` (`rounded-lg`).
- Data tags and monetary balance counters use squared micro-corners (`2px` - `4px`), reinforcing the impression of a reliable, high-spec terminal instrument.

## Components

### Buttons
- **Primary Action (Commit / Validate Cash):** Steel gray (`#6F778E`) or Slate (`#747781`) background, white text, 32px height, 13px font size, semibold weight, 12px horizontal padding.
- **Secondary (Export / Filters):** White surface with 1px `#CBD5E1` border, `#334155` text, hover state at `#F1F5F9`.
- **Destructive / Variance Reject:** Crimson border `#F87171`, `#991B1B` text, faint coral background `#FEF2F2`.

### Dense Data Tables
- Header cells: `#F1F5F9` background, 28px height, 11px uppercase monospace labels (`#475569`), right-aligned for monetary columns, left-aligned for identity strings.
- Body rows: 36px default height, alternating row highlight optional, selected row receives `#F0FDF4` (reconciled) or `#FEF2F2` (discrepancy).

### Audit Status Badges
- **Match Exacto (Balanced):** `#ECFDF5` background, `#047857` border, `#065F46` monospace label with a solid `●` indicator.
- **Superávit (Surplus):** `#EFF6FF` background, `#1D4ED8` text, indicating unallocated cash entries.
- **Déficit / Mora (Arrears):** `#FEF2F2` background, `#B91C1C` border, `#991B1B` text displaying negative offset figures prefixed with `-`.

### Form & Input Controls
- Compact 32px height, tabular monospace text entry for amounts with integrated ISO currency adornments (`ARS $`), crisp `1px #CBD5E1` border, active focus ring `0 0 0 2px rgba(111, 119, 142, 0.2)`.

### Credit Workflow Summary Cards
- White background, 1px border, 12px interior padding. Split layout: left column contains human-readable identity details (collector, client ID, route code), right column displays stacked tabular figures (`JetBrains Mono`) for Cuotas Cobradas vs. Saldo Pendiente.