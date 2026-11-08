/**
 * Names that `experimental_Icon` draws in bb 0.49.0. Other names silently
 * fall back, so assignments are limited to this list.
 */
export const BUILTIN_ICONS = [
  "Bot",
  "Calendar",
  "FileText",
  "Brain",
  "Star",
  "Cloud",
  "Globe",
  "Folder",
  "Mail",
  "MessageSquare",
  "Mic",
  "Palette",
  "Lock",
  "UserRound",
  "Bug",
  "Code",
  "Terminal",
  "Clock",
  "Beaker",
  "Target",
  "Coffee",
  "Eye",
  "Search",
  "Settings",
  "SlidersHorizontal",
  "Layers",
  "Puzzle",
  "Archive",
  "ListTodo",
  "CircleCheck",
  "Home",
  "Info",
  "Circle",
  "Square",
  "Keyboard",
  "Laptop",
  "Smartphone",
  "Link",
  "Paperclip",
] as const;

export type BuiltinIconName = (typeof BUILTIN_ICONS)[number];

const BUILTIN_SET: ReadonlySet<string> = new Set(BUILTIN_ICONS);

export function isBuiltinIcon(name: string): name is BuiltinIconName {
  return BUILTIN_SET.has(name);
}

/** Providers bb ships; their marks are registered even before any assignment. */
export const BUILTIN_PROVIDER_IDS = ["codex", "claude-code", "acp-cursor", "acp-hermes-agent"] as const;
