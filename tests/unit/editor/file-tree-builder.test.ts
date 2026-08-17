import { describe, it, expect } from "vitest";
import {
  buildPageTree,
  buildAssetTree,
  filterTree,
} from "@/features/editor/components/sidebar/explorer/file-tree-builder";

describe("file-tree-builder", () => {
  it("should construct parent-child hierarchy and place main file first", () => {
    const pages = [
      { _id: "p2", title: "chapter1.tex", parentId: "f1", isFolder: false },
      { _id: "f1", title: "chapters", parentId: null, isFolder: true },
      { _id: "p1", title: "main.tex", parentId: null, isFolder: false, isMain: true },
    ];

    const tree = buildPageTree(pages, "p1");
    expect(tree).toHaveLength(2); // f1 folder and p1 main file at root
    expect(tree[0].id).toBe("f1"); // folders sorted first
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe("p2");
    expect(tree[1].id).toBe("p1");
    expect(tree[1].isMain).toBe(true);
  });

  it("should build nested S3 asset tree from file paths", () => {
    const assets = [
      { name: "plot1.png", key: "figures/sub/plot1.png" },
      { name: "data.csv", key: "data/data.csv" },
    ];

    const tree = buildAssetTree(assets);
    expect(tree).toHaveLength(2); // 'figures' and 'data' folders
    const figuresFolder = tree.find((t) => t.name === "figures");
    expect(figuresFolder).toBeDefined();
    expect(figuresFolder!.children[0].name).toBe("sub");
    expect(figuresFolder!.children[0].children[0].name).toBe("plot1.png");
  });

  it("should filter tree while keeping matching node hierarchy", () => {
    const pages = [
      { _id: "p2", title: "results.tex", parentId: "f1", isFolder: false },
      { _id: "p3", title: "intro.tex", parentId: "f1", isFolder: false },
      { _id: "f1", title: "sections", parentId: null, isFolder: true },
    ];

    const tree = buildPageTree(pages);
    const filtered = filterTree(tree, "results");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("sections");
    expect(filtered[0].children).toHaveLength(1);
    expect(filtered[0].children[0].name).toBe("results.tex");
  });
});
