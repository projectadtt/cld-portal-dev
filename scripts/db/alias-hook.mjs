/**
 * Resolution hook: "@/x" -> src/x, and extensionless -> .ts / .tsx.
 *
 * Also stubs "server-only", which is a Next.js build-time guard with no
 * runtime meaning outside a bundler. Stubbing it here is what lets the
 * harness import the real pool and workspace modules; it does not weaken the
 * guard in the application, where the bundler still enforces it.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(ROOT, "src");
const EXTS = [".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];

const firstThatExists = (base) => {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of EXTS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") {
    return { url: pathToFileURL(path.join(ROOT, "scripts", "db", "server-only-stub.mjs")).href, shortCircuit: true };
  }

  if (specifier.startsWith("@/")) {
    const found = firstThatExists(path.join(SRC, specifier.slice(2)));
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
  }

  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    const found = firstThatExists(base);
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
  }

  return next(specifier, context);
}
