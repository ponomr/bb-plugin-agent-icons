// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderTree } from "../src/app/render-tree";

const tree = {
  tag: "svg",
  attrs: { viewBox: "0 0 24 24", fill: "currentColor" },
  children: [
    { tag: "circle", attrs: { cx: "12", cy: "12", r: "9", "stroke-width": "2" }, children: [] },
    { tag: "script", attrs: {}, children: [] },
    { tag: "path", attrs: { d: "M0 0L1 1", onload: "alert(1)", href: "javascript:x" }, children: [] },
    { tag: "g", attrs: { fill: "#ff0000" }, children: [{ tag: "image", attrs: { href: "x" }, children: [] }] },
  ],
};

describe("renderTree", () => {
  it("draws allowlisted nodes and puts bb's className on the root svg", () => {
    const { container } = render(<>{renderTree(tree, { className: "size-4" })}</>);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toBe("size-4");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(container.querySelector("circle")?.getAttribute("stroke-width")).toBe("2");
  });

  it("drops tampered nodes and attributes before they reach the DOM", () => {
    const { container } = render(<>{renderTree(tree)}</>);
    expect(container.querySelector("script, image")).toBeNull();
    const path = container.querySelector("path")!;
    expect(path.getAttribute("onload")).toBeNull();
    expect(path.getAttribute("href")).toBeNull();
    expect(container.querySelector("g")?.getAttribute("fill")).toBeNull();
    expect(container.innerHTML).not.toMatch(/alert|javascript|ff0000/);
  });

  it("returns null for a tree whose root is not svg", () => {
    expect(renderTree({ tag: "script", attrs: {}, children: [] })).toBeNull();
    expect(renderTree("<svg/>")).toBeNull();
  });
});
