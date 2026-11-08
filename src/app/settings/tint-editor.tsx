import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import type { Tint } from "../../shared/contract";
import { useStrings } from "../strings";

const HEX = /^#[0-9a-f]{6}$/i;

/** Background and default ink of each theme's preview. */
const THEMES = {
  light: { background: "#fffcf0", ink: "#403e3c", scheme: "light" },
  dark: { background: "#100f0f", ink: "#cecdc3", scheme: "dark" },
} as const;

type Theme = keyof typeof THEMES;

function ThemeColor({
  theme,
  value,
  onChange,
  preview,
}: {
  theme: Theme;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  preview: ReactNode;
}) {
  const s = useStrings();
  const meta = THEMES[theme];
  const label = theme === "light" ? s.lightTheme : s.darkTheme;
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);
  const invalid = text !== "" && !HEX.test(text);

  const commit = () => {
    if (text === "") onChange(undefined);
    else if (HEX.test(text)) onChange(text.toLowerCase());
  };

  return (
    <fieldset className="flex min-w-0 flex-1 flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div
        data-testid={`preview-${theme}`}
        className="flex h-14 items-center justify-center rounded-md border border-border"
        style={{ background: meta.background, color: meta.ink, colorScheme: meta.scheme }}
      >
        {preview}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={s.paletteOf(label)}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
          value={value ?? meta.ink}
          onChange={(event) => onChange(event.target.value.toLowerCase())}
        />
        <Input
          aria-label={s.colorOf(label)}
          aria-invalid={invalid || undefined}
          placeholder="#rrggbb"
          value={text}
          maxLength={7}
          onChange={(event) => setText(event.target.value.trim())}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
        />
      </div>
      {invalid ? <p className="text-xs text-destructive">{s.colorFormat}</p> : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        aria-pressed={value === undefined}
        onClick={() => onChange(undefined)}
      >
        {s.originalColor}
      </Button>
    </fieldset>
  );
}

export function TintEditor({
  tint,
  onChange,
  renderPreview,
}: {
  tint: Tint;
  onChange: (tint: Tint) => void;
  renderPreview: () => ReactNode;
}) {
  const set = (theme: Theme) => (value: string | undefined) => {
    const next: Tint = { ...tint };
    if (value === undefined) delete next[theme];
    else next[theme] = value;
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <ThemeColor theme="light" value={tint.light} onChange={set("light")} preview={renderPreview()} />
      <ThemeColor theme="dark" value={tint.dark} onChange={set("dark")} preview={renderPreview()} />
    </div>
  );
}
