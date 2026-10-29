// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const bodies = { registered: [] as string[], unregistered: [] as string[] };

const physics = () => ({
  initializePhysics: () => ({
    registerBody: (id: string) => bodies.registered.push(id),
    unregisterBody: (id: string) => bodies.unregistered.push(id),
    enablePointerInteraction() {},
    enableDeviceMotion() {},
    setBodyTarget() {},
    setBodyGravityScale() {},
    applyImpulse() {},
    wake() {},
    destroy() {},
  }),
});

// 34 of the 40 days take ideas before Day 1, so the last 10 of these 44 land in the pool.
const idea = (i: number) => ({ id: `idea-${i}`, title: `Idea ${i}`, problem: `Problem number ${i}`, sponsors: i < 34 ? [{ name: "Anonymous", amount: 100 - i }] : [] });
const pages: Record<string, unknown> = {
  0: { ideas: Array.from({ length: 40 }, (_, i) => idea(i)), next: 40 },
  40: { ideas: Array.from({ length: 4 }, (_, i) => idea(40 + i)), next: null },
};

let reducedMotion = false;
let wrapper: VueWrapper | undefined;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
  bodies.registered.length = 0;
  bodies.unregistered.length = 0;
  vi.resetModules();
  vi.doMock("../pool/physics", physics);
  reducedMotion = false;
  localStorage.clear();
  vi.stubGlobal("fetch", async (url: string) => {
    const { pathname, searchParams } = new URL(url, "http://localhost");
    if (pathname === "/api/problems") return Response.json(pages[searchParams.get("offset")!]);
    return new Response("", { status: 404 });
  });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") ? reducedMotion : false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe() {
        this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe() {
        this.callback([{ contentRect: { width: 400 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      disconnect() {}
    },
  );
});

afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

async function board() {
  const { default: DayBoard } = await import("./DayBoard.vue");
  wrapper = mount(DayBoard, { props: { history: {}, builtAt: Date.now() }, attachTo: document.body });
  await vi.waitFor(() => expect(wrapper!.findAll("section[aria-labelledby=pool-title] li")).toHaveLength(10), { timeout: 3000 });
  await flushPromises();
  return wrapper;
}

const pool = (w: VueWrapper) => w.find("section[aria-labelledby=pool-title] ul");
const poolTitles = (w: VueWrapper) => pool(w).findAll("button").map((b) => b.attributes("title"));

describe("the problems pool", () => {
  test("shows every idea that didn't make the days, as bodies once it's on screen", async () => {
    const w = await board();
    expect(poolTitles(w)).toEqual(Array.from({ length: 10 }, (_, i) => `Idea ${34 + i}`));
    await vi.waitFor(() => expect(bodies.registered).toHaveLength(10));
    expect(pool(w).classes()).toContain("relative");
  });

  test("clicking an idea opens it in the day box", async () => {
    const w = await board();
    await pool(w).find("button[aria-label^='In the pool']").trigger("click");
    expect(w.find("#day-box h2").text()).toBe("Idea 34");
  });

  test("sponsoring moves an idea into the days and bumps the last one into the pool", async () => {
    const w = await board();
    await vi.waitFor(() => expect(bodies.registered).toHaveLength(10));
    await pool(w).find("button[title='Idea 40']").trigger("click");
    await w.findAll("#day-box button").find((b) => b.text() === "£100")!.trigger("click");
    await w.find("#sponsor-button").trigger("click");
    await flushPromises();

    expect(poolTitles(w)).not.toContain("Idea 40");
    expect(poolTitles(w)).toContain("Idea 33");
    await vi.waitFor(() => expect(bodies.unregistered).toEqual(["idea-40"]));
    expect(bodies.registered.at(-1)).toBe("idea-33");
  });

  test("search announces matches without relying on motion", async () => {
    const w = await board();
    await w.find("#pool-search").setValue("Idea 37");
    await vi.waitFor(() => expect(w.find("[role=status]").text()).toMatch(/ideas? match/), { timeout: 2000 });
  });

  test("is laid out for physics from the start, with ideas hidden until they drop in", async () => {
    vi.doMock("../pool/physics", () => new Promise(() => {}));
    const w = await board();
    expect(pool(w).classes()).toContain("relative");
    expect(pool(w).findAll("li").every((li) => li.classes().includes("opacity-0"))).toBe(true);
  });

  test("falls back to the plain grid when the physics engine won't load", async () => {
    vi.doMock("../pool/physics", () => Promise.reject(new Error("offline")));
    const w = await board();
    await vi.waitFor(() => expect(pool(w).classes()).toContain("flex-wrap"));
    expect(pool(w).find("li").classes()).not.toContain("opacity-0");
  });

  test("turning motion off leaves the plain grid", async () => {
    localStorage.setItem("pool-motion", "off");
    const w = await board();
    expect(pool(w).classes()).toContain("flex-wrap");
    expect(bodies.registered).toHaveLength(0);
    expect(w.find("section[aria-labelledby=pool-title] button[aria-pressed=false]").text()).toBe("Motion off");
  });

  test("reduced motion gets the plain grid and no motion controls", async () => {
    reducedMotion = true;
    const w = await board();
    expect(pool(w).classes()).toContain("flex-wrap");
    expect(bodies.registered).toHaveLength(0);
    expect(w.text()).not.toContain("Motion on");
  });
});
