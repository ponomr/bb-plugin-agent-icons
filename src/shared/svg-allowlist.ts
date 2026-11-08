/**
 * The single allowlist for icon trees. The server sanitizer builds trees
 * that pass it; the client re-validates every tree with `validateTree` before
 * turning it into React elements, so tampered KV data cannot reach the DOM.
 */
import { MAX_TREE_DEPTH, MAX_TREE_NODES } from "./limits";

export interface SvgNode {
  tag: SvgElementName;
  attrs: Record<string, string>;
  children: SvgNode[];
}

const SHAPE_ELEMENT_NAMES = ["path", "circle", "rect", "ellipse", "line", "polyline", "polygon"] as const;
export const SVG_ELEMENTS = ["svg", "g", ...SHAPE_ELEMENT_NAMES] as const;
export type SvgElementName = (typeof SVG_ELEMENTS)[number];

/** A tree without one of these draws nothing and is rejected. */
export const SHAPE_ELEMENTS: ReadonlySet<string> = new Set(SHAPE_ELEMENT_NAMES);

const ELEMENT_SET: ReadonlySet<string> = new Set(SVG_ELEMENTS);

/** SVG attribute name -> React prop name. */
export const SVG_ATTRIBUTES: Readonly<Record<string, string>> = {
  d: "d",
  cx: "cx",
  cy: "cy",
  r: "r",
  rx: "rx",
  ry: "ry",
  x: "x",
  y: "y",
  width: "width",
  height: "height",
  x1: "x1",
  y1: "y1",
  x2: "x2",
  y2: "y2",
  points: "points",
  transform: "transform",
  viewBox: "viewBox",
  fill: "fill",
  stroke: "stroke",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-miterlimit": "strokeMiterlimit",
  "stroke-dasharray": "strokeDasharray",
  "stroke-dashoffset": "strokeDashoffset",
  "stroke-opacity": "strokeOpacity",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
  opacity: "opacity",
};

/** Icons are monochrome: paint is either nothing or the current colour. */
export const PAINT_VALUES: ReadonlySet<string> = new Set(["none", "currentColor"]);

export const PAINT_ATTRIBUTES: ReadonlySet<string> = new Set(["fill", "stroke"]);

/**
 * Numbers, letters for keywords and transform functions, path syntax and `%`.
 * Excludes `:`, `;`, `#`, quotes, `<`, `>`, `&`, `\` and `/`, so no URL, CSS or
 * markup can be expressed.
 */
const SAFE_VALUE = /^[A-Za-z0-9.,+\-\s%()]*$/;
export const URL_FUNCTION = /url\s*\(/i;
const MAX_VALUE_LENGTH = 32 * 1024;

export function isAllowedElement(tag: string): tag is SvgElementName {
  return ELEMENT_SET.has(tag);
}

export function isAllowedAttribute(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(SVG_ATTRIBUTES, name);
}

/** Checks a value that is already normalized (paint is `none` or `currentColor`). */
export function isSafeAttributeValue(name: string, value: string): boolean {
  if (!isAllowedAttribute(name)) return false;
  if (PAINT_ATTRIBUTES.has(name)) return PAINT_VALUES.has(value);
  if (value.length > MAX_VALUE_LENGTH) return false;
  return SAFE_VALUE.test(value) && !URL_FUNCTION.test(value);
}

/**
 * Returns `null` when the input is not an `svg` root or is too large. Unknown
 * nodes are dropped with their subtree.
 */
export function validateTree(input: unknown): SvgNode | null {
  let nodes = 0;

  function visit(value: unknown, depth: number): SvgNode | null {
    if (depth > MAX_TREE_DEPTH) return null;
    if (typeof value !== "object" || value === null) return null;
    const record = value as Record<string, unknown>;
    const tag = record.tag;
    if (typeof tag !== "string" || !isAllowedElement(tag)) return null;
    if (tag === "svg" && depth > 0) return null;
    nodes += 1;
    if (nodes > MAX_TREE_NODES) return null;

    const attrs: Record<string, string> = {};
    const rawAttrs = record.attrs;
    if (typeof rawAttrs === "object" && rawAttrs !== null) {
      for (const [name, attrValue] of Object.entries(rawAttrs)) {
        if (typeof attrValue === "string" && isSafeAttributeValue(name, attrValue)) {
          attrs[name] = attrValue;
        }
      }
    }

    const children: SvgNode[] = [];
    if (Array.isArray(record.children)) {
      for (const child of record.children) {
        const clean = visit(child, depth + 1);
        if (clean) children.push(clean);
      }
    }
    return { tag, attrs, children };
  }

  const root = visit(input, 0);
  if (!root || root.tag !== "svg" || nodes > MAX_TREE_NODES) return null;
  return root;
}

export function countShapes(node: SvgNode): number {
  let count = SHAPE_ELEMENTS.has(node.tag) ? 1 : 0;
  for (const child of node.children) count += countShapes(child);
  return count;
}

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function treeBytes(tree: SvgNode): number {
  return utf8Bytes(JSON.stringify(tree));
}
