# Agent Icons for BB

A [BB](https://getbb.app) plugin that gives each agent provider its own icon
and colour. Pick a built-in BB glyph or upload your own SVG icons in named
sets. Assignments are stored on the BB server, so the Mac and the phone show
the same icons.

## What it does

- The plugin's settings page (Settings → Plugins → Agent Icons, section
  «Иконки агентов») lists every provider with its current icon. For each one
  you choose an icon and, separately for the light and dark theme, a colour.
  A theme without a colour keeps the provider's original colour.
- Codex and Claude Code logos can be replaced too. **Сбросить** returns the
  original icon.
- Assignments for providers that are not in BB right now stay listed under
  «Нет в bb», so you can reset them.
- **Icon sets**: upload SVG files into a named set, rename sets and icons,
  delete them. Before deleting, the page names the providers that will get
  their original icon back.
- Disabling the plugin restores every original icon. Providers themselves are
  never changed.

## Ready-made sets

Curated Tabler, Lucide and Phosphor sets (about 170 icons each) and the
script that rebuilds them are in [icon-sets](icon-sets/README.md).

## Uploaded SVG

Every file is cleaned on the server before it is stored. Scripts, event
handlers, styles, links, images, `foreignObject`, `use` and external
references are removed; DOCTYPE and entities are rejected. Icons become
monochrome: they take the colour you set, or the provider's colour.

Limits: SVG only, up to 32 KB per file, 200 icons per set, 2 MB for all sets.
A file with nothing left after cleaning is rejected with a reason.

## Reloads and startup

- Changing the icon or colour of a provider that already has a custom icon
  applies at once on every open device.
- A provider that gets a custom icon for the first time shows it after one
  reload of BB on each device. A device that was closed during the change, or
  whose site data was cleared, may need two reloads. The settings page says so.
- While BB starts, the original icons show for a moment until the plugin
  loads.
- If another plugin also replaces a provider's icon, BB keeps whichever
  registered first.

## CLI

```sh
bb agent-icons list                       # providers, assignments, set icon names, builtins
bb agent-icons assign acp-beta builtin:Calendar --light "#BC5215" --dark "#DA702C"
bb agent-icons assign acp-alpha "Team/Alpha"  # <set>/<icon>, by name or id
bb agent-icons clear acp-beta
bb agent-icons import-set Team ./icons        # a folder of .svg files
```

`import-set` adds to an existing set with the same name. A file whose name
matches an icon already in the set replaces that icon and keeps its
assignments.

## Install

On the BB host:

```sh
git clone https://github.com/ponomr/bb-plugin-agent-icons.git
cd bb-plugin-agent-icons
npm ci
npm run build
bb plugin install "$PWD" --yes
```

Requires BB 0.49.0 or later, below 1.0, and Plugin SDK 0.6.132 or later,
below 0.7.

## Development

```sh
npm ci
npm run typecheck
npm test
npm run build
```

See [AGENTS.md](AGENTS.md) for the layout, host facts and release steps.

## Licence

MIT © 2026 Alex Ponomar. See [LICENSE](LICENSE).
