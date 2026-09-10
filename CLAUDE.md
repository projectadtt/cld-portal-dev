# Coffee Lunch Dinner — Client Portal
## Claude Code Project Instructions

## 1. PROJECT CONTEXT

This project is a high-level static mockup/prototype for a custom client portal for Coffee Lunch Dinner (CLD).

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

The current prototype is NOT a production system.

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

Color usage:

- Forest = primary brand color
- Ink = primary text
- Paper = main background/surface
- Rule = borders/dividers
- Red = decisions, corrections, blockers, or items requiring attention

IMPORTANT:

Red should NOT be used as a decorative accent.

Red should communicate:

- Attention
- Correction
- Blocker
- Decision
- Risk

Do not turn every status into a different bright color.

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

Do NOT imply that mock statuses or feedback are real current client information.

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

Even though this is a static prototype, interactions should feel believable.

Implement lightweight interactions where useful:

- Broker filtering
- Retailer selection
- Navigation between overview and detail
- Expand/collapse
- Tabs where they improve clarity
- Simple hover states
- Clear selected states

Do not build complex backend functionality.

Do not build authentication.

Do not build real database persistence.

Do not build API integrations.

Do not build automation.

Static/hard-coded data is explicitly acceptable for this prototype.

---

## 11. TECHNICAL DIRECTION

Preferred stack:

- Next.js
- TypeScript
- Tailwind CSS
- Lucide icons
- Static/mock data

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
- Overuse cards
- Overuse red
- Add features that were not requested
- Build backend infrastructure
- Build authentication
- Build database integrations
- Build APIs

The prototype should remain focused.

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