/**
 * Prototype configuration — not business data, and not read from the database.
 *
 * `DEMO_TODAY` is the portal's fixed "today". Deliberately a constant rather
 * than `new Date()`: every relative label is measured against it, so the demo
 * reads identically whenever it is presented and a server render can never
 * disagree with the browser. Turning it into a real clock is a later change,
 * and it is the only thing standing between the portal and live dates.
 *
 * The disclaimer is shown wherever mock records could be mistaken for real
 * client information. Which workspaces are demo workspaces is a property of
 * the client row (`clients.is_demo`); this is only the sentence.
 */

export const DEMO_TODAY = process.env.CLD_TODAY ?? "2026-09-09";

export const DEMO_DISCLAIMER =
  "Illustrative demo data — not real client information";
