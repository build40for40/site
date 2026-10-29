// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const hovers = new Map<string, number | null>();

const idea = (i: number) => ({ id: `idea-${i}`, title: `Idea ${i}`, problem: `Problem number ${i}`, sponsors: i < 34 ? [{ name: "Anonymous", amount: 100 - i }] : [] });
let ranking = "classifier";

let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.resetModules();
  vi.doMock("../pool/physics", () => ({
    initializePhysics: () => ({ registerBody() {}, unregisterBody() {}, setBodyHover: (id: string, y: number | null) => hovers.set(id, y), destroy() {} }),
  }));
  hovers.clear();
  ranking = "classifier";
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-height"), addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe() {
        this.callback([{ contentRect: { width: 400, height: 300 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      disconnect() {}
    },
  );
  vi.stubGlobal("fetch", async (url: string) => {
    const { pathname } = new URL(url, "http://localhost");
    if (pathname === "/api/problems") return Response.json({ ideas: Array.from({ length: 44 }, (_, i) => idea(i)), next: null });
    if (pathname === "/api/pool/search") return Response.json({ ranking, matches: [{ id: "idea-40", score: 1 }, { id: "idea-41", score: 0.5 }, { id: "idea-42", score: 0.2 }] });
    return new Response("", { status: 404 });
  });
  document.body.innerHTML = `<textarea id="problem"></textarea>`;
});

afterEach(() => {
  wrapper?.unmount();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

async function write(text: string) {
  const { default: JoinPool } = await import("./JoinPool.vue");
  wrapper = mount(JoinPool, { props: { field: "problem" }, attachTo: document.body });
  await vi.waitFor(() => expect(wrapper!.findAll("li")).toHaveLength(10));
  await flushPromises();
  const field = document.querySelector("textarea")!;
  field.value = text;
  field.dispatchEvent(new Event("input"));
}

test("writing a problem floats similar ideas up by how alike they are, and clearing it drops them", async () => {
  await write("My nails chip the day after I paint them");
  await vi.waitFor(() => expect(hovers.size).toBe(2), { timeout: 2000 });
  expect(hovers.get("idea-40")!).toBeLessThan(hovers.get("idea-41")!);
  expect(wrapper!.text()).toContain("2 unfunded problems look like yours");

  const field = document.querySelector("textarea")!;
  field.value = "";
  field.dispatchEvent(new Event("input"));
  await vi.waitFor(() => expect([...hovers.values()]).toEqual([null, null]));
});

test("the lexical fallback's scores don't lift anything", async () => {
  ranking = "lexical";
  await write("My nails chip the day after I paint them");
  await vi.waitFor(() => expect(wrapper!.text()).toContain("Nothing in the pool looks like yours"), { timeout: 2000 });
  expect(hovers.size).toBe(0);
});
