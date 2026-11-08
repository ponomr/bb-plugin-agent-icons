# bb-plugin-agent-icons — Standalone Context

BB plugin that gives each agent provider its own icon and per-theme colour:
a built-in BB glyph or an SVG from a user-uploaded set. Assignments and sets
live on the BB server (`bb.storage.kv`), so every device shows the same icons.
The plugin never changes providers; disabling it restores the original icons.

## Layout

- `server.ts` — wires the store, RPC contract and CLI.
- `src/server/` — `xml.ts` (strict XML reader), `sanitize.ts` (SVG → safe
  monochrome tree), `state.ts` (`IconStore`: KV layout, limits, RPC handlers),
  `cli.ts` (`bb agent-icons list|assign|clear|import-set`).
- `src/shared/` — RPC contract, limits, SVG allowlist, built-in icon names.
- `src/app/` — provider-icon marks, the state overlay, tree rendering, and
  `settings/` (the «Иконки агентов» settings section).
- `components/`, `lib/`, `hooks/` — vendored BB UI components; import them by
  relative path and keep them unchanged.
- `icon-sets/` — curated Tabler, Lucide and Phosphor sets: theme list,
  `build.sh` that rebuilds them from pinned npm packages, licences. Not part
  of the bundle; changing it needs no release.

## Critical Rules

1. **Sanitize on the server, render only trees.** Uploaded SVG is parsed by
   `src/server/xml.ts` and reduced by `sanitize.ts` to an allowlisted tree;
   the app renders that tree with React elements and never injects markup.
   A new element or attribute goes into `src/shared/svg-allowlist.ts` with a
   test in `test/sanitize.test.ts`.
2. **One KV value stays under 256 KB.** Each icon tree has its own key; no
   record may grow with the number of icons. Limits live in
   `src/shared/limits.ts`.
3. **Built-in names are checked live.** `experimental_Icon` silently falls back
   for unknown names, so `BUILTIN_ICONS` lists only names verified on the
   current bb. Re-check after a bb upgrade.
4. **Runtime-shimmed packages stay devDependencies.** React, Radix, sonner and
   vaul are provided by the host; only zod and `@radix-ui/react-slot` ship in
   the bundle.
5. **UI text is Russian**; code, comments and docs are English.

## Commands

- Check: `npm ci && npm run typecheck && npm test && npm run build`.
- Live test from the checkout: `npm run build && bb plugin install "$PWD" --yes`,
  then open `/settings/plugins/agent-icons` or run `bb agent-icons list`.
- App tests need `// @vitest-environment jsdom` and `cleanup()` in `afterEach`
  (Vitest runs without globals).

## Host facts (bb 0.49.0, SDK 0.6.132, checked 2026-11-07)

- `app.slots.experimental_providerIcon` with `providerKind: "agent"` wins over
  the provider's `logoUrl` and built-in glyph, including Codex and Claude Code.
  A mark that renders `experimental_ProviderIcon` for the same provider gets
  the original icon, with no recursion. The mark must pass the full
  `ProviderInfo`; a partial one renders the generic Code glyph on the phone.
- Provider icons are registered once, in synchronous `definePluginApp` setup.
  The plugin therefore registers marks for bb's built-in providers plus ids
  cached in `localStorage` (`agent-icons:assigned-ids`). The overlay refreshes
  that cache from the server; a new id needs one reload per device, two on a
  device that was closed or cleared. Before the deferred app bundle loads, bb
  briefly shows the original icons.
- `experimental_useProviders()` lists every enabled provider, including the
  custom ACP agents (`acp-<id>`).
- A mutation on one device, or a CLI write, refreshes `state` queries on other
  open devices through the `icons` invalidation tag.
- RPC bodies of 4 MB pass; a KV value over 262 144 bytes is rejected
  ("Store large data in storage.database() instead").
- `settingsSection` without `experimental_page` renders on the plugin page on
  desktop and phone. A section with `experimental_page: "mobile"` does not
  appear under Settings → Mobile, so the plugin has one section.
- `Wrench` and `Feather` are not drawn by `experimental_Icon`; they are
  excluded from `BUILTIN_ICONS`.
- XML parser: our own dependency-free reader (`src/server/xml.ts`). It rejects
  DOCTYPE and custom entities, ignores text and CDATA, and caps depth (32) and
  node count (2000). No third-party parser met the "pure JS, no DOM, no native
  code" bar with entity expansion fully off.

## Repository and release contract

- Ownership: public (`ponomr/bb-plugin-agent-icons`), MIT. Not yet on the
  BB marketplace; publishing needs the owner's approval.
- Checks: the command above; there is no CI yet.
- Release: bump `version` in `package.json` and `package-lock.json` in the PR,
  merge it, tag the merge commit `vX.Y.Z` and push the tag.
- Deploy: on the BB host, update the checkout to the tag and run
  `npm ci && npm run build && bb plugin install "$PWD" --yes` there;
  `bb plugin list` must show the new version as `running`.
- Recovery: check out the previous tag and reinstall. Data stays in the
  plugin's KV storage and survives reinstalling; `bb plugin disable
  agent-icons` restores every original icon at once.
