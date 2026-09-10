# Coffee Lunch Dinner Client Portal
## Product Specification

## 1. PROJECT GOAL

Create a high-level static mockup of a custom Coffee Lunch Dinner client portal.

The portal should give CPG clients a clear view of their retail growth workstream.

The primary goal is not to display more data.

The primary goal is to make the client's retail progress understandable and actionable.

The portal should help a client quickly answer:

- Where are we?
- Which retailers are being worked?
- Who is responsible?
- What has been pitched?
- What feedback have we received?
- What is stuck?
- What happens next?

---

# 2. BUSINESS CONTEXT

Coffee Lunch Dinner (CLD) is a retail growth advisory business for emerging CPG brands.

CLD helps clients with areas including:

- Retail access
- Broker coordination
- Product preparation
- Competitive analysis
- Go-to-market strategy
- Retailer targeting
- Retail introductions

The operational model is similar to a hub coordinating brokers/resources around a client.

The client portal should therefore make the relationship between:

Client
→ Broker
→ Retailer
→ Item
→ Activity
→ Next Action

easy to understand.

---

# 3. CORE PRODUCT IDEA

## "Retail Workstream"

The portal should not feel like a traditional CRM.

Instead, it should feel like a visual workstream for the client's retail growth.

Example:

B&U

Broker
  ↓
Retailer
  ↓
Products
  ↓
Pitch
  ↓
Feedback
  ↓
Next Action

The system should make progress and blockers visible.

---

# 4. PRIMARY USER

Primary user:

CPG brand client

Secondary user:

CLD advisor / team

Future users may include brokers and other resources, but this prototype should primarily demonstrate the client-facing experience.

---

# 5. PRIMARY USER JOURNEY

A client logs in.

They should immediately understand:

### Step 1
What is happening overall?

### Step 2
What needs my attention?

### Step 3
Which retailers are progressing?

### Step 4
Which retailers are stuck?

### Step 5
What are the next actions?

### Step 6
If needed, drill into a retailer.

### Step 7
Review products, samples, feedback, notes, and actions.

---

# 6. INFORMATION ARCHITECTURE

Primary navigation:

- Overview
- Retail Workstream
- Activity
- Actions

Potential future navigation:

- Products
- Insights
- Logistics
- Documents
- Settings

For this prototype, keep navigation focused.

---

# 7. SCREEN: CLIENT OVERVIEW

## Objective

Provide a concise executive-level view of the client's retail work.

---

## Header

Display:

Client name:
B&U

Context:

Retail Growth Workspace

Possible supporting text:

"Your current retail workstream, in one place."

---

## High-Level Summary

Use a small number of meaningful indicators.

Example:

Assigned Brokers
3

Retail Accounts
12

Active Opportunities
5

Needs Attention
2

Do NOT turn this into a 12-card KPI grid.

The summary should remain visually quiet.

---

# 8. OVERVIEW — WHAT NEEDS ATTENTION

This should be one of the most important sections.

Examples:

### Whole Foods Market
Waiting for retailer feedback

Broker:
Sarah

Last activity:
4 days ago

Next action:
Follow up with buyer

---

### Target
Sample delivered

Broker:
Michael

Next action:
Confirm buyer review

---

Attention items should be visually prominent.

Use CLD red sparingly for actual attention/correction states.

---

# 9. OVERVIEW — RETAIL WORKSTREAM

Show a concise visual summary.

Example:

Broker
→ Retailer
→ Current Stage

Sarah
→ Whole Foods Market
→ Feedback pending

Michael
→ Target
→ Sample review

David
→ Kroger
→ Outreach

This should communicate movement, not raw database rows.

---

# 10. OVERVIEW — NEXT ACTIONS

Show the most important upcoming actions.

Example:

Follow up with Whole Foods buyer
Owner: Sarah
Due: Tomorrow

Confirm Target sample review
Owner: Michael
Due: Sep 10

Prepare Kroger product information
Owner: David
Due: Sep 12

Actions should be clear and actionable.

---

# 11. OVERVIEW — RECENT ACTIVITY

Example:

Today
Buyer feedback received from Target

Yesterday
Sample shipped to Whole Foods Market

Sep 6
Broker meeting completed

Sep 5
Kroger outreach initiated

Activity should provide context without overwhelming the page.

---

# 12. SCREEN: RETAIL WORKSTREAM

## Objective

This is the operational heart of the portal.

It should answer:

"Who is working on what, where does it stand, and what happens next?"

---

## Broker Filter

Provide a simple filter:

All Brokers

Sarah
Michael
David

Selecting a broker should update the workstream.

---

# 13. RETAIL WORKSTREAM STRUCTURE

Recommended structure:

Broker

Retailer

Stage

Sample

Items

Feedback

Next Action

Example:

Sarah
Whole Foods Market
Feedback Pending
Sample Sent
2 items
"Buyer reviewing"
Follow up Sep 10

Michael
Target
Sample Review
Sample Delivered
3 items
"Interested in SKU 2"
Buyer follow-up Sep 11

David
Kroger
Outreach
Not Sent
1 item
No feedback
Initial outreach

---

# 14. RETAILER STATUS MODEL

Use a simple progression:

Target
↓
Outreach
↓
In Discussion
↓
Sample Sent
↓
Feedback Received
↓
Active

Alternative states:

On Hold
Do Not Pursue

These states should visually communicate progression.

---

# 15. ITEM-LEVEL INFORMATION

A retailer can have multiple products/items.

Example:

Retailer:
Target

Items:

Product A
Pitch: Yes
Sample: Delivered
Feedback: "Strong packaging"

Product B
Pitch: Yes
Sample: Delivered
Feedback: "Price concern"

Product C
Pitch: No
Sample: Not Sent
Feedback: —

This is important because CLD specifically needs item-level visibility.

---

# 16. SCREEN: RETAILER DETAIL

When selecting a retailer, open a focused retailer workspace.

Example:

WHOLE FOODS MARKET

Broker:
Sarah

Current Stage:
Feedback Pending

Last Conversation:
Sep 6, 2026

---

## Retailer Detail Sections

### Overview

Current status

Assigned broker

Last conversation

Next action

---

### Items

Product
Pitch Status
Sample Status
Retailer Feedback

---

### Activity

Timeline of:

- Outreach
- Meetings
- Samples
- Feedback
- Notes
- Follow-ups

---

### Meeting Notes

Example:

"Buyer liked the positioning but asked for updated pricing."

---

### Next Actions

Action
Owner
Due Date
Status

---

# 17. MEETING MODE

The portal should be useful during CLD client meetings.

A meeting should allow the team to discuss:

- What happened?
- What changed?
- What is blocked?
- What does the broker need?
- What does the client need to provide?
- What is the next action?

The prototype can simulate this through static UI.

No backend persistence is required.

---

# 18. SAMPLE STATUS

Keep sample tracking simple.

Possible values:

Not Required
Not Sent
Preparing
Sent
Delivered
Awaiting Feedback

Sample status should be visible at the retailer/item level.

---

# 19. FEEDBACK

Feedback should be human-readable.

Examples:

"Buyer interested in the category but requested a lower price point."

"Packaging received positively."

"Buyer asked for additional product information."

"Waiting for category review."

Do not reduce all feedback to numerical scores.

---

# 20. ACTIVITY MODEL

Activity examples:

- Email
- Meeting
- Call
- Sample shipment
- Retailer feedback
- Internal note
- Broker update

Each activity should show:

- Date
- Type
- Short description
- Relevant retailer
- Person responsible

---

# 21. ACTION MODEL

Each action should contain:

- Action
- Owner
- Due date
- Status

Example:

Follow up with buyer
Sarah
Sep 10
Open

Prepare updated pricing sheet
B&U
Sep 11
Open

---

# 22. MOCK DATA

Use fictional/illustrative data.

Primary demo client:

B&U

Example brokers:

Sarah
Michael
David

Example retailers:

Whole Foods Market
Target
Kroger
CVS
Walmart

Example products:

Original Lozenges
Honey Mint
Propolis Drops
Daily Defense

These are demo records only.

Do not present them as verified real-world client data.

---

# 23. DESIGN SYSTEM

## Colors

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

---

## Typography

Fraunces:

Headlines and editorial moments.

Instrument Sans:

Body, navigation, labels, metadata, controls.

---

# 24. LAYOUT

Desktop-first.

Recommended layout:

Left:
Persistent navigation

Center:
Primary content

Right:
Optional contextual detail/action panel where useful

Use generous whitespace.

Avoid filling every available pixel.

---

# 25. NAVIGATION

Suggested sidebar:

CLD

Overview

Retail Workstream

Activity

Actions

---

## Sidebar Footer

Client:

B&U

Workspace:

Retail Growth

---

# 26. COMPONENT PRINCIPLES

Components should be reusable.

Suggested components:

- AppShell
- Sidebar
- PageHeader
- SectionHeader
- MetricSummary
- AttentionItem
- WorkstreamRow
- BrokerFilter
- StatusBadge
- ActivityTimeline
- ActionList
- RetailerHeader
- ItemTable
- DetailPanel

Do not over-componentize trivial elements.

---

# 27. INTERACTION REQUIREMENTS

The prototype should include:

1. Broker filtering
2. Retailer selection
3. Navigation between screens
4. Retailer detail state
5. Expandable item information where useful
6. Hover/focus states
7. Responsive behavior

No backend functionality is required.

---

# 28. IMPORTANT UX PRINCIPLE

The portal should not force the client to interpret a spreadsheet.

Instead:

DATA
↓
CONTEXT
↓
STATUS
↓
ATTENTION
↓
ACTION

The UI should perform this translation visually.

---

# 29. WHAT SUCCESS LOOKS LIKE

A successful prototype should make someone say:

"I immediately understand what is happening with my retail pipeline."

Not:

"I can see a lot of data."

The product should communicate clarity.

---

# 30. DEMO NARRATIVE

The recommended presentation flow:

### 1. Overview

"This is the client's starting point."

Show:

- overall progress
- attention items
- next actions

### 2. Retail Workstream

"Instead of opening an Excel file, the client can see who is working on which retailer."

Show:

Broker
→ Retailer
→ Stage
→ Sample
→ Feedback
→ Next Action

### 3. Retailer Detail

"When we need to discuss one retailer during a meeting, we drill into the account."

Show:

- broker
- items
- samples
- feedback
- activity
- notes
- next actions

### 4. Closing Concept

"The goal isn't to replace the operational data source immediately.

The goal is to create a decision and collaboration layer on top of it."

---

# 31. OUT OF SCOPE

Do NOT implement:

- Authentication
- Database
- Supabase
- Firebase
- n8n
- Shopify integration
- Circana integration
- Retailer APIs
- AI APIs
- Email integration
- Real-time synchronization
- User permissions
- Production deployment infrastructure

These may be future phases.

---

# 32. FUTURE PRODUCT DIRECTION

Potential future modules:

## Product Intelligence

- Competitive landscape
- Product positioning
- Opportunity gaps
- Products already in retail
- New product opportunities

## Retail Intelligence

- Sales performance
- Growth/stagnation
- Retailer/category analysis
- Circana integration

## Operations

- Logistics
- Inventory
- Shipping
- Documents

## AI

- Sales sheet analysis
- Product concept generation
- Competitive analysis
- Opportunity identification

These are future possibilities and should not distract from the core prototype.

---

# 33. FINAL PRODUCT POSITIONING

The portal should feel like:

"CLD's operating layer for retail growth."

Not:

"A CRM."

Not:

"An Excel replacement."

Not:

"An analytics dashboard."

The central idea is:

## Know what is moving.
## Know what needs attention.
## Know what happens next.