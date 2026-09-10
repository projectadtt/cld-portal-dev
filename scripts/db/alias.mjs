/**
 * Lets the validation scripts import the application's TypeScript directly.
 *
 * Two things Node does not do on its own: resolve the "@/..." path alias from
 * tsconfig, and resolve an extensionless specifier to a .ts file. Registering
 * this hook means the comparison harness runs the real selector modules rather
 * than a copy of them, which is the only way the comparison means anything.
 *
 *   node --import ./scripts/db/alias.mjs scripts/db/compare-selectors.mjs
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./alias-hook.mjs", pathToFileURL(import.meta.filename));
