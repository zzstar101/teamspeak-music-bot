import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

describe("Search pagination layout", () => {
  it("renders previous and next page controls instead of an append-only load-more button", () => {
    const source = readFileSync(join(currentDir, "Search.vue"), "utf8");

    expect(source).toContain("上一页");
    expect(source).toContain("下一页");
    expect(source).toContain("currentPage");
    expect(source).not.toContain("加载更多");
  });

  it("uses the result-type page size for search requests", () => {
    const source = readFileSync(join(currentDir, "Search.vue"), "utf8");

    expect(source).toContain("pageSizeFor(type)");
    expect(source).toContain("pageOffset(page, type)");
  });
});
