/**
 * Stored icon tree -> React elements. The tree is validated again here, so
 * tampered KV data cannot add elements, handlers or URLs. No HTML strings.
 */
import { createElement, type CSSProperties, type ReactElement } from "react";
import { SVG_ATTRIBUTES, validateTree, type SvgNode } from "../shared/svg-allowlist";

export interface RootProps {
  className?: string;
  style?: CSSProperties;
  "aria-hidden"?: boolean;
  "aria-label"?: string;
}

function toElement(node: SvgNode, key: number, root?: RootProps): ReactElement {
  const props: Record<string, unknown> = { key };
  for (const [name, value] of Object.entries(node.attrs)) {
    const prop = SVG_ATTRIBUTES[name];
    if (prop) props[prop] = value;
  }
  if (root) {
    props.xmlns = "http://www.w3.org/2000/svg";
    props.focusable = "false";
    Object.assign(props, root);
  }
  return createElement(node.tag, props, ...node.children.map((child, i) => toElement(child, i)));
}

/** Query data keeps object identity between renders, so each tree is checked once. */
const validated = new WeakMap<object, SvgNode | null>();

function checkedTree(input: unknown): SvgNode | null {
  if (typeof input !== "object" || input === null) return null;
  if (!validated.has(input)) validated.set(input, validateTree(input));
  return validated.get(input) ?? null;
}

export function renderTree(input: unknown, root: RootProps = {}): ReactElement | null {
  const tree = checkedTree(input);
  return tree ? toElement(tree, 0, root) : null;
}
