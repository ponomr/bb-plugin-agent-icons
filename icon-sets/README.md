# Curated icon sets

Three sets for agent icons: Tabler, Lucide and Phosphor. Each holds about 170
icons, one per theme in [concepts.txt](concepts.txt): people and roles, AI,
tools, documents, time, communication, code, money, security, travel, health,
media, nature, animals. All icons are 24 px outline glyphs.

Licences: Tabler MIT, Lucide ISC, Phosphor MIT — texts in [licenses/](licenses/).
Pinned package versions are in [build.sh](build.sh).

Whole libraries do not fit: a set holds 200 icons and all sets together 2 MB
(about 3000 icons).

## Rebuild and import

```sh
icon-sets/build.sh /tmp/icon-sets
bb agent-icons import-set Tabler /tmp/icon-sets/tabler
bb agent-icons import-set Lucide /tmp/icon-sets/lucide
bb agent-icons import-set Phosphor /tmp/icon-sets/phosphor
```

`build.sh` downloads the pinned packages with `npm pack` into a temporary
folder, copies the picked files and names themes a library has no icon for.
Importing into an existing set replaces icons with the same name and keeps
assignments, but never removes icons. After a version bump or an edit to
`concepts.txt`, icons whose names are no longer picked stay in the set and
count toward the 200 limit. For a set that matches the list exactly, import
under a new name, reassign the agents, then delete the old set.

To add a theme, add a line to `concepts.txt`. A line lists alternative names;
each library takes the first name it has. Keep the list under 200 lines.
