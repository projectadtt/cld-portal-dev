/**
 * Every screen, every width the portal claims to support.
 *
 *   node scripts/db/write/responsive.mjs
 *
 * The check is whether the PAGE scrolls sideways -- window.scrollX after an
 * attempt to scroll -- not whether some element is wide. A table that scrolls
 * inside its own box is correct; a page that scrolls under it is not.
 *
 * Measuring document.scrollWidth alone was what let an existing 481px
 * overflow on the account page go unnoticed: document.body.scrollWidth stayed
 * at the design width while the document itself scrolled.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { launch } from "./browser.mjs";
import { writePng } from "./fixtures.mjs";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3100";
const PATHS = [
  "/", "/products", "/products/new", "/products/organic-edamame-protein-pasta",
  "/products/organic-edamame-protein-pasta/edit",
  "/retailers", "/brokers", "/workstream", "/actions", "/activity",
  "/market-insights", "/meetings", "/reports",
];
const WIDTHS = [390, 768, 1024, 1440];

const page = await launch();
let bad = 0;
for (const width of WIDTHS) {
  console.log("\n\x1b[1m" + width + "px\x1b[0m");
  for (const path of PATHS) {
    await page.setViewport(width, 900, false);
    await page.goto(APP + path);
    const m = await page.evaluate(`
      window.scrollTo(3000, 0); const x = window.scrollX; window.scrollTo(0, 0);
      return { x, doc: document.documentElement.scrollWidth };`);
    if (m.x !== 0) bad++;
    console.log(`  ${m.x === 0 ? "\x1b[32mok\x1b[0m     " : "\x1b[31mSCROLLS\x1b[0m"} scrollX=${m.x}  doc=${m.doc}  ${path}`);
  }
}
/**
 * The upload control with a picture in it.
 *
 * An empty file field is not the state worth measuring — a chosen image is.
 * The preview is the widest thing the form ever holds, and on a 390px screen
 * it sits beside its own controls, so this is where a form would push the page
 * sideways if it were going to.
 */
const WITH_PREVIEW = "/products/organic-edamame-protein-pasta/edit";
/* Generated, not committed — the archived prototype folder is not published,
   and this suite has to run from a clean clone. See ./fixtures.mjs. */
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "cld-responsive-"));
const PHOTO = writePng(path.join(scratch, "preview.png"), { hue: 40 });

console.log("\n\x1b[1mthe image control, with a preview showing\x1b[0m");
for (const width of WIDTHS) {
  await page.setViewport(width, 900, false);
  await page.goto(APP + WITH_PREVIEW);
  await page.attachFile("#image", PHOTO);

  const m = await page.evaluate(`
    window.scrollTo(3000, 0); const x = window.scrollX; window.scrollTo(0, 0);
    const img = document.querySelector('form img');
    return {
      x,
      preview: Boolean(img && img.src.startsWith('blob:')),
      /* The frame must stay inside the form's own column. */
      overflows: img ? img.getBoundingClientRect().right > window.innerWidth : false,
    };`);

  const ok = m.x === 0 && m.preview && !m.overflows;
  if (!ok) bad++;
  console.log(
    `  ${ok ? "\x1b[32mok\x1b[0m     " : "\x1b[31mPROBLEM\x1b[0m"} ${String(width).padStart(4)}px  ` +
      `scrollX=${m.x}  preview=${m.preview ? "showing" : "MISSING"}` +
      `${m.overflows ? "  \x1b[31mpreview past the viewport\x1b[0m" : ""}`,
  );
}

const combinations = PATHS.length * WIDTHS.length + WIDTHS.length;
console.log(
  bad === 0
    ? `\n\x1b[32mNo page scrolls horizontally at any width.\x1b[0m (${combinations} combinations)\n`
    : `\n\x1b[31m${bad} combination(s) scroll sideways.\x1b[0m\n`,
);
await page.close();
fs.rmSync(scratch, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
