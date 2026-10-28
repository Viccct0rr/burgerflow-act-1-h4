---
name: BurgerFlow
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#5b403d'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#8f6f6c'
  outline-variant: '#e4beba'
  surface-tint: '#ba1a20'
  primary: '#af101a'
  on-primary: '#ffffff'
  primary-container: '#d32f2f'
  on-primary-container: '#fff2f0'
  inverse-primary: '#ffb3ac'
  secondary: '#8b5000'
  on-secondary: '#ffffff'
  secondary-container: '#ff9800'
  on-secondary-container: '#653900'
  tertiary: '#575757'
  on-tertiary: '#ffffff'
  tertiary-container: '#706f6f'
  on-tertiary-container: '#f6f3f3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb3ac'
  on-primary-fixed: '#410003'
  on-primary-fixed-variant: '#930010'
  secondary-fixed: '#ffdcbe'
  secondary-fixed-dim: '#ffb870'
  on-secondary-fixed: '#2c1600'
  on-secondary-fixed-variant: '#693c00'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#474746'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style
The design system is built for the high-velocity environment of professional kitchen management. It balances a high-energy "Street Food" aesthetic with the precision of modern SaaS. The brand personality is efficient, reliable, and optimistic.

The design style is **Corporate Modern with a Tactile Edge**. It utilizes generous white space to reduce cognitive load during peak hours, while employing high-intensity color accents to signal urgency and brand identity. Surfaces are clean and systematic, but large touch targets and rounded geometry maintain a youthful, approachable feel.

## Colors
This design system uses a high-contrast palette to ensure legibility in brightly lit kitchen environments.

- **Primary (#D32F2F):** Used for critical actions, branding, and urgent "New" order statuses.
- **Secondary (#FF9800):** Used for "In Progress" states and secondary calls to action. It provides warmth and visual appetite appeal.
- **Deep Charcoal (#212121):** Reserved for primary text and side navigation to provide a grounded, professional frame.
- **Background (#F5F5F5):** A soft neutral gray used for the application canvas to reduce eye strain and separate card-based content.

## Typography
The typography strategy prioritizes glanceability. **Montserrat** is used for headings to provide a bold, geometric character that feels modern and energetic. **Inter** is used for all functional UI text and body copy due to its exceptional legibility and neutral tone.

For kitchen display screens, use `body-lg` as the minimum standard for order details to ensure readability from a distance. Use `label-lg` for status badges to ensure clear distinction between different stages of the workflow.

## Layout & Spacing
This design system utilizes a **Fluid Grid** with fixed margins. The layout is optimized for tablet and desktop "Kitchen Display Systems" (KDS).

- **Desktop/Tablet:** 12-column grid with 24px gutters. Content is organized into functional zones (e.g., Sidebar, Main Feed, Detail Panel).
- **Mobile:** 4-column grid with 16px margins. Elements should stack vertically, with high-priority "Action Bars" pinned to the bottom of the viewport for thumb-reachability.
- **Rhythm:** All spatial relationships are multiples of 8px to maintain a consistent visual cadence and ensure alignment across complex data tables and order boards.

## Elevation & Depth
Depth is signaled through **Tonal Layers** and **Ambient Shadows**. 

The base application uses a flat `#F5F5F5` surface. Functional units like order cards and inventory modules are elevated using white `#FFFFFF` surfaces with a "Soft Float" shadow:
- **Shadow Profile:** `0px 4px 12px rgba(33, 33, 33, 0.08)`.

Interactive elements like buttons use a slightly more pronounced shadow on hover to simulate physical tactility. In the Kitchen view, the "Active" order card should use a thick 4px border in the Primary Red color instead of increased shadow to avoid visual clutter while still highlighting the current task.

## Shapes
The shape language is friendly and ergonomic. A standard corner radius of **12px (0.75rem)** is applied to all primary containers, including cards and input fields.

- **Buttons:** Use `rounded-lg` (16px) to create a soft, inviting touch target.
- **Badges/Chips:** Use `rounded-xl` (24px) or full pill-shape to distinguish them from structural elements.
- **Selection States:** Use a 4px inner radius for nested elements within cards to maintain visual nesting logic.

## Components
- **Order Cards:** Use a white base with a colored top-accent bar corresponding to the status (Red for New, Orange for Preparing, Green for Ready). Use `headline-md` for order numbers.
- **Buttons:** Primary buttons use a solid `#D32F2F` fill with white text. Height should be a minimum of 56px for "Kitchen Mode" to accommodate gloved or rapid-touch interactions.
- **Badges:** Small, high-contrast labels for statuses. Use uppercase `label-lg` typography.
- **Input Fields:** Large 16px text with 12px padding. Borders should be 2px solid `#E0E0E0`, turning Primary Red on focus.
- **Inventory Lists:** Compact rows with `body-md` text. Use "Steppers" (plus/minus icons) for stock updates, ensuring the icons are at least 44x44px.
- **Navigation:** Vertical sidebar using Deep Charcoal background with icons in white. Active states should use a Primary Red indicator bar on the left edge.