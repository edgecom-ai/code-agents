# Frontend stack — the selections made in the panel project

The kit's guides are stack-neutral, but its hooks and a few skills assume the
stack below. These are the choices the panel monorepo settled on after running
agents against it for a while; a new frontend repo starts from this list and
deviates only with a reason written down. Each row names the choice, and where
the panel repo recorded one, the reason.

## Placeholder answers

The `{{PLACEHOLDER}}` table in [`adoption-checklist.md`](adoption-checklist.md)
is answered for this stack as follows. Copy these in unless the new repo has a
reason to differ.

| Placeholder                                   | Value                                                        |
| --------------------------------------------- | ------------------------------------------------------------ |
| `{{PM}}`                                      | `pnpm` (11+)                                                 |
| `{{BUILD_TOOL}}`                              | Turborepo 2                                                  |
| `{{LANGUAGE}}` / `{{FRAMEWORK}}`              | TypeScript 6 (strict) / React 19 on Vite 8, TanStack Router  |
| `{{TSCONFIG}}`                                | `@repo/config/tsconfig.base.json`                            |
| `{{INSTALL_CMD}}`                             | `pnpm install`                                               |
| `{{DEV_CMD}}`                                 | `pnpm dev`                                                   |
| `{{SCOPE_CMD}}`                               | `pnpm --filter <package> <task>`                             |
| `{{AUTOFIX_CMD}}`                             | `pnpm --filter <package> exec eslint . --fix`                |
| `{{FORMAT_CMD}}`                              | `pnpm format`                                                |
| `{{GATE_CMD}}`                                | `pnpm check && pnpm lint && pnpm format:check && pnpm build` |
| `{{FILE_LENGTH_CMD}}`                         | `pnpm check:file-length`                                     |
| `{{FILE_LINES}}` / `{{FILE_CAP}}`             | 350 / 500                                                    |
| `{{FOLDER_FILES}}`                            | 8                                                            |
| `{{DISABLE_PRAGMAS}}`                         | `eslint-disable`, `@ts-ignore`, `@ts-nocheck`                |
| `{{GENERATED_GLOB}}`                          | `**/routeTree.gen.ts`, `packages/api/src/generated/**`       |
| `{{COMMIT_LINTER}}` / `{{HOOK_RUNNER}}`       | commitlint (`config-conventional`) / lefthook                |
| `{{SHARED_PREFIX}}`                           | `@repo/`                                                     |
| `{{AREA_N_PATH}}`                             | `apps/`, `packages/`                                         |
| `{{EXTERNAL_SOURCE}}` / `{{ENTRY_POINT_URL}}` | the design system / `https://design.edgecom.ai/llms.txt`     |
| `{{HUMAN_DOC}}`                               | `README.md`                                                  |
| `{{SKILLS_DIR}}` / `{{AGENT_HOOKS_DIR}}`      | `.claude/skills/` / `scripts/agent-hooks/`                   |

## Workspace and task running

- **pnpm 11 workspaces**, `apps/*` and `packages/*`. The `catalog:` block in
  `pnpm-workspace.yaml` is the single source of truth for every version shared
  across packages; a manifest references it as `"react": "catalog:"` and never
  pins its own copy.
- **Dependency build scripts are denied by default.** pnpm 11 fails the install
  on any postinstall script without an explicit `allowBuilds` entry; each dep
  gets `true` only when its native step is actually needed (esbuild is the
  standing example). The `dependency-policy` skill owns the judgment.
- **Security floors live in `overrides`** as open-ended `>=` ranges for
  transitive deps, dropped once the tree resolves above them on its own.
- **Turborepo 2** runs every task from the root: `dev`, `build`, `preview`,
  `lint`, `check`, `test`. `build` depends on `^build` and caches `dist/**`;
  `dev` and `preview` are persistent and uncached.
- **Node 26+, ESM everywhere** (`"type": "module"` at the root). Repo scripts
  are plain `.mjs` tested with `node --test`, so the tooling has no build step.

## Language

- **TypeScript 6, strict**, from a shared base in `packages/config`:
  `moduleResolution: bundler`, `verbatimModuleSyntax`, `noEmit`,
  `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
  `noUncheckedSideEffectImports`, `allowImportingTsExtensions`.
- **No `any`; type props explicitly rather than using `FC`.**
- **Shared packages ship raw `.tsx` source** with no build step and are
  imported as `@repo/<name>`. They stay framework-clean and side-effect-free so
  any app's Vite build can consume them directly.

## App framework

- **React 19 on Vite 8** via `@vitejs/plugin-react`. Every app is a
  **client-only SPA, no SSR**, owning its own `vite.config`, `src/routes/`, and
  `src/integrations/` (cross-cutting providers).
- **TanStack Router** with file-based routes. `@tanstack/router-plugin`
  generates `routeTree.gen.ts`, which is lint-ignored and never hand-edited.
- **TanStack Query** for server state, **TanStack Virtual** for long lists, and
  the TanStack devtools (`@tanstack/react-devtools`, router and query devtools)
  wired through `@tanstack/devtools-vite`.
- **Jotai** for the little shared client state there is (theme, color scheme).
- **PWA** via `vite-plugin-pwa` and `workbox-window`, packaged once in
  `packages/pwa` with `@vite-pwa/assets-generator` for icons.
- **Feature-based layout, not role-based.** A route owns its components,
  state, hooks, and logic next to the route file. App-level `src/components/`
  and `src/state/` hold only what several features share; app-agnostic UI
  graduates to `packages/ui`. No barrel or `index` files.

## UI and styling

- **Tailwind CSS 4** through `@tailwindcss/vite`, plus `tw-animate-css`.
- **`cn()` = `clsx` + `tailwind-merge`**, with `class-variance-authority` for
  variant props.
- **`@base-ui/react`** as the headless primitive layer under `packages/ui`,
  with `lucide-react` icons, `sonner` toasts, `cmdk`, `react-day-picker`,
  `input-otp`, and `@stepperize/react`.
- **Highcharts** (`highcharts-react-official`) for every chart, wrapped once in
  `packages/charts`.
- **Storybook 10** (`@storybook/tanstack-react` framework, a11y and docs
  addons, Chromatic) in its own `packages/storybook`.
- **The design system is upstream**, not in the repo. Agents read
  `design.edgecom.ai/llms.txt` first; it routes to the design language, the
  consumer guide, install mechanics, and the component catalog, and it outranks
  any restatement in a guide. The `ui-drift-check` skill reviews against it.

## Auth, API, and integrations

- **Auth0** via `@auth0/auth0-react`, packaged once in `packages/auth`
  (provider, route guard, token bridge). Role and permission checks live in
  `packages/access`.
- **Typed fetch clients are generated, never written.** `packages/api` pulls
  each module's OpenAPI spec from Apidog and runs `openapi-generator-cli`
  (`typescript-fetch`, so it needs a JRE) into `src/generated/<module>/`. The
  one hand-maintained file is `apidog.config.json`; the output is lint-ignored
  and regenerated with `pnpm generate:api`.
- **PostHog** for product analytics and **i18next** for translations, both in
  the customer-facing app only.

## Quality gate

- **ESLint 10 flat config** from `packages/config`: `eslint-config-xo` as the
  base, `typescript-eslint` recommended, `eslint-config-prettier`,
  `eslint-plugin-import-x` with node and TypeScript resolvers, and
  `simple-import-sort`.
- **Directive comments are lint errors.** `@eslint-community/eslint-comments/no-use`
  with an empty allow list bans `eslint-disable`; `@ts-ignore` and
  `@ts-nocheck` are already errors under typescript-eslint. The gate is passed
  by fixing the code, never by silencing the rule.
- **Prettier 3** owns formatting; style rules are not written down anywhere
  else.
- **Vitest 5** for package and app tests; `node --test` for repo scripts.
- **File-length ceiling:** 500 lines hard, enforced by `check-file-length.mjs`
  against a reviewed `.file-length-exceptions.json`; 350 lines is the target
  held by review.

## Git workflow

- **lefthook** runs the hooks. Pre-commit runs Prettier and `eslint --fix` on
  staged files (route trees and the `AGENTS.md` symlink excluded). Commit-msg
  runs commitlint. Pre-push rejects merge commits, runs the file-length check
  on `HEAD`, and then the same gate an agent owes on every handoff.
- **Conventional Commits** via `@commitlint/config-conventional`, scoped to the
  narrowest accurate feature (the `commit-message` skill).
- **Rebase-only.** A `pre-merge-commit` hook refuses merge commits locally and
  a GitHub linear-history ruleset backstops it. A rejected push is fixed with
  `git rebase origin/main`, never `--no-verify` or `--force`; the agent hooks
  in `enforcement/agent-hooks/` deny those flags at the tool call.

## Monorepo shape in the panel repo

For orientation when reading the kit's examples: two apps (`portal`, the
customer SPA on `:3010`, and `captain`, the internal one on `:3020`) and shared
packages under `@repo/`: `ui`, `theme`, `shell`, `charts`, `table`, `inputs`,
`misc`, `auth`, `access`, `api`, `demand-response`, `pwa`, `build-output`,
`config`, and `storybook`.
