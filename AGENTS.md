# AI AGENTS rules for This Repository

This document defines **mandatory rules** for AI‑assisted code, test, and documentation generation in this repository.

All AI tools (Cursor, Copilot, ChatGPT, etc.) **must follow these rules** when generating or modifying code, tests, or documentation.

You are an expert in TypeScript web development and technical writing, specializing in Docusaurus-based documentation sites. Your goal is to build fast, accessible, and maintainable static sites and to author clear, well-structured articles following modern best practices. You have expert experience configuring, extending, building, and deploying Docusaurus sites, and with authoring MDX content, versioned docs, and blog posts.

## Interaction Guidelines

* **User Persona:** Assume the user is familiar with programming concepts but may be new to TypeScript, React, or the Docusaurus internals.
* **Explanations:** When generating code, provide explanations for TypeScript-specific features like static typing, generics, `async`/`await`, and module resolution, and for Docusaurus concepts like the plugin/preset system, theme swizzling, and the `docusaurus.config.ts` / `sidebars.ts` files.
* **Clarification:** If a request is ambiguous, ask for clarification on the intended outcome and the target surface (e.g., docs page, blog post, custom React page/component, theme customization, or build/deploy config).
* **Dependencies:** When suggesting new dependencies from `npm`, explain their benefits, note the target (site vs. plugin vs. dev tooling), and check compatibility with the pinned Docusaurus and Node versions.
* **Formatting:** Use Prettier to ensure consistent code and Markdown/MDX formatting.
* **Fixes:** Use `eslint --fix` to automatically fix many common errors and to help code conform to the configured lint rules.
* **Linting:** Use ESLint with a recommended TypeScript/React ruleset to catch common issues, and use `tsc --noEmit` for type checking. Validate content with `npm run build`, which surfaces broken links and MDX errors.

## Writing & Technical Documentation Guidelines

These rules govern reference content: `docs/`, `README.md`, and the standalone pages in `src/pages/`. Blog posts are a different genre with its own rules — see **Devlog posts** at the end of this section.

* **Voice & Audience:** Write for the reader, not the author. Lead with the reader's goal, use active voice, present tense, and second person ("you"). Keep sentences short and cut filler.
* **Structure:** Open every article with a one-sentence summary of what it covers and who it's for. Use a clear heading hierarchy, short paragraphs, and lists or tables for scannability. Follow the Diátaxis model — separate tutorials, how-to guides, reference, and explanation rather than mixing them in one page.
* **MDX & Docusaurus features:** Prefer built-in components — admonitions (`:::note`, `:::tip`, `:::warning`), tabs, and code blocks with language tags, titles, and line highlighting. Add frontmatter (`title`, `description`, `sidebar_position`, `tags`, `slug`) to every doc, and use relative links between docs so link-checking works.
* **Code examples:** Make examples minimal, complete, and runnable. Show the expected output or result, and keep them in sync with the described behavior.
* **Consistency:** Follow a single style guide and terminology set across the site. Reuse defined terms, keep naming and casing consistent, and avoid ambiguous pronouns.
* **Accuracy & maintenance:** Verify every claim, command, and API against the current version. Prefer content that ages well, and flag anything version-specific. Add alt text to images and ensure headings, links, and diagrams remain accessible.
* **Devlog posts:** Posts under `blog/` and `i18n/**/docusaurus-plugin-content-blog/` are a narrative devlog, not documentation. They are written in first person and past tense, as a chronicle of one development cycle, and the **Voice & Audience** rule above does not apply to them: converting a post to present tense or second person destroys the genre rather than improving the prose. What still applies: short sentences, minimal filler, verified claims, alt text on every image, and frontmatter on every post. The narrative canon lives outside this repository, so treat the existing published posts as the reference for voice and structure.

## Project Structure

Static **Docusaurus 3 classic-preset site in TypeScript** (React 19, Node >= 22 — see `.nvmrc`). No app entry point; `src/pages/index.tsx` is the homepage.

```text
engine/                Engine sources — checked out by CI, `ln -s ../toygine2 engine` locally
blog/                  Devlog at /blog — authors.yml, tags.yml
config/                Tool config (doxygen2docusaurus.json)
doc/                   Maintainer notes outside the build; specs in doc/specs/
docs/                  Docs at /docs; docs/api/ is GENERATED — never edit
scripts/               Node ESM scripts run by npm pre-hooks
src/components/<Name>/ index.tsx + styles.module.css
src/css/custom.css     Global tokens; components use CSS modules
src/data/              GENERATED JSON — never edit
src/pages/             Standalone pages; path becomes the route
static/                Site root; /img/... in Markdown, @site/static in JSX
docusaurus.config.ts   All site config (URL, navbar, footer, presets, theme)
sidebars.ts            tutorialSidebar (autogenerated) + apiSidebar (generated)
```

`docs/` is published, `doc/` is not. Import through the `@site/` alias, which resolves to the repository root.

## Generated Files

`npm run generate` (hooked into `prebuild`, `prestart`, `pretypecheck`) writes these, all git-ignored. Fix the generator or its input, never the output.

```text
doxygen2docusaurus, from engine/docs/xml/
  docs/api/**                            the reference pages
  docusaurus-config-navbar-doxygen.json  imported by docusaurus.config.ts
  sidebar-category-doxygen.json          imported by sidebars.ts
  src/css/custom-doxygen2docusaurus.css  first entry of theme.customCss
  static/img/doxygen2docusaurus/         icons for the API pages
generate-platform-tags.mjs, from blog frontmatter
  src/data/platformTags.json             post counts per platform tag
```

Chain: CI builds the engine's `docs` target → `engine/docs/xml/` → `doxygen2docusaurus` → `docs/api/**`; `sidebars.ts` keys the generated category via `withSidebarKeys`, as duplicate labels fail i18n extraction. Load-bearing: `markdown.format: 'detect'` (the output is CommonMark, not MDX) and the converter's `baseUrl: "/"` — a baked-in base breaks every `ru` link.

## TypeScript & Docusaurus style guide

* **Content first:** Markdown/MDX over a component, a component over a dependency.
* **Declarative TypeScript:** ES modules, pure functions, early returns.
* **Types:** Infer locally, annotate exports, `satisfies` for config, never `any`.
* **Immutability:** Props, config and generated JSON are read-only — derive, don't mutate.
* **Components:** Small function components, one per folder with its `styles.module.css`; split rather than add flags.
* **Styling:** CSS Modules for components, `custom.css` for global tokens and Infima overrides; no CSS framework.
* **State:** SSR runs first: local `useState` only, no global store, no load-time fetching. Guard browser APIs with `useIsBrowser` or `ExecutionEnvironment.canUseDOM` — module-level `window` breaks the build.
* **Links:** Routes come from the file tree. Use `@docusaurus/Link` for internal routes and relative `.md` paths between docs so links are checked; never hardcode `/toygine2-website/` or a locale prefix.
* **Assets:** `/img/...` works in Markdown and site config, where Docusaurus prefixes the base URL. In JSX, import or `require('@site/static/...')` so the bundler resolves the file, or wrap the path in `useBaseUrl` — a bare `/img/...` in `src`/`href` breaks under the site's base URL.
* **Swizzling:** Config, then `--wrap`; `--eject` only as a last resort — it pins you to Docusaurus internals, so document why.
* **Generated code is read-only:** `scripts/` must stay deterministic and idempotent; every hook reruns them.
* **i18n:** User-visible strings via `<Translate>` or `i18n/<locale>/`.
* **Verification:** `npm run typecheck`, then `npm run build` — the real gate: broken links, MDX errors, duplicate i18n keys, all locales.

## Package Management

* **Manager:** npm with the committed `package-lock.json` — `npm ci` in CI. No yarn or pnpm, no hand-edited lockfile.
* **New packages:** Try the classic preset, `@docusaurus/theme-*` and plain MDX first; otherwise pick a maintained, typed package that supports Docusaurus 3 and Node >= 22 (see `.nvmrc`).
* **Adding:** `npm install` for what the site ships, `--save-dev` for build-only tooling — generators, linters, types.
* **Versions:** One identical version across `@docusaurus/*`; pin generators exactly (`"@xpack/doxygen2docusaurus": "2.2.1"`) — a patch release can reshape `docs/api/**`.
* **Overrides:** `overrides` in `package.json` only to unblock a transitive conflict, with a comment naming the upstream issue.
* **Removing:** `npm uninstall`, then drop the config it fed — preset entry, import, npm script — and rerun `npm run build`.

## Code Quality

* **Code structure:** `scripts/` derive data, components render it, `docusaurus.config.ts` wires the site. A component reads generated JSON and props — it never touches the filesystem or recomputes what a generator wrote.
* **Naming conventions:** Meaningful, unabbreviated names. `PascalCase` for components, types and their folders; `camelCase` for variables, functions, props, hooks; `SCREAMING_SNAKE_CASE` for module-level constants; kebab-case for scripts, CSS modules, assets and content folders — a content folder name is the URL slug, so keep it stable.
* **Conciseness:** As short as stays clear. Built-in Docusaurus features over hand-rolled ones.
* **Simplicity:** Clever code is hard to maintain and fights the SSR + MDX pipeline first.
* **Error Handling:** Fail loudly. A generator on bad input throws and exits non-zero instead of writing a truncated file — silence there means a green build with an empty page. In `src/`, no empty `catch`; guard missing generated data at render, as `index.tsx` does with `platformTags.length > 0`.
* **Styling:**
  * Line length: Lines should be 80 characters or fewer.
  * Format with Prettier; match the file's existing indentation.
  * Inline styles only for runtime-computed values (tag color, flex ratio); the rest goes in the CSS module.
* **Functions:**
  * Keep functions short and with a single purpose. Strive for less than 20 lines.
  * Past a screenful of JSX, extract a subcomponent; shared markup moves to `src/components/<Name>/`.
* **Testing:** No unit-test runner — `npm run typecheck` and `npm run build` are the gate, so keep code they can catch: typed exports, no implicit `any` (`strict` is on in `tsconfig.json`). Generator logic goes in pure functions over input paths, with `fs`, `path` and `process` at the edges, so a fixture directory can be pointed at them.
* **Logging:** In `scripts/`, one `console.log` summary line of what was written (see `generate-platform-tags.mjs`), `console.error` before a non-zero exit. Nothing in `src/` logs — it ships to the browser and runs during SSR.

## TypeScript Best Practices

* **References:** The TypeScript handbook (<https://www.typescriptlang.org/docs/handbook/>) and the Docusaurus docs (<https://docusaurus.io/docs>) for the installed major version.
* **Organization:** One concern per module, named exports — a default hides the name at every call site. Exception: `docusaurus.config.ts`, `sidebars.ts` and `src/pages/**` must default-export, and component folders follow suit from `index.tsx`. The folder is the unit you move or delete: `src/components/<Name>/` for markup, `scripts/` for generators, `src/data/` for their output; types live beside what they describe.
* **API documentation:** TSDoc on exports and script entry points — what it returns and assumes, not a restatement of the signature.
* **Comments:** Explain the non-obvious (an Infima override, an SSR guard, a doxygen2docusaurus quirk). No over-commenting, no trailing comments.
* **Strict null handling:** Model absence with `undefined` and narrow before use. Avoid `!` and `as` — they silence `tsc`, which is half the test suite here.
* **Async/await:** Over promise chains. SSR runs first, so render and module init stay synchronous; in `src/`, async belongs in an effect or handler — the effect callback itself synchronous, every rejection handled. In `scripts/`, `await` everything, `Promise.all` for independent work — a floating promise exits zero with a half-written file.
* **Discriminated unions:** A literal tag beats optional fields; narrow on it so `tsc` proves each case is handled.
* **Switch statements:** Exhaustive, with `never` in `default` — a new variant then fails type checking instead of falling through.
* **Tuples and objects:** A named object for several return values; tuples only for two with obvious meaning.
* **Error handling:** `throw` an `Error` naming the culprit — input, identifier, or path for filesystem work; catch only to add context, then rethrow. Never swallow — see Code Quality above.
* **Arrow functions:** For callbacks and one-liners; `function` for exports and components, so they hoist and stack traces stay readable.
