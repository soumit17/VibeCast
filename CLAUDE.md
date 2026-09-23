# Soundtrack Platform

This directory (`music-app/`) is the project root. All work for this app happens here.

## Build spec

**[soundtrack-platform-spec.md](soundtrack-platform-spec.md) is the authoritative build spec.** Read it before making architecture, data-model, API, or scope decisions — it defines the tech stack, data model, API surface, frontend pages, the DJ engine LLM prompt, the Deezer playback integration, and what must be real vs. simulated for the hackathon build. Don't re-derive decisions it already makes; treat its "real vs simulated" table (§3) and non-goals (§11) as binding unless the user overrides them.

One line to keep in view: **one platform, two products, one shared taste graph** — a Personal app (solo ambient soundtrack from mic/cam/GPS) and a Venue platform (B2B room queue + crowd-reading DJ). See spec §1.

**Visual direction (spec §1):** moody, high-contrast, club-poster aesthetic — dark backgrounds, bold type, a punchy accent color tied to live energy/mood. Explicitly *not* a generic light-mode SaaS dashboard look. Keep this in mind when a design/taste skill fires — several installed ones lean toward different aesthetics (see below), and the ones that best match this brief are `high-end-visual-design`, `gpt-taste`, and `industrial-brutalist-ui` (dashboards especially); `minimalist-ui`'s warm-pastel monochrome direction runs counter to the brief unless the user asks for a lighter treatment somewhere.

## Available skills

Installed at user level, so they trigger automatically wherever relevant:

- **Animation/motion:** `animate`, `animation-vocabulary`, `apple-design`, `mobile-native`, `improve-animations`, `find-animation-opportunities`, `review-animations`, `ask-sonner`, `emil-design-eng` (from emilkowalski/skills — `animate-expo`/`write-swift` are for native Expo/Swift and not relevant here since this is a browser app)
- **Design polish/audit:** `impeccable` (`/impeccable polish`, `/impeccable audit`, `/impeccable critique`, etc.)
- **Taste/visual direction:** `high-end-visual-design`, `gpt-taste`, `industrial-brutalist-ui`, `minimalist-ui`, `design-taste-frontend` (v2) / `design-taste-frontend-v1`, `redesign-existing-projects`, `stitch-design-taste`, `brandkit`, `image-to-code`, `imagegen-frontend-web`, `imagegen-frontend-mobile`, `full-output-enforcement`
