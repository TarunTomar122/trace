# Trace Mobile App Design Guide (Aesthetic Parity With Web)

This document captures the current Trace web frontend aesthetic so mobile features can match the visual language and interaction style.

## Visual language
- Overall feel is clean, minimal, and editorial with generous whitespace, thin borders, and soft grays.
- Cards and panels are flat with subtle borders; shadows are rare and light.
- UI relies on a small palette with restrained, purposeful color accents.
- Emphasis is created via typography (weight, uppercase, tracking) and spacing, not heavy gradients.

## Typography
- Primary font: Space Grotesk (set as `--font-space-grotesk`), used as the default body font.
- Mono font: Geist Mono (`--font-geist-mono`) used for labels, metadata, and microcopy.
- Frequent use of uppercase labels with wide tracking and small sizes for secondary info.
- Headings use medium to semibold weights with tight tracking, body copy is smaller and soft.

## Core colors (global theme)
Defined in `frontend/app/globals.css`:
- Background: `#fafafa`
- Foreground: `#0a0a0a`
- Primary: `#0a0a0a`
- Primary foreground: `#fafafa`
- Secondary: `#3b3a3a`
- Border: `#b0b0b0`

Neutral UI uses `bg-white`, `bg-gray-50`, `border-gray-200`, and `text-secondary/70` for muted copy.

## Content type accent colors
Content labels and icons use consistent semantic colors:
- Video: red (`text-red-500`, `bg-red-50`)
- Repo: violet (`text-violet-500`, `bg-violet-50`)
- Paper: blue (`text-blue-500`, `bg-blue-50`)
- Blog/Article: emerald (`text-emerald-500`, `bg-emerald-50`)
- Discussion: amber (`text-amber-500`, `bg-amber-50`)
- Tweet/Thread: sky (`text-sky-500`, `bg-sky-50`)
- Launch: fuchsia (`text-fuchsia-500`, `bg-fuchsia-50`)
- Model: indigo (`text-indigo-500`, `bg-indigo-50`)
- News: orange (`text-orange-500`, `bg-orange-50`)

## Layout + spacing conventions
- Most pages use max widths (`max-w-4xl`, `max-w-6xl`, `max-w-7xl`) and center alignment.
- Standard horizontal padding: `px-4` on mobile, `px-6` or `px-8` on larger screens.
- Cards and panels use `rounded-xl` or `rounded-2xl`, never sharp edges.
- Dividers use light borders: `border-gray-200` or `divide-border/20`.
- Sticky headers and banners are common; background is `bg-white/95` with blur.

## Buttons and controls
- Primary CTA: solid foreground background (`bg-foreground text-background`) with `rounded-full` or `rounded-xl`.
- Secondary buttons use borders and muted text (`border-gray-200 text-secondary`) with hover to `text-foreground`.
- Small icon buttons are square with `rounded-lg`, subtle hover background (`hover:bg-gray-100`).
- Microcopy buttons often use mono uppercase and letter spacing.

## Cards and list items
- Feed items and bookmarks are list-style cards: `p-4 md:p-5`, `rounded-xl`, `hover:bg-gray-50`.
- Title is the focus with `text-base md:text-lg` and `line-clamp-2`.
- Secondary text uses smaller sizes and `text-secondary/70`.
- Action rows use compact icon buttons with color on active state.

## Banners and callouts
The UI uses contextual banners in soft tints:
- Onboarding callout: violet background (`bg-violet-50`).
- Subscription preview: amber background (`bg-amber-100`).
- Feedback prompts: blue background (`bg-blue-50`).
- Success/active states: green badges (e.g., `bg-green-50`, `text-green-600`).

## Motion and interaction
- Subtle animations with `framer-motion` for fades, slide-ins, and expanding panels.
- Hover effects are restrained (opacity changes, icon reveal, slight color shift).
- Active tap states use `active:scale-[0.98]` or `active:scale-95` on buttons.

## Iconography and imagery
- Icons are from `lucide-react`, thin stroke (`strokeWidth=1.5`) and consistent sizes.
- Logo is `trace.png`, used inline with uppercase wordmark “TRACE”.
- Decorative elements are simple: lines, dots, thin borders, and small accent blocks.

## Mobile-first behaviors to mirror
- Content filters are horizontal scroll pills on mobile.
- Many desktop-only sections collapse to stacked, single-column layouts.
- Headers are sticky; CTA banners push layout down on mobile.
- Tooltips on desktop become inline expandable panels on mobile (see onboarding).

## Practical guidance for React Native
- Use a light, flat surface system: white cards on a #fafafa background.
- Keep radii large (12–16+), and spacing generous to preserve the airy feel.
- Use mono font for labels and metadata; primary font for headings/body.
- Match semantic content colors for content types and icons.
- Favor simple transitions (opacity/translate) over heavy motion.
- Preserve uppercase + tracking for labels and callouts.

## Key design references in the frontend
- `frontend/app/globals.css` for theme variables and base typography.
- `frontend/components/Header.tsx` and `frontend/components/PublicHeader.tsx` for header styling.
- `frontend/app/feed/page.tsx` for the main card style and interaction patterns.
- `frontend/app/page.tsx` for landing page tone, spacing, and motion.
- `frontend/app/onboarding/page.tsx` for pill selectors, help tooltips, and form styling.
- `frontend/app/profile/page.tsx` for panels and subscription UI.
- `frontend/app/trending/page.tsx` and `frontend/app/trending/[topic]/page.tsx` for grid/list cards.
- `frontend/app/waitlist/page.tsx` and `frontend/app/wip/page.tsx` for the more editorial, mono-heavy aesthetic.

