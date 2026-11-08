import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "../src/server/sanitize";
import { validateTree, type SvgNode } from "../src/shared/svg-allowlist";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

function ok(text: string) {
  const result = sanitizeSvg(text);
  if (!result.ok) throw new Error(`expected success, got ${result.code}: ${result.reason}`);
  return result;
}

function walk(node: SvgNode, visit: (n: SvgNode) => void) {
  visit(node);
  for (const child of node.children) walk(child, visit);
}

describe("sanitizeSvg", () => {
  it("normalizes a simple icon to currentColor and keeps the viewBox", () => {
    const { tree, bytes } = ok(fixture("simple.svg"));
    expect(tree).toEqual({
      tag: "svg",
      attrs: { viewBox: "0 0 24 24", fill: "currentColor" },
      children: [{ tag: "path", attrs: { d: "M2 2h20v20H2z", fill: "currentColor" }, children: [] }],
    });
    expect(bytes).toBe(new TextEncoder().encode(JSON.stringify(tree)).length);
  });

  it("strips script, handlers, foreignObject, style, use, image and javascript links (AE4)", () => {
    const { tree } = ok(fixture("hostile.svg"));
    const tags: string[] = [];
    const attrs: string[] = [];
    walk(tree, (n) => {
      tags.push(n.tag);
      attrs.push(...Object.keys(n.attrs));
    });
    expect(tags).toEqual(["svg", "circle"]);
    expect(attrs).not.toContain("onload");
    expect(attrs).not.toContain("onclick");
    expect(attrs).not.toContain("style");
    expect(attrs).not.toContain("href");
    expect(JSON.stringify(tree)).not.toMatch(/url\(|javascript|evil|alert/);
  });

  it("drops url() paint and turns other colours into currentColor", () => {
    const { tree } = ok(fixture("hostile.svg"));
    const circle = tree.children[0]!;
    expect(circle.attrs.fill).toBeUndefined();
    expect(circle.attrs.stroke).toBe("currentColor");
  });

  it("keeps fill none, maps transparent to none, drops width, height and class", () => {
    const { tree } = ok(fixture("stroke-icon.svg"));
    expect(tree.attrs).toEqual({
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
    expect(tree.children[1]!.attrs.fill).toBe("none");
  });

  it("rejects a file with only an image as having no shapes", () => {
    const result = sanitizeSvg(fixture("image-only.svg"));
    expect(result).toMatchObject({ ok: false, code: "no_shapes", reason: "нет фигур" });
  });

  it("rejects broken XML", () => {
    const result = sanitizeSvg(fixture("broken.svg"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("parse_error");
      expect(result.reason).toContain("не удалось разобрать");
    }
  });

  it("rejects files over 32 KB before parsing", () => {
    const big = `<svg viewBox="0 0 1 1"><path d="${"M0 0".repeat(9000)}"/></svg>`;
    const result = sanitizeSvg(big);
    expect(result).toMatchObject({ ok: false, code: "too_large" });
    // Not valid XML either; the size check must win.
    expect(sanitizeSvg(`<${"x".repeat(33 * 1024)}`)).toMatchObject({ code: "too_large" });
  });

  it("does not expand external entities or DOCTYPE declarations (XXE)", () => {
    const result = sanitizeSvg(fixture("xxe.svg"));
    expect(result).toMatchObject({ ok: false, code: "parse_error" });
    expect(JSON.stringify(result)).not.toContain("root:");
  });

  it("does not expand nested entities (billion laughs)", () => {
    expect(sanitizeSvg(fixture("lol.svg"))).toMatchObject({ ok: false, code: "parse_error" });
  });

  it("rejects an undeclared custom entity even without a DOCTYPE", () => {
    const result = sanitizeSvg('<svg viewBox="0 0 1 1"><path d="M0 0&foo;"/></svg>');
    expect(result).toMatchObject({ ok: false, code: "parse_error" });
  });

  it("decodes predefined and numeric entities in attribute values", () => {
    const { tree } = ok('<svg viewBox="0&#32;0 1 1"><path d="M0 0h1v1z"/></svg>');
    expect(tree.attrs.viewBox).toBe("0 0 1 1");
  });

  it("accepts a DOCTYPE without an internal subset", () => {
    ok('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>');
  });

  it("keeps fill none and turns stroke red into currentColor", () => {
    const { tree } = ok('<svg viewBox="0 0 1 1"><path d="M0 0h1" fill="none" stroke="red"/></svg>');
    expect(tree.children[0]!.attrs).toMatchObject({ fill: "none", stroke: "currentColor" });
  });

  it("derives the viewBox from width and height and rejects when neither exists", () => {
    const { tree } = ok('<svg width="16px" height="16"><rect width="1" height="1"/></svg>');
    expect(tree.attrs.viewBox).toBe("0 0 16 16");
    expect(sanitizeSvg("<svg><rect width='1' height='1'/></svg>")).toMatchObject({ code: "no_viewbox" });
  });

  it("rejects a non-svg root", () => {
    expect(sanitizeSvg('<html><path d="M0 0"/></html>')).toMatchObject({ code: "not_svg" });
  });

  it("drops values that could carry URLs or CSS in geometry attributes", () => {
    const { tree } = ok(
      '<svg viewBox="0 0 1 1"><path d="M0 0h1v1z" transform="url(#x)"/><rect x="javascript:1" width="1" height="1"/></svg>',
    );
    expect(tree.children[0]!.attrs.transform).toBeUndefined();
    expect(tree.children[1]!.attrs.x).toBeUndefined();
  });

  it("rejects trees that are too deep", () => {
    const open = "<g>".repeat(40);
    const close = "</g>".repeat(40);
    const result = sanitizeSvg(`<svg viewBox="0 0 1 1">${open}<path d="M0 0"/>${close}</svg>`);
    expect(result).toMatchObject({ ok: false, code: "parse_error" });
  });
});

describe("validateTree (client re-check)", () => {
  it("removes forged script nodes, handlers and colours from stored data", () => {
    const forged = {
      tag: "svg",
      attrs: { viewBox: "0 0 1 1", onload: "alert(1)", fill: "#f00" },
      children: [
        { tag: "script", attrs: {}, children: [] },
        { tag: "path", attrs: { d: "M0 0", fill: "currentColor", href: "javascript:x" }, children: [] },
        { tag: "svg", attrs: {}, children: [] },
      ],
    };
    expect(validateTree(forged)).toEqual({
      tag: "svg",
      attrs: { viewBox: "0 0 1 1" },
      children: [{ tag: "path", attrs: { d: "M0 0", fill: "currentColor" }, children: [] }],
    });
  });

  it("returns null for a non-svg root or garbage", () => {
    expect(validateTree({ tag: "g", attrs: {}, children: [] })).toBeNull();
    expect(validateTree("<svg/>")).toBeNull();
    expect(validateTree(null)).toBeNull();
  });
});
