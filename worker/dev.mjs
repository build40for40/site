import { Readable } from "node:stream";
import { getPlatformProxy } from "wrangler";

// Runs the Worker behind `astro dev` for /api/*, with the same local KV as `wrangler dev`.
export default function workerDev() {
  return {
    name: "worker-dev",
    hooks: {
      "astro:server:setup": async ({ server }) => {
        const { env, dispose } = await getPlatformProxy();
        server.httpServer?.once("close", dispose);

        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/api/")) return next();
          try {
            const { default: worker } = await server.ssrLoadModule("/worker/index.ts");
            const headers = Object.entries(req.headers).flatMap(([name, value]) =>
              value === undefined ? [] : [[name, Array.isArray(value) ? value.join(", ") : value]],
            );
            const hasBody = req.method !== "GET" && req.method !== "HEAD";
            const request = new Request(new URL(req.url, `http://${req.headers.host}`), {
              method: req.method,
              headers,
              body: hasBody ? Readable.toWeb(req) : undefined,
              duplex: "half",
            });
            const response = await worker.fetch(request, env);
            res.writeHead(response.status, Object.fromEntries(response.headers));
            res.end(Buffer.from(await response.arrayBuffer()));
          } catch (error) {
            next(error);
          }
        });
      },
    },
  };
}
