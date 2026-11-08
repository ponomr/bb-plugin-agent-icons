/**
 * Turns uploaded SVG text into a safe monochrome tree or a typed refusal with
 * a reason, in the configured language, that the settings page and CLI show as is.
 */
import { DEFAULT_LANGUAGE, tooLargeReason, type Language } from "../shared/i18n";
import { MAX_FILE_BYTES } from "../shared/limits";
import {
  countShapes,
  isAllowedAttribute,
  isAllowedElement,
  isSafeAttributeValue,
  PAINT_ATTRIBUTES,
  treeBytes,
  URL_FUNCTION,
  utf8Bytes,
  validateTree,
  type SvgNode,
} from "../shared/svg-allowlist";
import { strings } from "./strings";
import { parseXml, XmlParseError, type XmlElement } from "./xml";

export type SanitizeFailureCode = "too_large" | "parse_error" | "not_svg" | "no_viewbox" | "no_shapes";

export type SanitizeResult =
  | { ok: true; tree: SvgNode; bytes: number }
  | { ok: false; code: SanitizeFailureCode; reason: string };

/** `none` stays, `transparent` is `none`, references are dropped, any colour is `currentColor`. */
function normalizePaint(value: string): string | null {
  const v = value.trim();
  if (v === "" || URL_FUNCTION.test(v)) return null;
  if (v === "none" || v.toLowerCase() === "transparent") return "none";
  if (/^(inherit|initial|unset|revert|context-fill|context-stroke)$/i.test(v)) return null;
  return "currentColor";
}

function convert(element: XmlElement): SvgNode | null {
  if (!isAllowedElement(element.name)) return null;
  const attrs: Record<string, string> = {};
  for (const [name, raw] of element.attrs) {
    if (!isAllowedAttribute(name)) continue;
    const value = PAINT_ATTRIBUTES.has(name) ? normalizePaint(raw) : raw.trim();
    if (value !== null && isSafeAttributeValue(name, value)) attrs[name] = value;
  }
  const children: SvgNode[] = [];
  for (const child of element.children) {
    const node = convert(child);
    if (node) children.push(node);
  }
  return { tag: element.name, attrs, children };
}

function lengthOf(value: string | undefined): number | null {
  if (value === undefined) return null;
  const match = /^\s*([0-9]*\.?[0-9]+)\s*(px)?\s*$/.exec(value);
  if (!match) return null;
  const n = Number(match[1]);
  return n > 0 ? n : null;
}

function fail(code: SanitizeFailureCode, reason: string): SanitizeResult {
  return { ok: false, code, reason };
}

export function sanitizeSvg(text: string, language: Language = DEFAULT_LANGUAGE): SanitizeResult {
  const t = strings(language);
  const size = utf8Bytes(text);
  if (size > MAX_FILE_BYTES) return fail("too_large", tooLargeReason(size, language));

  let root: XmlElement;
  try {
    root = parseXml(text);
  } catch (cause) {
    if (cause instanceof XmlParseError) {
      return fail("parse_error", t.parseFailed(cause.message));
    }
    throw cause;
  }
  if (root.name !== "svg") return fail("not_svg", t.rootNotSvg);

  const tree = convert(root);
  if (!tree) return fail("not_svg", t.rootNotSvg);

  const rest = { ...tree.attrs };
  delete rest.width;
  delete rest.height;
  if (!rest.viewBox) {
    const w = lengthOf(root.attrs.find(([n]) => n === "width")?.[1]);
    const h = lengthOf(root.attrs.find(([n]) => n === "height")?.[1]);
    if (w === null || h === null) return fail("no_viewbox", t.noViewBox);
    rest.viewBox = `0 0 ${w} ${h}`;
  }
  if (!rest.fill) rest.fill = "currentColor";
  tree.attrs = rest;

  const checked = validateTree(tree);
  if (!checked) return fail("parse_error", t.treeInvalid);
  if (countShapes(checked) === 0) return fail("no_shapes", t.noShapes);
  return { ok: true, tree: checked, bytes: treeBytes(checked) };
}
