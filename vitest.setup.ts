import { readFile } from "node:fs/promises";

// Under happy-dom, wasm modules are fetched from the dev server URL. Serve them from disk instead.
const original = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), "http://localhost");
  if (url.pathname.endsWith(".wasm")) return new Response(await readFile(`.${decodeURIComponent(url.pathname)}`));
  return original(input, init);
};
