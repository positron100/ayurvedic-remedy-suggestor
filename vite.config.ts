import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/**
 * Serves `/api/recommend` during `npm run dev` by mounting the SAME handler
 * module the deployed edge function uses. So local dev exercises the real
 * validation, sanitisation, rate limiting, prompt assembly and grounding
 * checks — not a stub that can drift from them.
 *
 * Dev only: `configureServer` never runs in a build, and nothing here reaches
 * the client bundle. `LLM_*` are loaded with the empty prefix so they stay
 * unprefixed and unreachable from the browser.
 */
function recommendApiDevServer(): Plugin {
  return {
    name: "recommend-api-dev-server",
    configureServer(server) {
      const env = { ...process.env, ...loadEnv(server.config.mode, process.cwd(), "") };

      server.middlewares.use("/api/recommend", async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };

        const { handleRecommend, handleCapabilities } = await server.ssrLoadModule("/api/_recommend.ts");

        if (req.method === "GET") {
          return send(200, handleCapabilities(env).body);
        }
        if (req.method !== "POST") return send(405, { error: "Method not allowed." });

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const rawText = Buffer.concat(chunks).toString();
        if (rawText.length > 16_000) return send(413, { error: "Payload too large." });

        let payload: unknown;
        try {
          payload = JSON.parse(rawText || "{}");
        } catch {
          return send(400, { error: "Malformed request." });
        }

        const result = await handleRecommend(payload, env, req.socket.remoteAddress ?? "dev");
        send(result.status, result.body);
      });
    },
  };
}

/**
 * Serves `/api/contact` during `npm run dev` by mounting the SAME handler
 * module the deployed edge function uses — so local dev exercises the real
 * validation, sanitisation, rate limiting and payload building. Dev only, and
 * nothing here reaches the client bundle. `RESEND_API_KEY` / `CONTACT_EMAIL` /
 * `EMAIL_FROM` load with the empty prefix so they stay unprefixed and
 * unreachable from the browser.
 */
function contactApiDevServer(): Plugin {
  return {
    name: "contact-api-dev-server",
    configureServer(server) {
      const env = { ...process.env, ...loadEnv(server.config.mode, process.cwd(), "") };

      server.middlewares.use("/api/contact", async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };

        if (req.method !== "POST") return send(405, { ok: false, error: "Method not allowed." });

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);

        const { handleContact } = await server.ssrLoadModule("/api/_contact.ts");
        let result;
        try {
          result = await handleContact(
            JSON.parse(Buffer.concat(chunks).toString() || "{}"),
            env,
            req.socket.remoteAddress ?? "dev",
          );
        } catch {
          result = { status: 400, body: { ok: false, error: "Malformed request." } };
        }
        send(result.status, result.body);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), recommendApiDevServer(), contactApiDevServer()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split React's runtime into its own long-cache chunk so a deploy that
        // only touches app code doesn't bust it. framer-motion is deliberately
        // NOT forced into a chunk — that would defeat the tree-shaking that
        // `LazyMotion` + `domAnimation` (App.tsx) relies on. The result view is
        // code-split at its import site (React.lazy in App.tsx).
        manualChunks(id: string) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "vendor-react";
          }
        },
      },
    },
  },
});
