# Repository Guidelines

## Project Structure & Module Organization
The Vite + React + TypeScript entrypoint lives in `src/main.tsx`, mounting the root `App` component. Feature logic sits in `src/components`, domain helpers in `src/utils`, API integrations under `src/api`, and Gemini orchestration in `src/services`. Shared typing contracts belong in `src/types`. Static boot assets (`index.html`, Tailwind configuration, Vite config) remain in the repository root, while production builds emit to `dist/` (keep it out of commits).

## Build, Test, and Development Commands
Run `npm install` once to hydrate dependencies. Use `npm run dev` for the hot-reloading development server (`http://localhost:5173`). `npm run build` compiles an optimized bundle to `dist/`. `npm run preview` serves that bundle locally for smoke tests. `npm run lint` enforces the ESLint + TypeScript ruleset; run it before every PR to avoid surprise CI failures.

## Coding Style & Naming Conventions
Stick to the ESLint defaults shipped in `eslint.config.js`, which extends `@eslint/js` and `typescript-eslint`. Use two-space indentation, TypeScript types instead of `any`, and functional React components with Hooks. Name components and context providers in PascalCase (`RecordingHistoryList`), hooks with a `use` prefix, and utility helpers in camelCase. Favor Tailwind utility classes in JSX; reserve `src/index.css` for global tweaks. Persist user data keys under the existing `voicescript-*` namespace to avoid localStorage clashes.

## Testing Guidelines
Automated tests are not yet wired in, so validate changes with `npm run lint` plus manual walks through recording, transcription, AI improvement, and PDF export flows. When adding a test harness, prefer Vitest + React Testing Library and place specs alongside components (`src/components/TranscriptionPanel.test.tsx`) to keep context close to usage.

## Commit & Pull Request Guidelines
Recent history mixes Conventional Commit prefixes (`feat:`, `fix:`) with plain descriptions; default to the prefixed form for clarity (e.g., `feat: add waveform smoothing`). Each PR should summarize the change, list manual verification steps, link related issues, and include screenshots or transcripts when UI or audio behavior shifts. Mention any API key or rate-limit considerations so reviewers can reproduce the scenario confidently.

## Configuration & Secrets
Create a local `.env` with `REACT_APP_GEMINI_API_KEY`, `REACT_APP_GEMINI_MODEL`, and `REACT_APP_API_RATE_LIMIT`. Never commit API keys; instead document expected values in the PR body and scrub logs before sharing recordings or transcripts.
