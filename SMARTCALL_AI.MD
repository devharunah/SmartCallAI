# SmartCall AI PRD

## Skip the Menu. Just Tell Us What's Wrong.

**Version:** 1.0 (Demo Day MVP)
**Author:** Harunah
**Status:** MVP
**Target Build Time:** 2–3 Hours

---

# 1. Overview

SmartCall AI is an AI-powered call routing platform that replaces traditional IVR (Interactive Voice Response) systems.

Instead of forcing callers to navigate through menus like:

> Press 1 for Billing
> Press 2 for Technical Support
> Press 3 for Sales

Customers simply speak naturally.

The AI understands the customer's issue, classifies it, identifies the most appropriate available agent, and immediately routes the call to them.

For Demo Day, the product will simulate a phone call using speech recognition and demonstrate the AI routing engine. The MVP focuses on showcasing the intelligence behind call routing rather than integrating with real telecom systems.

---

# 2. Problem Statement

Traditional customer support systems create unnecessary friction.

Customers are required to:

* Listen to lengthy automated menus.
* Memorize option numbers.
* Navigate multiple menu levels.
* Often get routed to the wrong department.
* Wait while being transferred between agents.

This results in:

* Longer support times
* Customer frustration
* Higher operational costs
* Poor customer experience

---

# 3. Solution

SmartCall AI eliminates menu navigation entirely.

The customer simply explains their problem naturally.

Example:

> "Hi, my internet has been down since yesterday even though I paid."

The AI:

1. Converts speech into text.
2. Understands the intent.
3. Categorizes the issue.
4. Finds an available qualified agent.
5. Routes the customer immediately.

The customer never presses a single number.

---

# 4. Vision

To become the AI brain that powers customer support routing across telecoms, banks, hospitals, insurance companies, government offices, universities, and enterprise call centers.

---

# 5. Target Customers

## Primary

* Telecom companies
* Banks
* Insurance companies
* Hospitals
* Utility providers

## Secondary

* SMEs
* Universities
* Government agencies
* Large customer service centers

---

# 6. Demo Story

Imagine calling your internet provider.

Instead of hearing:

> Press 1 for Billing.

You hear:

> Hello. Please tell us how we can help today.

Customer:

> My internet hasn't worked since yesterday.

AI:

✓ Detects Technical Support

✓ Finds available agent

✓ Routes instantly

Entire process takes less than three seconds.

---

# 7. User Personas

## Customer

Needs immediate assistance without navigating menus.

Goals

* Speak naturally.
* Reach the correct department quickly.

Pain Points

* Long IVR menus
* Wrong transfers
* Long wait times

---

## Customer Support Agent

Receives only calls relevant to their expertise.

Goals

* Handle the right customers.
* Reduce unnecessary transfers.

---

## Administrator

Manages departments and support agents.

Goals

* Add agents.
* Configure categories.
* Monitor routing.
* View analytics.

---

# 8. MVP Scope

The MVP includes three primary interfaces.

---

## A. Customer Call Screen

Purpose

Simulate a customer calling support.

Features

* Start Call button
* Microphone input
* Live speech-to-text transcript
* AI processing animation
* Issue summary
* Assigned department
* Assigned agent
* Connection screen

---

### Example

Customer says:

> "I lost my debit card yesterday."

Screen displays:

Transcript

> I lost my debit card yesterday.

Detected Category

Banking Card Support

Assigned Agent

Sarah

Confidence

98%

Reason

Customer mentioned:

* Lost card
* Debit card

These indicate a Card Support issue.

---

## B. Admin Dashboard

Purpose

Manage support agents and departments.

Features

* View all agents
* Create new agent
* Edit agent
* Delete agent
* Toggle availability
* Assign categories
* Search agents

Example

Sarah

Department

Technical Support

Phone

070XXXXXXX

Status

🟢 Available

---

## C. Analytics Dashboard

Purpose

Visualize routing performance.

Metrics

* Total Calls
* Calls Today
* Calls by Department
* Active Agents
* Busy Agents
* Average Routing Time
* AI Confidence Score
* Most Common Issues

Charts

* Pie chart
* Bar chart
* Recent calls table

---

# 9. Functional Requirements

## Customer

### FR-001

Customer can start a simulated phone call.

---

### FR-002

Customer can speak naturally.

---

### FR-003

Speech is converted into text.

---

### FR-004

Transcript is sent to AI.

---

### FR-005

AI returns

* Category
* Summary
* Confidence
* Reasoning

---

### FR-006

System searches for agents handling that category.

---

### FR-007

System selects an available agent.

---

### FR-008

Customer sees:

Connecting to Sarah...

---

### FR-009

Call is stored in history.

---

## Administrator

### FR-010

Create departments.

---

### FR-011

Create agents.

---

### FR-012

Assign categories.

Example

Sarah

Handles

* Internet Issues
* Slow Internet
* Router Problems

---

### FR-013

Change availability.

Available

Busy

Offline

---

### FR-014

View analytics.

---

# 10. AI Responsibilities

The AI should:

* Understand natural language.
* Detect customer intent.
* Generate a short summary.
* Assign the correct department.
* Explain why it made its decision.
* Return a confidence score.

---

Example

Input

> My account was charged twice.

AI Output

Category

Billing

Summary

Customer reports duplicate payment.

Confidence

99%

Reason

Keywords detected

* Charged
* Payment
* Twice

---

# 11. Routing Logic

Step 1

Customer speaks.

↓

Step 2

Speech converted to text.

↓

Step 3

AI classifies issue.

↓

Step 4

Search matching department.

↓

Step 5

Find available agents.

↓

Step 6

Assign first available agent.

↓

Step 7

Display connection screen.

---

# 12. Agent Assignment Logic

If multiple agents exist.

Technical Support

* Sarah (Busy)
* John (Available)
* Grace (Available)

The system selects:

John

because he is available.

If no agents are available.

Display:

> All Technical Support agents are currently busy. You are next in the queue.

---

# 13. Suggested AI Prompt

```
You are an intelligent call routing assistant.

Analyze the customer's message.

Return JSON.

{
  "category":"",
  "summary":"",
  "confidence":0,
  "reason":""
}

Possible categories:

Billing

Technical Support

Sales

Insurance

Loans

Card Support

General Inquiry

Use only one category.
```

---

# 14. Database Schema

## Agents

| Field      | Type    |
| ---------- | ------- |
| id         | UUID    |
| name       | String  |
| phone      | String  |
| department | String  |
| available  | Boolean |

---

## Calls

| Field         | Type      |
| ------------- | --------- |
| id            | UUID      |
| transcript    | Text      |
| category      | String    |
| summary       | Text      |
| confidence    | Number    |
| assignedAgent | UUID      |
| createdAt     | Timestamp |

---

# 15. User Flow

Customer

↓

Click Start Call

↓

Grant microphone permission

↓

Speak naturally

↓

Speech-to-text

↓

AI Processing

↓

Category detected

↓

Agent selected

↓

Connecting

↓

Call saved

---

# 16. Tech Stack

Frontend

* Next.js
* TypeScript
* Tailwind CSS
* shadcn/ui

Backend

* Next.js API Routes
* OpenAI API

Speech Recognition

* Browser Web Speech API (for MVP)
* Future: Google Speech-to-Text, Deepgram, Whisper, AssemblyAI

Database

* PostgreSQL
* Prisma ORM

Charts

* Recharts

Deployment

* Vercel

---

# 17. Future Roadmap

## Phase 2

* Real phone integration (Twilio, Plivo, Vonage, or telecom SIP providers)
* Automatic call transfers
* Queue management
* Call recording
* AI-generated call summaries
* CRM integration
* Multi-language support (English, Luganda, Swahili)

## Phase 3

* AI voice agent for common questions before escalation.
* Predictive routing based on customer history.
* Sentiment analysis to detect frustration and prioritize urgent callers.
* Workforce optimization with AI-driven staffing recommendations.

---

# 18. Success Metrics

For the MVP demonstration, success is measured by:

* Speech is transcribed accurately.
* AI correctly classifies the issue.
* An appropriate available agent is selected.
* The routing decision is explained clearly.
* The complete experience feels seamless and intuitive in under three seconds.

---

# 19. Demo Script

1. Open SmartCall AI.
2. Click **Start Call**.
3. Say: *"My internet has been down since yesterday even though I paid my bill."*
4. Watch the live transcript appear.
5. The AI analyzes the request and identifies it as **Technical Support**.
6. The dashboard highlights the assigned available agent (e.g., Sarah) and changes her status to **On Call**.
7. Display the AI's reasoning and confidence score.
8. End by showing the analytics dashboard with the newly logged interaction.

---

# 20. Why This Matters

SmartCall AI isn't trying to replace human support agents—it helps customers reach the right human faster. By understanding issues in natural language instead of relying on rigid IVR menus, organizations can reduce transfers, shorten wait times, improve customer satisfaction, and make better use of their support teams. Even as a prototype, the product demonstrates how AI can remove friction from one of the most common frustrations people face when contacting customer service.
