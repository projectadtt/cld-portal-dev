# Coffee Lunch Dinner — Client Portal
## Claude Code Project Instructions

## 1. PROJECT CONTEXT

This project is a custom client portal for Coffee Lunch Dinner (CLD).

It began as a high-level static mockup. It is no longer static: the portal now reads and writes a real Supabase Postgres database behind a cookie session, through server actions. Sections 10, 11 and 17 were written against the mockup and are amended where they say otherwise.

CLD is a retail growth advisory business helping emerging CPG brands move from online channels into retail.

The portal is intended to become a client-facing workspace where CLD and its clients can understand:

- Which brokers/resources are assigned
- Which retailers are being pursued
- Where each retailer relationship stands
- Which products/items have been pitched
- Sample status
- Retailer feedback
- Recent conversations
- Meeting notes
- Next actions
- What currently needs attention

It is still not a production system for a real client's book. It is a working demo on real infrastructure.

The objective is to demonstrate the product experience, information architecture, and visual direction.

---

## 2. PRIMARY PRODUCT PRINCIPLE

Do NOT build a generic SaaS analytics dashboard.

Do NOT simply recreate the existing Excel spreadsheet in a prettier interface.

The portal should feel like a:

> Premium consulting client workspace / retail command center.

The experience should help answer four questions immediately:

1. Where are we?
2. What's moving?
3. What's stuck?
4. What happens next?

The interface should prioritize clarity, workflow, and decision-making over raw data density.

---

## 3. DESIGN DIRECTION

The visual identity should feel consistent with Coffee Lunch Dinner's website and brand.

The design should be:

- Editorial
- Minimal
- Premium
- Calm
- Professional
- Consulting-oriented
- Human
- Structured
- Spacious
- Purposeful

Avoid:

- Generic SaaS dashboard aesthetics
- Excessive cards
- Excessive gradients
- Neon colors
- Glassmorphism
- Huge KPI grids
- Decorative charts with no decision value
- Overly dense tables
- Excessive status colors
- AI-generated-looking visual clutter

The interface should feel closer to a premium consulting product than a conventional CRM.

### Where cards are allowed

The hairline rule remains the layout primitive. Cards are the exception and have to earn their place.

A card is allowed where the reader is scanning for a value rather than reading a sentence, and where a tile is what makes that value findable. Two places qualify today:

- The five figures at the top of the Overview
- The next-moves list on the Overview

Both were approved against a client reference on Sep 11, 2026.

A card must stay quiet about being one: a single shared radius, a hairline border, a shadow you have to look for. No gradients, no icons for decoration, no second shadow.

Everything else — every list, every section, every detail screen — stays on rules. "Excessive cards" above still means what it says; it is now a limit rather than a prohibition.

---

## 4. BRAND SYSTEM

Use the following CLD brand colors:

Forest:
#12372A

Ink:
#151815

Red:
#D72B34

Paper:
#FFFFFF

Rule:
#D9DDD7

Amber:
#D97A2B

Color usage:

- Forest = primary brand color
- Ink = primary text
- Paper = main background/surface
- Rule = borders/dividers
- Red = decisions, corrections, blockers, or items requiring attention
- Amber = waiting on the buyer

IMPORTANT:

Red should NOT be used as a decorative accent.

Red should communicate:

- Attention
- Correction
- Blocker
- Decision
- Risk
- A live buyer conversation — Overview tile only

Do not turn every status into a different bright color.

### Amber

Amber was added on Sep 11, 2026 and carries exactly one meaning: an account that has been handed over and is now waiting on the buyer.

That state needed its own colour because neither existing one tells the truth about it. Red would call it a risk, which it is not. Forest would claim it as our progress, which it is not either — the ball is on the other side of the table.

Nothing else may use Amber. If a second meaning is ever proposed for it, that is the signal the palette is drifting.

### Forest as a surface

Forest fills the navigation rail, not only accents within it. At #12372A a wordmark reads as ink rather than as green; an area of it is what makes the brand colour legible as the brand's own.

The content column stays on Paper. One saturated area, and it is the frame — never the work.

### The one decorative Red

The "Buyer discussions" tile on the Overview is Red, and a live conversation is good news rather than a problem. It is the single exception, made at the client's direction on Sep 11, 2026.

It survives because it is a count, not a state on a record — it cannot be mistaken for a warning about a particular account. Do not extend the reasoning any further than that tile.

---

## 5. TYPOGRAPHY

Primary heading font:

Fraunces

Use Fraunces for:

- Page titles
- Major section headings
- Important editorial statements

Body/UI font:

Instrument Sans

Use Instrument Sans for:

- Navigation
- Labels
- Tables
- Metadata
- Buttons
- Body copy
- Form elements

Typography should create a strong editorial hierarchy.

Avoid excessive font sizes and unnecessary bold text.

---

## 6. PRODUCT EXPERIENCE

The main experience should revolve around the retail workstream.

The core relationship is:

Client
→ Broker
→ Retailer
→ Item/Product
→ Pitch
→ Feedback
→ Next Action

The UI should make this relationship easy to understand.

A user should be able to start from a client-level overview and progressively drill into:

Client
→ Broker
→ Retailer
→ Product/Item
→ Activity / Feedback / Next Step

---

## 7. CORE SCREENS

The prototype should focus on three major experiences.

### SCREEN 1 — CLIENT OVERVIEW

Purpose:

Give the client an immediate understanding of their current retail situation.

The page should communicate:

- Client identity
- Overall retail progress
- Assigned brokers/resources
- Retail accounts in progress
- Items/products being worked
- What needs attention
- Upcoming/next actions
- Recent activity

The page should NOT become a KPI dashboard.

Prefer meaningful workflow summaries over dozens of numerical metrics.

Five figures sit at the top of this page as tiles. Five is the ceiling, not a starting point — the rule above is what keeps it from becoming twelve. They are context for the sections beneath them, and the page still opens on the headline and on what needs attention, not on the numbers.

Possible sections:

- Header / client identity
- Retail progress overview
- What needs attention
- Retail workstream
- Next actions
- Recent activity

---

### SCREEN 2 — RETAIL WORKSTREAM

Purpose:

Visualize the operational relationship:

Broker → Retailer → Item → Status

This should be one of the most important screens.

Users should be able to:

- See assigned brokers
- Filter by broker
- See retailers assigned to each broker
- See retailer status
- See sample status
- See product/item progress
- See retailer feedback
- Open a retailer for more detail

The experience should feel like a workstream rather than a spreadsheet.

Think:

"Who is working on what, where does it stand, and what happens next?"

---

### SCREEN 3 — RETAILER DETAIL / MEETING VIEW

Purpose:

Give CLD and the client a focused workspace for one retailer.

Show:

- Retailer
- Assigned broker
- Current status
- Products/items
- Pitch status
- Sample status
- Retailer feedback
- Last conversation
- Meeting notes
- Next actions
- Owner
- Due date

This screen should also feel usable during an actual client meeting.

The portal should support the conversation instead of simply displaying historical data.

---

## 8. DEMO DATA

Use realistic but clearly illustrative mock data.

Use a sample client such as:

B&U

This client was discussed during the discovery/interview conversation and can be used as the prototype client.

The workspace in the database is **7Grains**, on the **Retail Growth** workspace. `project_specs.md` still says B&U throughout; where the two disagree, the database is what the portal shows.

Do NOT imply that mock statuses or feedback are real current client information.

A workspace holding illustrative records has to say so on screen. The form is free: a "Demo" badge beside the workspace name carries it on the rail, and the full sentence prints beneath the content on small screens, where there is no panel to carry a badge. Driven by `clients.is_demo`, never hard-coded — a real client's book must never print it.

Create believable examples for:

- Brokers
- Retailers
- Products
- Retailer statuses
- Sample statuses
- Feedback
- Meetings
- Actions

The data should be internally consistent.

---

## 9. STATUS SYSTEM

Keep status terminology simple.

Potential retailer statuses:

- Not Started
- Target
- Outreach
- In Discussion
- Sample Sent
- Feedback Received
- Active
- On Hold
- Do Not Pursue

Potential item-level states:

- Not Pitched
- Pitched
- Sample Sent
- Feedback Received
- Accepted
- Rejected
- Needs Follow-up

Do not create unnecessary status categories.

Status should communicate progression and decision-making.

---

## 10. INTERACTION PRINCIPLES

Interactions should feel believable — and most of them are now real.

Implement lightweight interactions where useful:

- Broker filtering
- Retailer selection
- Navigation between overview and detail
- Expand/collapse
- Tabs where they improve clarity
- Simple hover states
- Clear selected states

Do not build API integrations.

Do not build automation.

### Amended — the backend exists

This section originally said not to build authentication or real database persistence, and that hard-coded data was acceptable. Both have since been built, deliberately, and the instruction is out of date rather than being ignored.

What exists today:

- Supabase Postgres, reached through `pg`. Schema in `supabase/migrations`.
- A cookie session gating every route. Sign-in is a real form, not a stub.
- Server actions writing through one mutation layer, in transactions.
- `buyer_feedback` and `activities` are append-only, enforced by database trigger.

What still holds from the original instruction:

- No third-party API integrations.
- No automation or scheduled work.
- No feature that was not asked for.
- The database is a demo workspace, not a real client's book.

---

## 11. TECHNICAL DIRECTION

Stack in use:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Lucide icons
- Supabase Postgres via `pg`, with migrations in `supabase/`
- Server actions for every write
- PGlite for tests — a throwaway Postgres per suite, never the working database

Keep the implementation clean and componentized.

Prefer reusable components such as:

- Sidebar
- Topbar
- SectionHeader
- StatusBadge
- RetailerRow
- BrokerFilter
- ActivityItem
- ActionItem
- RetailerDetail
- ProgressIndicator

Avoid creating a single massive page component.

---

## 12. RESPONSIVE DESIGN

The primary target is desktop.

However, the UI should still behave responsibly on smaller screens.

Desktop should receive the highest design attention because this is primarily a client/workspace application.

---

## 13. VISUAL HIERARCHY

Every screen should have a clear visual hierarchy.

Users should immediately recognize:

1. Current context
2. Current status
3. Important exceptions
4. Next action

Do not give equal visual weight to everything.

Important information should have stronger hierarchy.

Secondary metadata should remain quiet.

---

## 14. DATA DENSITY

Prefer:

Meaningful information
over
More information.

The existing CLD workflow currently relies heavily on spreadsheets.

The goal of this prototype is to demonstrate how the same operational information can become:

- easier to understand
- easier to discuss
- easier to act on
- more useful during meetings

Do not attempt to display every spreadsheet field.

---

## 15. PRODUCT PHILOSOPHY

The portal should behave like a decision layer on top of operational data.

The spreadsheet answers:

"What is recorded?"

The portal should help answer:

"What does this mean?"

"What needs attention?"

"What happens next?"

This distinction is extremely important.

---

## 16. FUTURE FEATURES

The following ideas may exist in the broader CLD product vision but should NOT dominate this prototype:

- Circana retail data
- Competitive intelligence
- Product opportunity analysis
- AI product concept generation
- Logistics/inventory intelligence
- Sales sheet analysis
- Advanced retail analytics
- Automated workflows
- External APIs

If referenced, treat these as future possibilities rather than current prototype requirements.

---

## 17. WHAT NOT TO DO

Never:

- Turn the project into a generic CRM
- Turn the project into a generic analytics dashboard
- Recreate Excel literally
- Add unnecessary charts
- Add fake AI features just for appearance
- Add unnecessary animations
- Use decorative gradients
- Overuse cards — see §3, "Where cards are allowed"
- Overuse red — see §4, "The one decorative Red"
- Add features that were not requested
- Build third-party API integrations
- Write to the working database outside a test, unless asked
- Invent a field the schema does not have, to fill a design

The last two are worth stating plainly. A badge reading "Active" where no status column exists is a claim nobody made; either the schema gains the field or the design gives up the badge.

The backend lines that used to sit here — no authentication, no database, no APIs — were written for the static mockup. The first two are built. See §10.

The portal should remain focused.

---

## 18. DEVELOPMENT WORKFLOW

Before implementing major UI changes:

1. Read `project_specs.md`.
2. Inspect the existing project structure.
3. Understand the current design system.
4. Identify reusable components.
5. Plan the change.
6. Implement.
7. Run the application.
8. Check for errors.
9. Review the visual result.
10. Refine spacing, hierarchy, typography, and consistency.

Do not blindly generate large amounts of code.

Prefer incremental implementation.

---

## 19. QUALITY BAR

The final prototype should look intentional enough to present directly to a consulting/client audience.

The design should communicate:

"CLD understands the retail workflow."

It should NOT communicate:

"This is a template dashboard generated from a UI library."

Prioritize:

- Strong typography
- Excellent spacing
- Clear hierarchy
- Elegant interaction
- Consistent components
- Realistic mock data
- Strong editorial composition
- Minimal visual noise

---

## 20. SOURCE OF TRUTH

For product requirements:

`project_specs.md`

For coding/design behavior:

`CLAUDE.md`

If there is ambiguity, do not invent major functionality.

Prefer the simplest interpretation that supports the stated product goal.

Where this file and `project_specs.md` disagree about what exists, this file is current. Where either disagrees with the database, the database is what the portal shows.

---

## 21. RECORD OF AMENDMENTS

This document was written for a static mockup. The project outgrew parts of it. Amendments are recorded here so a later reader can tell a deliberate decision from a violation — the reason a section was changed matters more than the change.

### Sep 11, 2026 — the backend

§1, §10, §11, §17.

The portal reads and writes Supabase Postgres behind a cookie session. The instruction not to build authentication or database persistence was written before that and no longer describes the project. No third-party API integrations and no automation still hold.

### Sep 11, 2026 — tiles on the Overview

§3, §7, §17. Approved against a client reference.

The five figures and the next-moves list became cards. The hairline rule is still the layout primitive everywhere else, and "excessive cards" became a limit rather than a prohibition. Five figures is the ceiling.

### Sep 11, 2026 — Amber, and one decorative Red

§4. Approved by the client.

Amber entered the palette for a single meaning: waiting on the buyer. Red gained one exception: the "Buyer discussions" tile, which is good news rather than a problem. Both are scoped deliberately tightly — a second meaning for Amber, or a second decorative Red, is the signal that the palette is drifting.

### Sep 11, 2026 — the demo marker

§8. The rail carries a "Demo" badge instead of the full sentence; the sentence still prints on small screens. Driven by `clients.is_demo`.

### Still open

- `project_specs.md` has not been amended and still describes the static mockup and the B&U client throughout.
- The card treatment exists only on the Overview. The other nine screens are still on rules, so the portal currently reads as two design languages.