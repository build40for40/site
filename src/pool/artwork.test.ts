import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { ARTWORK_VERSIONS, createVisualIdentity, generateArtwork, getArtwork, regenerateArtwork, seededRandom } from "./artwork";

describe("generateArtwork", () => {
  test("the same seed always draws the same picture", () => {
    expect(generateArtwork("0373b0dc-b0a1")).toBe(generateArtwork("0373b0dc-b0a1"));
  });

  test("different ideas get different pictures", () => {
    const svgs = new Set(Array.from({ length: 2000 }, (_, i) => generateArtwork(crypto.randomUUID() + i)));
    expect(svgs.size).toBe(2000);
  });

  test("version 1 never changes", () => {
    const digest = createHash("sha256").update(generateArtwork("pinned-seed", {}, 1)).digest("hex").slice(0, 16);
    expect(digest).toMatchInlineSnapshot(`"0f3a81a756bb751d"`);
  });

  test("asking for an unknown version fails loudly", () => {
    expect(ARTWORK_VERSIONS).toContain(1);
    expect(() => generateArtwork("x", {}, 99)).toThrow("No artwork version 99");
  });

  test("only ever contains shapes, numbers and theme classes", () => {
    const svg = generateArtwork("x", { shapes: ["circle", "ring", "square", "triangle", "bar", "dots"], count: [8, 8], complexity: 1 });
    const tags = new Set([...svg.matchAll(/<(\w+)/g)].map((m) => m[1]));
    expect([...tags].every((t) => ["svg", "circle", "rect", "polygon", "g"].includes(t))).toBe(true);
    const classes = [...svg.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(" "));
    expect(classes.every((c) => /^(fill|stroke)-(none|night-[a-z]+|shipped|live|queued|guest)(\/\d+)?$/.test(c))).toBe(true);
  });

  test("options change the picture", () => {
    expect(generateArtwork("x", { count: [1, 1] })).not.toBe(generateArtwork("x", { count: [9, 9] }));
  });
});

describe("visual identity", () => {
  test("never puts submitted text into the picture", () => {
    const idea = { id: "evil", title: '<script>alert("t")</script>', problem: "</svg><img src=x onerror=alert(1)>", owner: "Ada" };
    const { svg } = createVisualIdentity(idea);
    expect(svg).not.toMatch(/script|img|onerror|alert|Ada/);
  });

  test("is cached per idea and can move to another version on purpose", () => {
    const first = createVisualIdentity({ id: "cached" });
    expect(createVisualIdentity({ id: "cached" })).toBe(first);
    expect(getArtwork("cached")).toBe(first);
    expect(regenerateArtwork("cached", 1)?.svg).toBe(first.svg);
    expect(() => regenerateArtwork("cached", 2)).toThrow();
  });

  test("ideas from the same submitter share a family but still differ", () => {
    const a = createVisualIdentity({ id: "f1", seed: "abcdef0123456789:1111111111111111" });
    const b = createVisualIdentity({ id: "f2", seed: "abcdef0123456789:2222222222222222" });
    expect(a.svg).not.toBe(b.svg);
  });
});

test("the random stream is seeded", () => {
  const a = seededRandom("seed");
  const b = seededRandom("seed");
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});
