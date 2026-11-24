# Pulse Design Sheet — iOS Glassmorphism System

> Extracted read-only from the real Pulse frontend on this Mac
> (`/Users/somesh/Projects/social-intelligence/apps/frontend/`) on 2026-10-25.
> Every token below traces to a file listed in §9. Nothing is invented:
> where Pulse defines no value, the sheet says so instead of guessing.
> HSL values are authoritative; `≈ hex` values are computed approximations.

---

## 1. Design language

Pulse's dashboard is **iOS glassmorphism on a dark shell**: frosted,
translucent panels floating over a near-black ambient background lit by two
soft glows (warm orange top-left, faint white bottom-right). Panels use a
top-to-bottom white gradient at low opacity, a 24px blur with 180%
saturation, a hairline white border, a soft inner top highlight, and a deep
soft drop shadow. Radii are large (24–28px) and pill-shaped for interactive
rows. The single most recognizable element is the **active white pill**:
the current nav item (and completed states) render as a solid white pill
with black text — unmistakable against the frosted dark. Everything is
sans-serif (Inter, pinned — serif and mono deliberately resolve to the same
sans stack). Loading states are never bare spinners: frosted skeleton
blocks with a visible light sweep, always paired with a "Loading…" label,
and AI thinking is three bouncing dots inside a glass pill. The landing and
auth pages keep their own styles; the glass look applies only inside the
dashboard shell (see §8).

---

## 2. Color tokens

### 2.1 Theme tokens (shadcn-style HSL CSS variables, `app/globals.css`)

Tailwind maps these 1:1 (`tailwind.config.ts`): `background`, `foreground`,
`primary`, `secondary`, `muted`, `accent`, `destructive`, `popover`, `card`,
`border`, `input`, `ring` — each as `hsl(var(--…))` with a `-foreground`
companion where applicable. Use as `bg-background`, `text-foreground`,
`bg-card`, `text-muted-foreground`, `border-border`, `ring-ring`, etc.

| Token | Light (`:root`) | Dark (`.dark`, forced on dashboard) |
|---|---|---|
| `--background` | `0 0% 100%` — #FFFFFF | `240 10% 3.9%` — ≈ #09090B |
| `--foreground` | `240 10% 3.9%` — ≈ #09090B | `0 0% 98%` — #FAFAFA |
| `--card` / `--popover` | `0 0% 100%` — #FFFFFF | `240 10% 5.5%` — ≈ #0D0D0F |
| `--card-foreground` / `--popover-foreground` | `240 10% 3.9%` — ≈ #09090B | `0 0% 98%` — #FAFAFA |
| `--primary` | `240 5.9% 10%` — #18181B | `0 0% 98%` — #FAFAFA |
| `--primary-foreground` | `0 0% 98%` — #FAFAFA | `240 5.9% 10%` — #18181B |
| `--secondary` / `--muted` / `--accent` | `240 4.8% 95.9%` — ≈ #F4F4F5 | `240 3.7% 13%` — ≈ #202022 |
| `--secondary-foreground` / `--muted-foreground` | `240 3.8% 46.1%` — ≈ #71717A (muted text) | `240 5% 64.9%` — ≈ #A1A1AA (muted text) |
| `--accent-foreground` | `240 5.9% 10%` — #18181B | `0 0% 98%` — #FAFAFA |
| `--destructive` | `0 84.2% 60.2%` — #EF4444 | `0 62.8% 50.6%` — ≈ #D03232 |
| `--destructive-foreground` | `0 0% 98%` — #FAFAFA | `0 0% 98%` — #FAFAFA |
| `--border` / `--input` | `240 5.9% 90%` — #E4E4E7 | `240 3.7% 15.9%` — #27272A |
| `--ring` | `240 5.9% 10%` — #18181B | `240 4.9% 83.9%` — ≈ #D4D4D8 |
| `--radius` | `0.625rem` (10px) — both modes | same |

Derived radii from `--radius`: `lg = var(--radius)` (10px),
`md = calc(var(--radius) - 2px)` (8px), `sm = calc(var(--radius) - 4px)` (6px).

### 2.2 Glass surfaces (copy-paste CSS, `app/globals.css`)

```css
/* Base frosted surface — sidebar panel, AI composer, dialogs base */
.glass-panel {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 12px 32px rgba(0, 0, 0, 0.35);
}

/* Cards, only inside .glass-theme (dashboard) */
.glass-theme .pulse-card {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04));
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border-color: rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 12px 32px rgba(0, 0, 0, 0.3);
  color: hsl(var(--card-foreground));
}

/* Dialogs, only inside .glass-theme (dashboard) */
.glass-theme .pulse-dialog {
  background: linear-gradient(180deg, rgba(38, 38, 42, 0.85), rgba(20, 20, 23, 0.9));
  -webkit-backdrop-filter: blur(32px) saturate(180%);
  backdrop-filter: blur(32px) saturate(180%);
  border-color: rgba(255, 255, 255, 0.12);
  border-radius: 28px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 24px 64px rgba(0, 0, 0, 0.55);
}
```

Notes: panel blur is **24px** (dialogs **32px**), saturation **180%**
everywhere. The inner top highlight (`inset 0 1px 0 rgba(255,255,255,…)`) is
what makes a panel read as glass instead of flat grey. Outside
`.glass-theme`, cards/dialogs render their normal token styles (see §5).

### 2.3 Accent — orange

The brand accent is a Tailwind orange gradient, used for the logo mark and
the warm ambient glow. Tailwind palette values:

- Gradient: `bg-gradient-to-br from-orange-400 to-orange-600`
  (`#FB923C` → `#EA580C`), logo mark only.
- Glow: `bg-orange-500/10` (`#F97316` at 10%) with `blur-[120px]`.
- Logo shadow: `shadow-lg shadow-orange-500/20`.
- No other orange usage was found in the themed shell — orange is an
  accent, not a primary action color (buttons use `primary` tokens).

### 2.4 Active pill — white on dark

```css
.glass-pill-active {
  background: #fff;
  color: #000;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}
.glass-pill-active:hover {
  background: #f5f5f5;
  color: #000;
}
```

Use for: the active sidebar nav item, and completed/done pills. Always
white surface + black text, never tinted.

### 2.5 Text colors (dark dashboard)

- Primary text: `text-white` for shell chrome (logo, nav, headings in the
  shell), otherwise `text-foreground` (≈ #FAFAFA).
- Secondary/muted text: `text-white/50`, `text-white/60`, `text-white/40`
  (shell chrome, descending emphasis) or `text-muted-foreground`
  (≈ #A1A1AA) for content.
- Placeholders: `placeholder:text-white/40` (shell search),
  `placeholder:text-muted-foreground` (composer).

### 2.6 Success / danger / status colors

Pulse defines **no `success` token** in `:root`/`.dark` — status is
expressed with Tailwind palette utilities:

| Meaning | Light | Dark |
|---|---|---|
| Success (badge `success`, KPI up) | `bg-emerald-500/15`, `text-emerald-700`; KPI delta `text-emerald-600` | `text-emerald-400` |
| Warning (badge `warning`) | `bg-amber-500/15`, `text-amber-700` | `text-amber-400` |
| Info (badge `info`) | `bg-sky-500/15`, `text-sky-700` | `text-sky-400` |
| Danger / destructive | `bg-destructive` (`≈ #D03232` dark) | same token |
| KPI down | `text-red-600` | `text-red-400` |
| Neutral delta | `text-muted-foreground` | same |

Calendar type colors (AI calendar card pills, `bg-…/10` + `text-…-600` +
`dark:text-…-400` + `border-…/20`): meeting **blue**, note **purple**,
reminder **amber**, event **emerald**, holiday **red**.

### 2.7 Ambient glows (dashboard background lighting)

Fixed, pointer-transparent layer behind everything (`layout.tsx`):

```html
<div aria-hidden="true" class="pointer-events-none fixed inset-0 overflow-hidden">
  <div class="absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-orange-500/10 blur-[120px]" />
  <div class="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-white/[0.04] blur-[100px]" />
</div>
```

- Warm glow: 384×384px circle, orange at 10%, blur 120px, top −160px,
  left 1/3.
- White glow: 320×320px circle, white at 4%, blur 100px, bottom-right.
- Both are **static** — no drift/float animation was defined for them.

### 2.8 Overlays

- Dialog overlay: `fixed inset-0 z-50 bg-black/60 backdrop-blur-md`.
- Mobile sidebar backdrop: `fixed inset-0 z-40 bg-black/60 backdrop-blur-sm`.
- Chart tooltip: `rounded-lg border bg-popover/95 px-3 py-2 text-xs
  text-popover-foreground shadow-lg backdrop-blur`.

---

## 3. Typography

### 3.1 Font stacks (pinned — `tailwind.config.ts`, `app/layout.tsx`)

```ts
// next/font: Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
// body class: `${inter.variable} font-sans`
fontFamily: {
  sans:  ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  serif: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  mono:  ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
}
```

Body CSS (`globals.css`): `font-family: var(--font-inter), ui-sans-serif,
system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
sans-serif;` with `font-feature-settings: 'cv11', 'ss01'` and
`antialiased`. **Serif and mono deliberately resolve to the same sans
stack** so no component or third-party widget can render in a serif or
typewriter face anywhere in the product. There is no display/headline font.

### 3.2 Sizes and weights actually used (no h1–h6 scale is defined)

| Usage | Classes |
|---|---|
| Shell wordmark "Pulse" | `text-base font-semibold tracking-tight text-white` |
| Shell subtitle / group labels / footers | `text-[11px]`, subtitle `text-white/50`; group label `font-medium uppercase tracking-wider text-white/40`; footer `leading-relaxed text-white/40` |
| Nav links, body buttons | `text-sm font-medium` |
| Header page title | `text-base font-semibold tracking-tight` |
| Card title | `text-sm font-semibold leading-none tracking-tight` |
| Card description | `text-xs text-muted-foreground` |
| Dialog title / description | `text-base font-semibold leading-none tracking-tight` / `text-sm text-muted-foreground` |
| KPI label / value / delta | `text-xs font-medium text-muted-foreground` / `text-2xl font-semibold tracking-tight tabular-nums` / `text-xs tabular-nums` |
| AI empty-state heading / body | `text-3xl font-semibold tracking-tight` / `text-[15px] leading-relaxed text-muted-foreground` |
| AI user bubble / composer input | `text-[15px] leading-relaxed` |
| Labels, captions, pills, tooltips | `text-xs` (labels, captions, badges, ThinkingDots, tooltips); kbd `text-[10px]`; calendar card date line `text-[11px]`; type pills `text-[11px] font-medium` |
| Chart axis ticks | `11px`, `fill-muted-foreground` |

Numbers use `tabular-nums` (KPI values, deltas, calendar day numbers).
Headings use `tracking-tight`; group labels use `tracking-wider` +
`uppercase`.

---

## 4. Shapes

### 4.1 Border radii

| Element | Radius |
|---|---|
| Sidebar floating panel, AI composer | `rounded-[28px]` (28px) |
| Glass dialog (inside `.glass-theme`) | `28px` (base dialog: `rounded-xl`) |
| Glass card (inside `.glass-theme`) | `24px` (base card: `rounded-xl`) |
| Dashboard skeleton blocks | `rounded-[24px]` containers |
| Calendar action card | `rounded-2xl` (16px) |
| Logo mark | `rounded-xl` (12px); KPI icon pill `rounded-full` (32×32px) |
| Nav links, search pill, ThinkingDots pill, send button, badges, suggestion chips, user bubble | `rounded-full` |
| Buttons (default) | `rounded-md` (8px from `--radius`); dialog close `rounded-sm` (6px) |
| Inputs/selects, tooltip, chart tooltip, kbd | `rounded-md` (kbd, inputs) / `rounded-lg` (tooltips) |
| Skeleton bars (base) | `rounded-md` |
| iOS calendar date square | `rounded-xl` |
| "View in Calendar" link | `rounded-xl` |

### 4.2 Borders

- Glass panel: `1px solid rgba(255, 255, 255, 0.12)`.
- Glass card border: `rgba(255, 255, 255, 0.1)`; glass dialog border:
  `rgba(255, 255, 255, 0.12)`.
- Shell hairlines: `border-white/10` (search pill, nav footer, KPI icon
  pill, sidebar search kbd).
- Content borders: `border-border` (cards), `border-border/70`
  (calendar card, action pill), `border-black/10` light /
  `border-white/10` dark (calendar date square).
- Global rule: `* { @apply border-border; }` — every element's default
  border color is the border token.
- Focus: `:focus-visible { outline-none; ring-2 ring-ring ring-offset-2
  ring-offset-background; }` (buttons repeat this pattern).

### 4.3 Spacing rhythm

- Sidebar: outer `p-3`, panel `p-3`, desktop width `w-[264px]`, mobile
  drawer `w-[280px]` at `bottom-3 left-3 top-3`.
- Main content: `p-4 lg:p-6`, inner `mx-auto max-w-[1400px]`
  (Tailwind container `2xl` is also `1400px`, padding `1.5rem`).
- Header: `h-16`, `px-4 lg:px-6`, `gap-2`; right cluster `gap-1.5`.
- Cards: header `p-5 space-y-1.5`, content `p-5 pt-0`, footer
  `p-5 pt-0`; KPI content `p-5`; dialog `p-6 gap-4`, `max-w-lg`.
- AI column: `max-w-[800px]`, `gap-10`, `px-4 py-8`; composer
  `max-w-[800px] px-4 pb-2.5 pt-3`; chat sidebar `w-[240px] pr-2`.
- Sidebar nav: links `px-3 py-2 gap-3`, group label `px-3 pb-2`,
  search pill `mb-4 px-3 py-2 gap-2`, logo row `gap-2.5 px-2 pb-3 pt-1`.
- Scrollbar: `10px` wide/high, transparent track, thumb `rounded-full
  bg-border` with `2px solid transparent` + `background-clip: content-box`,
  hover `bg-muted-foreground/40`.

---

## 5. Components

### 5.1 Sidebar — floating frosted Orbit-style panel

- Panel: `glass-panel flex h-full w-full flex-col rounded-[28px] p-3`.
- Logo row: 36×36px mark (`h-9 w-9 rounded-xl bg-gradient-to-br
  from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/20`,
  16px Zap icon) + "Pulse" (`text-base font-semibold tracking-tight
  text-white`) + "Social Intelligence" (`text-[11px] text-white/50`).
- Search pill (real, not decorative): `mb-4 flex items-center gap-2
  rounded-full border border-white/10 bg-white/[0.06] px-3 py-2`; icon
  16px `text-white/50`; input `w-full bg-transparent text-sm text-white
  outline-none placeholder:text-white/40`; kbd `rounded-md border
  border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/50`
  showing the ⌘K hint. Typing filters nav labels (case-insensitive
  substring); ⌘K / Ctrl+K focuses it from anywhere in the dashboard.
- Nav group: label "Navigation" (`px-3 pb-2 text-[11px] font-medium
  uppercase tracking-wider text-white/40`); links `flex items-center gap-3
  rounded-full px-3 py-2 text-sm font-medium transition-colors` with 16px
  icons; inactive `text-white/60 hover:bg-white/10 hover:text-white`;
  **active = `glass-pill-active`** (white pill, black text).
  Empty-filter text: `px-3 py-2 text-xs text-white/40`.
- Footer: `border-t border-white/10 px-3 pb-1 pt-3`, `text-[11px]
  leading-relaxed text-white/40`, static brand note (never data).
- Desktop: `aside sticky top-0 hidden h-screen shrink-0 p-3 lg:block`,
  inner `h-full w-[264px]`.
- Mobile drawer: backdrop `fixed inset-0 z-40 bg-black/60 backdrop-blur-sm
  transition-opacity lg:hidden` (open `opacity-100`, closed
  `pointer-events-none opacity-0`); drawer `fixed bottom-3 left-3 top-3
  z-50 w-[280px] transition-transform lg:hidden` (open `translate-x-0`,
  closed `-translate-x-[calc(100%+1rem)]`); panel close button `ml-auto
  rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white
  lg:hidden`.

### 5.2 Header — transparent bar

- `sticky top-0 z-30 flex h-16 items-center gap-2 px-4 lg:px-6`.
- **No border, no solid fill** — it floats over the ambient background.
- Title: `text-base font-semibold tracking-tight` (route-mapped:
  Overview, Analytics, Content Intelligence, Audience Intelligence,
  Engagement, Mentions, Content Calendar, AI Intelligence, Reports,
  Connected Accounts, Settings; fallback "Dashboard").
- Right cluster `ml-auto flex items-center gap-1.5`: date-range select
  (trigger `h-8 w-32 text-xs`, only on Overview/Analytics/Content/
  Audience/Engagement), notifications bell, user button.
- Mobile menu button: ghost icon button, `lg:hidden`.
- **No theme toggle by design** — the dashboard is dark glass, so there
  is nothing to switch (the toggle was intentionally removed).

### 5.3 Cards

- Base: `pulse-card rounded-xl border bg-card text-card-foreground
  shadow-[0_1px_2px_rgba(0,0,0,0.04)]`; header `flex flex-col
  space-y-1.5 p-5`; title `text-sm font-semibold leading-none
  tracking-tight`; description `text-xs text-muted-foreground`; content
  `p-5 pt-0`; footer `flex items-center p-5 pt-0`.
- Inside `.glass-theme`: the `.pulse-card` glass override (§2.2) applies
  — 24px radius, frosted gradient, 24px blur, soft shadow. Same component,
  different skin, switched purely by the ancestor class.

### 5.4 Dialogs

- Overlay: `fixed inset-0 z-50 bg-black/60 backdrop-blur-md`.
- Panel (base): `pulse-dialog fixed left-[50%] top-[50%] z-50 grid
  w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl
  border bg-background p-6 shadow-lg`.
- Inside `.glass-theme`: the `.pulse-dialog` glass override (§2.2) —
  dark gradient (`rgba(38,38,42,0.85)` → `rgba(20,20,23,0.9)`), 32px blur,
  28px radius, `0 24px 64px rgba(0,0,0,0.55)` shadow.
- Close: `absolute right-4 top-4 rounded-sm opacity-70
  transition-opacity hover:opacity-100` with a 16px X icon.
- Header `flex flex-col space-y-1.5 text-left`; title `text-base
  font-semibold leading-none tracking-tight`; description `text-sm
  text-muted-foreground`.

### 5.5 KPI cards (glass icon pill)

- Card with content `p-5`. Header row: `flex items-center
  justify-between`; label `flex items-center gap-1.5 text-xs font-medium
  text-muted-foreground` (+ optional `?` tooltip button: `inline-flex
  h-4 w-4 items-center justify-center rounded-full border
  border-muted-foreground/40 text-[10px] leading-none
  text-muted-foreground hover:text-foreground`).
- Icon pill: `flex h-8 w-8 items-center justify-center rounded-full
  border border-white/10 bg-white/[0.07]`, icon 16px
  `text-muted-foreground`.
- Value: `mt-2 text-2xl font-semibold tracking-tight tabular-nums`
  (already-formatted strings like "42.8k" or "4.6%").
- Delta: `mt-1.5 flex items-center gap-1 text-xs tabular-nums` with a
  14px arrow (up / down / flat at |delta| ≤ 0.05); up `text-emerald-600
  dark:text-emerald-400`, down `text-red-600 dark:text-red-400`, flat
  `text-muted-foreground`; value shown with sign and 1 decimal
  ("+4.2%") plus an optional muted label.
- Loading: three skeleton bars `h-3 w-24`, `h-7 w-20`, `h-3 w-16` in a
  `space-y-2` stack.

### 5.6 AskChat composer (floating glass pill)

- Form: `glass-panel mx-auto w-full max-w-[800px] rounded-[28px] px-4
  pb-2.5 pt-3`.
- Input: auto-growing textarea (max `160px`), `w-full resize-none
  overflow-y-auto bg-transparent text-[15px] shadow-none outline-none
  ring-0 placeholder:text-muted-foreground`, Enter sends / Shift+Enter
  newline.
- Bottom row: `mt-1 flex items-center justify-between` — web-search
  toggle pill (`flex items-center gap-1.5 rounded-full border px-3 py-1.5
  text-xs transition-colors`; ON: `border-primary/40 bg-primary/10
  text-foreground`; OFF: `border-border text-muted-foreground
  hover:text-foreground`) and a circular send button (`rounded-full`,
  icon button) showing an up-arrow, or a spinning loader while streaming.
- Thinking state: `ThinkingDots` pill (§6), not a spinner line.
- Layout around it: reading column `mx-auto w-full max-w-[800px]
  flex-col gap-10 px-4 py-8`; user bubbles `max-w-[75%] self-end
  whitespace-pre-wrap rounded-3xl bg-secondary/70 px-5 py-3 text-[15px]
  leading-relaxed`; empty state `text-3xl font-semibold tracking-tight`
  heading + `text-[15px]` muted body + suggestion chips `rounded-full
  border px-3 py-1.5 text-xs text-muted-foreground
  hover:border-foreground/30 hover:text-foreground`; chat list sidebar
  `w-[240px]` flat (no panel box), active chat `bg-secondary`.
- Answer typing motion: reveal loop every **16ms**, draining **2–14
  characters per tick** (`max(2, min(14, ceil(remaining/20)))`).

### 5.7 Calendar action card (AI-created events)

- Card: `mt-3.5 flex flex-col gap-3 rounded-2xl border border-border/70
  bg-gradient-to-br from-card via-card to-accent/20 p-4 shadow-sm
  transition-all hover:border-border`, row layout from `sm:` up.
- iOS date square: `flex h-14 w-12 shrink-0 flex-col overflow-hidden
  rounded-xl border border-black/10 bg-background text-center shadow-sm
  dark:border-white/10`; month strip `bg-[#ff3b30] py-0.5 text-[9px]
  font-bold tracking-wider text-white` (uppercase `MMM`); day `flex flex-1
  items-center justify-center text-lg font-bold tabular-nums`.
- Type pill: `inline-flex items-center gap-1 rounded-full px-2 py-0.5
  text-[11px] font-medium border` with per-type tint (§2.6) and 12px icon;
  Updated/Deleted pill: same shape, `border-border/70
  text-muted-foreground`.
- Date line: `text-[11px] text-muted-foreground` ("EEEE, MMM d · h:mm a"
  or "All Day"); title `mt-1 truncate text-sm font-semibold
  tracking-tight`; location `mt-0.5 flex items-center gap-1.5 truncate
  text-xs text-muted-foreground` with a `h-1.5 w-1.5 rounded-full
  bg-blue-500` dot; notes `mt-1 line-clamp-1 text-xs
  text-muted-foreground`.
- "View in Calendar" link: `inline-flex items-center gap-1.5 rounded-xl
  border bg-secondary/80 px-3 py-1.5 text-xs font-medium text-foreground
  transition-all hover:bg-secondary hover:text-primary` (hidden for
  deleted events).

### 5.8 Badges and pills

- Badge base: `inline-flex items-center gap-1 rounded-full border
  px-2.5 py-0.5 text-xs font-medium transition-colors`.
- Variants: `default` (primary), `secondary`, `destructive`, `outline`
  (`text-foreground`), `success` / `warning` / `info` (tinted
  `bg-…-500/15` + `text-…-700` light / `text-…-400` dark, §2.6).
- Grounded-metric chips in AI answers: `Badge variant="outline"`
  `font-normal`, label + bold tabular value + muted window in parens.
- Source-block toggles: `flex items-center gap-2 py-1 text-left text-xs
  text-muted-foreground transition-colors hover:text-foreground`, chevron
  rotates `-90deg` when collapsed (see §7).

### 5.9 Buttons

- Base: `inline-flex items-center justify-center gap-2 whitespace-nowrap
  rounded-md text-sm font-medium transition-colors focus-visible:outline-none
  focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
  focus-visible:ring-offset-background disabled:pointer-events-none
  disabled:opacity-50`, icons forced to `size-4`.
- Variants: `default` `bg-primary text-primary-foreground shadow
  hover:bg-primary/90`; `destructive` `bg-destructive
  text-destructive-foreground shadow-sm hover:bg-destructive/90`;
  `outline` `border border-input bg-background shadow-sm hover:bg-accent
  hover:text-accent-foreground`; `secondary` `bg-secondary
  text-secondary-foreground shadow-sm hover:bg-secondary/80`; `ghost`
  `hover:bg-accent hover:text-accent-foreground`; `link` `text-primary
  underline-offset-4 hover:underline`.
- Sizes: default `h-9 px-4 py-2`; `sm` `h-8 px-3 text-xs`; `lg`
  `h-10 px-8`; `icon` `h-9 w-9` (circular send buttons add `rounded-full`).

### 5.10 Skeletons (base)

- Base: `pulse-skeleton animate-pulse rounded-md bg-muted`,
  `aria-hidden="true"`.
- Inside `.glass-theme`: `animation: none` (the Tailwind pulse is
  replaced by the shimmer sweep, §6) + frosted block
  `rgba(255, 255, 255, 0.08)`.

---

## 6. Loaders

### 6.1 ThinkingDots — AI thinking indicator

- Pill: `glass-panel flex w-fit items-center gap-2.5 rounded-full px-4
  py-2 text-xs text-muted-foreground`, `role="status"` + visible label
  (e.g. "Analyzing your data…", "Searching the web and your data…").
- Dots: **3 dots**, each `h-1.5 w-1.5` (6px) `rounded-full bg-current`,
  `animate-bounce` (Tailwind default: 1s infinite bounce) with
  **staggered delays 0ms / 150ms / 300ms**.
- Used while streaming before the first token, and in place of any bare
  spinner line. Send-button spinner while streaming is instead a 16px
  `Loader2` with `animate-spin` (Tailwind default: 1s linear infinite).

### 6.2 PageLoader

- Container: `flex min-h-[320px] flex-col items-center justify-center
  gap-4`, `role="status"`, `aria-busy="true"`, default label "Loading…".
- Contents: one `ThinkingDots` pill + a `w-64 space-y-2` skeleton stack
  (`h-3 w-full`, `h-3 w-2/3`).

### 6.3 DashboardSkeleton (route-level, `app/(dashboard)/loading.tsx`)

Next.js renders this for every dashboard route segment while it loads, so
navigation never flashes a blank page. Layout mirrors Overview:

- Wrapper: `flex flex-col gap-4`, `role="status"`,
  `aria-label="Loading dashboard"`, `aria-busy="true"`.
- KPI row: `grid grid-cols-2 gap-3 md:grid-cols-4`; each cell
  `space-y-2 rounded-[24px] p-5` with skeletons `h-3 w-24`, `h-7 w-20`,
  `h-3 w-16`.
- Chart row: `grid gap-4 lg:grid-cols-3` — main card `space-y-2
  rounded-[24px] p-5 lg:col-span-2` (`h-4 w-40`, `h-44 w-full`); side card
  `space-y-2 rounded-[24px] p-5` (`h-4 w-28`, `h-10 w-full` ×2).
- Caption (deliberate — an unlabeled skeleton reads as broken):
  `text-center text-xs text-muted-foreground` — "Loading your data…".

### 6.4 Glass-shimmer skeleton animation (verbatim)

```css
@keyframes glass-shimmer {
  from { transform: translateX(-100%); }
  to   { transform: translateX(100%); }
}

.glass-theme .pulse-skeleton {
  position: relative;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  animation: none;
}

.glass-theme .pulse-skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 20%, rgba(255, 255, 255, 0.14) 50%, transparent 80%);
  animation: glass-shimmer 1.6s ease-in-out infinite;
}
```

- Sweep: a 100-degree light band (transparent → 14% white at 50% →
  transparent) sliding left to right, **1.6s, ease-in-out, infinite**.
- Outside `.glass-theme`, skeletons keep the plain Tailwind
  `animate-pulse` (default 2s opacity pulse) on `bg-muted`.
- Design rule from the source: a loading skeleton must never be mistaken
  for empty data or a finished screen — hence frosted blocks + moving
  sweep + an explicit "Loading…" label, visually distinct from static
  EmptyState cards.

---

## 7. Animations and motion

### 7.1 Keyframes defined by Pulse (verbatim)

```css
/* globals.css — skeleton light sweep */
@keyframes glass-shimmer {
  from { transform: translateX(-100%); }
  to   { transform: translateX(100%); }
}
```

```ts
// tailwind.config.ts — accordion expand/collapse (Radix height variable)
keyframes: {
  'accordion-down': {
    from: { height: '0' },
    to: { height: 'var(--radix-accordion-content-height)' },
  },
  'accordion-up': {
    from: { height: 'var(--radix-accordion-content-height)' },
    to: { height: '0' },
  },
},
animation: {
  'accordion-down': 'accordion-down 0.2s ease-out',
  'accordion-up': 'accordion-up 0.2s ease-out',
},
```

No other custom keyframes exist in Pulse: there is **no float, fade, or
ambient-glow drift animation** — the glows are static, and no custom
easing curves are defined beyond `ease-in-out` (shimmer) and `ease-out`
(accordion).

### 7.2 Framework-default motion used (Tailwind defaults, not Pulse values)

- `animate-bounce` (ThinkingDots): 1s infinite bounce, delays
  0/150/300ms.
- `animate-pulse` (skeletons outside glass): 2s infinite opacity pulse.
- `animate-spin` (send-button loader): 1s linear infinite rotation.
- `transition-colors`, `transition-opacity`, `transition-transform`,
  `transition-all`: Tailwind default 150ms duration. Used for: nav link
  hover/active, source-block toggles, mobile drawer + backdrop fade,
  chevron rotation (`-rotate-90` when collapsed), calendar card border
  hover, "View in Calendar" hover, dialog close opacity
  (`opacity-70 hover:opacity-100`).
- Active-pill change: `transition-colors` only — no slide, scale, or
  layout animation on the pill itself.
- AI answer reveal: **16ms interval**, **2–14 chars per tick**
  (`max(2, min(14, ceil(remaining / 20)))`) — this is what makes answers
  feel typed rather than popped in. On a grounding replacement, the
  reveal restarts from empty with the corrected text.
- Chat auto-scroll: instant `scrollTo({ top: scrollHeight })` on new
  messages / streaming / chat switch (no smooth-scroll easing defined).

### 7.3 Hover / focus states (summary)

- Nav (inactive): `hover:bg-white/10 hover:text-white`; active pill:
  `hover #f5f5f5` background, text stays black.
- Buttons: `hover:bg-primary/90`, `hover:bg-destructive/90`,
  `hover:bg-secondary/80`, `hover:bg-accent` per variant; ghost/icon
  buttons in shell: `hover:bg-white/10 hover:text-white`.
- Links/chips: suggestion chips `hover:border-foreground/30
  hover:text-foreground`; source toggles `hover:text-foreground`;
  calendar link `hover:bg-secondary hover:text-primary`.
- Focus everywhere: `ring-2 ring-ring ring-offset-2
  ring-offset-background`, outlines removed (`outline-none`).
- Disabled: `pointer-events-none opacity-50` (buttons), send button
  disabled on empty input or while streaming.

---

## 8. Usage notes

### 8.1 How the glass-theme scoping works

- The dashboard layout renders `<div className="dark glass-theme …">`.
  `dark` is **forced** (Tailwind `darkMode: 'class'`), so every text token
  stays light-on-dark regardless of any theme stored from before, and no
  theme toggle is rendered on the dashboard.
- `glass-theme` is the switch: `Card` / `Skeleton` / `Dialog` carry
  plain marker classes (`pulse-card`, `pulse-skeleton`, `pulse-dialog`)
  and render their **normal token styles outside** `.glass-theme`, but
  pick up the frosted overrides **inside** it (globals.css
  `.glass-theme .pulse-*` rules). The shell components themselves
  (`.glass-panel`, `.glass-pill-active`) are glass unconditionally —
  they only ever appear inside the dashboard.
- Public landing/auth pages live **outside** this layout and keep their
  own themes untouched. To scope glass to a section of another app,
  copy this exact pattern: one ancestor with `dark glass-theme`, marker
  classes on the primitives, glass overrides nested under the ancestor.
- Dashboard pages are `dynamic = 'force-dynamic'` (never prerendered
  or statically cached) — a data rule, not a style rule, but it is part
  of why navigation shows `DashboardSkeleton` instead of stale shells.

### 8.2 How to adopt in alumninetwork (copy in this order)

1. **Fonts + dark tokens first.** Load Inter (or keep alumninetwork's
   font and just pin sans/serif/mono to the same stack), then copy the
   `.dark` variable block from §2.1 and the body rules (antialiased,
   feature settings, scrollbar, focus ring). Without the tokens, none of
   the component classes resolve.
2. **Glass primitives.** Copy `.glass-panel`, `.glass-pill-active`, and
   the `.glass-theme .pulse-card` / `.pulse-dialog` / `.pulse-skeleton`
   blocks verbatim (§2.2, §6.4), plus the `glass-shimmer` keyframes.
   These are plain CSS — no Tailwind needed, except that the `hsl(var(…))`
   references assume the §2.1 variables exist.
3. **Shell.** Copy the ambient-glow layer (§2.7), the floating sidebar
   shape (28px radius panel, 264px desktop / 280px drawer, white active
   pill, ⌘K search pill), and the transparent 64px header (§5.1–5.2).
4. **Loaders.** Copy `ThinkingDots` (3 dots, 6px, 0/150/300ms delays),
   `PageLoader` (320px min-height + two skeleton bars), and the
   `DashboardSkeleton` grid (§6) — including the visible "Loading…"
   labels, which are part of the design, not decoration.
5. **Then components.** Cards (24px glass / `rounded-xl` base), dialogs
   (28px glass, `bg-black/60 backdrop-blur-md` overlay), KPI cards
   (32px glass icon pill, `text-2xl` tabular value), badges
   (`rounded-full`, §5.8), buttons (§5.9).
6. **Tailwind vs plain CSS.** If alumninetwork uses Tailwind: copy the
   `tailwind.config.ts` token mapping (colors from CSS variables,
   `--radius` scale, pinned font stacks, accordion keyframes) and use
   the utility classes as written. If it does not: the §2.2/§6.4 CSS
   blocks work standalone, and the utility classes translate directly
   (e.g. `rounded-[28px]` → `border-radius: 28px`, `bg-white/[0.06]` →
   `background: rgba(255,255,255,0.06)`, `blur-[120px]` →
   `filter: blur(120px)`).
7. **Do not copy** Pulse's Clerk auth wiring, its data hooks, or its
   component logic — this sheet is styles, shapes, and motion only.

---

## 9. Source map (auditable — every file read on the Mac)

| Mac file | What was taken from it |
|---|---|
| `apps/frontend/app/globals.css` (195 lines) | All theme tokens, body font, scrollbar, focus ring, recharts tooltip, `.glass-panel`, `.glass-theme .pulse-card/.pulse-dialog/.pulse-skeleton`, `.glass-pill-active`, `glass-shimmer` keyframes, glass-system comment |
| `apps/frontend/app/layout.tsx` (26 lines) | Inter via `next/font` (`--font-inter`, latin, `display: swap`), `body font-sans` |
| `apps/frontend/app/(dashboard)/layout.tsx` (39 lines) | Forced `dark` + `glass-theme`, ambient glows (sizes/positions/blurs), main padding + `max-w-[1400px]`, `force-dynamic` |
| `apps/frontend/components/layout/Sidebar.tsx` (184 lines) | Floating panel shape, logo mark + wordmark, ⌘K search pill, nav group + active white pill, footer, desktop 264px / mobile 280px drawer + backdrop |
| `apps/frontend/components/layout/Header.tsx` (64 lines) | Transparent bar, height/padding, title mapping, right cluster, range select size, no theme toggle |
| `apps/frontend/components/ui/loader.tsx` (82 lines) | ThinkingDots (3 dots, 6px, 0/150/300ms), PageLoader (320px + bars), DashboardSkeleton grids + caption |
| `apps/frontend/app/(dashboard)/loading.tsx` (11 lines) | Route-level loading wiring (DashboardSkeleton for all dashboard segments) |
| `apps/frontend/tailwind.config.ts` (81 lines) | `darkMode: 'class'`, token→color mapping, `--radius` scale, pinned font stacks, accordion keyframes/animations |
| `apps/frontend/components/ui/card.tsx` (50 lines) | Card base classes, header/title/description/content/footer spacing |
| `apps/frontend/components/ui/skeleton.tsx` (13 lines) | Skeleton base (`pulse-skeleton animate-pulse rounded-md bg-muted`) |
| `apps/frontend/components/ui/dialog.tsx` (79 lines) | Overlay, panel, close button, header/title/description classes |
| `apps/frontend/components/dashboard/KpiCard.tsx` (84 lines) | KPI layout, glass icon pill (32px), value/delta typography + colors, tooltip button, loading bars |
| `apps/frontend/components/ai/AskChat.tsx` (798 lines, styling parts only) | Composer shape (28px glass pill), textarea rules, toggle + send button, chat column/bubbles/empty state, calendar action card + type colors + iOS date square, source toggles, 16ms reveal loop |
| `apps/frontend/components/ui/button.tsx` (43 lines) | Button base + 6 variants + 4 sizes |
| `apps/frontend/components/ui/badge.tsx` (31 lines) | Badge base + 7 variants incl. success/warning/info |

### Not found in Pulse (omitted, not invented)

- No `success`/`warning`/`info` theme tokens in `:root`/`.dark` — only
  `destructive`; status colors come from Tailwind palette utilities.
- No h1–h6 type scale; only the per-component sizes listed in §3.2.
- No float, fade, or ambient-glow drift keyframes; glows are static.
- No custom easing curves beyond `ease-in-out` (shimmer) and `ease-out`
  (accordion); other motion uses Tailwind defaults (§7.2).
- No sidebar-width design token — widths are hardcoded (`264px` /
  `280px` / `240px` chat sidebar).
- No slide/scale animation on the active pill — `transition-colors` only.
- No other stylesheets: `globals.css` is the only `.css` file in the
  Pulse frontend (verified by search).

---

*End of sheet. Pulse files were read only; nothing in Pulse was modified.*
