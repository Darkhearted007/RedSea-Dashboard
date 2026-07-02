# RedSea Ledger — Commercial Strategy & Monetisation Roadmap

## The Market

Maritime trade carries ~80% of global commerce by volume. The Red Sea / Gulf of Aden corridor alone handles ~15% of global seaborne trade and ~30% of container traffic. Since the 2023–2024 Houthi disruption, maritime security intelligence has become mission-critical for:

- **Shipping companies and operators** — re-routing decisions, vessel risk assessment
- **Marine insurers (P&I clubs)** — underwriting, war-risk premium calculation
- **Commodity traders and brokers** — cargo visibility, ETA intelligence
- **Port authorities and coast guards** — real-time vessel identification
- **NGOs and investigative journalists** — sanctions evasion, dark-vessel tracking
- **Governments and intelligence agencies** — maritime domain awareness

**Total addressable market:** Global maritime intelligence software is estimated at $3–5B and growing at ~8% CAGR.

---

## Product Positioning

> *"Bloomberg Terminal for maritime risk — live vessel tracking, AI threat detection, sanctions screening, and document verification in one platform."*

**Key differentiators:**

| Capability | Incumbents (MarineTraffic, Pole Star, Windward) | RedSea Ledger |
|---|---|---|
| Real-time AIS + threat scoring | Separate products | Unified |
| Sanctions screening | Manual or API add-on | Automatic per vessel update |
| Document tamper detection | Not offered | Built-in blockchain-style chain |
| Deployment model | Cloud SaaS only | SaaS + on-premise + white-label |
| Pricing | $2,000–$50,000/mo enterprise only | Tiered from $99/mo |

---

## Revenue Streams

### 1. SaaS Subscriptions (primary)

| Tier | Target customer | Included | Price |
|---|---|---|---|
| **Analyst** | Researchers, journalists, NGOs, students | 500 vessel-watches/mo, 7-day history, standard threat scoring, export to CSV | $99–149/mo |
| **Operator** | Shipping companies, freight forwarders, brokers | Unlimited vessels, 30-day history, full sanctions screening, document vault (50 docs/mo), port OSINT, email alerts | $999–1,499/mo |
| **Fleet** | Mid-size shipping groups | Everything in Operator + multi-user (10 seats), fleet dashboard, custom watchlists, API access (10k calls/mo) | $2,499/mo |
| **Enterprise** | Port authorities, navies, insurers, commodity majors | Everything + custom bounding boxes, on-premise deployment option, dedicated AIS ingestion, SLA, custom integrations, white-label | Custom — typically $25k–150k ACV |

**Revenue targets:**

| Year | Mix | ARR target |
|---|---|---|
| Y1 | 50 Analyst + 10 Operator | ~$250k |
| Y2 | 200 Analyst + 50 Operator + 5 Fleet + 1 Enterprise | ~$1.2M |
| Y3 | Scale + 3 Enterprise + API | ~$4M+ |

---

### 2. Data API (usage-based)

Expose the threat-scoring engine and sanctions screener as a standalone API for:
- MarTech platforms embedding vessel risk in their UX
- ERP systems (SAP TM, Oracle OTM) adding compliance checks
- Insurance underwriting platforms

**Pricing model:** Tiered per-call + monthly minimum
- $0.05/vessel enrichment call
- $0.10/document hash verification
- $500/mo minimum on commercial plans

**Key buyers:** Oracle, SAP integration partners, Lloyds of London syndicates, freight-tech startups

---

### 3. White-Label / OEM

License the full platform to:
- **Port management software vendors** — embed inside existing port community systems
- **Maritime insurance platforms** — add risk scoring to underwriting workflow
- **Government MDA programs** — sovereign-branded maritime awareness

**Pricing:** Upfront licence fee ($50k–$200k) + annual maintenance (20% of licence) + per-seat runtime

---

### 4. Professional Services

| Service | Price signal |
|---|---|
| Custom AIS region ingestion (specific bounding box, fleet) | $5–15k setup + $500–2k/mo |
| Sanctions list integration (private lists, custom regimes) | $10–30k |
| Regulatory compliance report (OFAC, BIS, IMO) | $2–5k per report |
| Expert witness / litigation support on vessel tracking data | $500–1,500/day |
| Training and onboarding (Analyst certification) | $500/person |

---

### 5. Data Products (longer term)

Once sufficient historical AIS + incident data accumulates:

- **Vessel risk scores as a dataset** — monthly or quarterly snapshots licensed to insurers and lenders
- **Port congestion intelligence feed** — sell aggregated delay/congestion data to commodity desks
- **Dark-vessel event database** — curated list of AIS-off incidents with attribution confidence
- **Sanctions evasion pattern library** — training dataset for compliance ML models

---

## Go-To-Market

### Phase 1 — Credibility (months 1–6)

**Target:** NGOs, journalists, academic researchers, maritime law firms

- Free tier with attribution requirement ("Powered by RedSea Ledger")
- Partner with [C4ADS](https://c4ads.org), [OCCRP](https://occrp.org), [Skylight](https://skylight.global) on sanctions investigations → earned media
- Publish a flagship public vessel-tracking incident (e.g., dark-period event in the Red Sea) as a case study → LinkedIn and X / Twitter distribution
- Apply to [GIJN](https://gijn.org) partner directory

**Goal:** 200+ free accounts, 3–5 case studies, media mentions

### Phase 2 — Commercial traction (months 6–18)

**Target:** Shipping operators, freight brokers, marine insurers

- LinkedIn outreach to fleet managers, VP Operations, Chief Risk Officers at top-50 container lines and tanker operators
- Partner with P&I clubs (UK Club, Steamship, Gard) — offer free integration for their member vessels
- Attend [Nor-Shipping](https://www.nor-shipping.com), [Posidonia](https://www.posidonia-events.com), [SMM Hamburg](https://www.smm-hamburg.com) — 3 shows/year is sufficient at this stage
- Stripe-gated self-serve signup for Analyst and Operator tiers

**Goal:** 10 paying Operator accounts = $120k ARR

### Phase 3 — Enterprise & API (months 18–36)

**Target:** Port authorities, coast guards, insurance groups, government

- Contract with a single anchor government/defence client — establishes credibility for further public-sector sales
- Pursue [NATO DIANA](https://www.diana.nato.int) accelerator (dual-use maritime tech focus)
- UK DSTL / MOD innovation programme (SBRI contracts)
- European Maritime Safety Agency (EMSA) procurement
- Build SDK and developer docs for API tier; launch on RapidAPI

**Goal:** 1–2 Enterprise contracts ($50k+ ACV each), API at $20k ARR

---

## Pricing Psychology

- **Anchor on the Enterprise tier** in all marketing — makes Operator feel affordable
- **Annual billing discount** of 20% to improve cash flow and reduce churn
- **Free 14-day trial** with full Operator features, credit-card required (reduces no-shows)
- **Usage-based overage** on documents and API calls — expands revenue as customers grow
- **Per-seat pricing** only at Fleet/Enterprise — avoids sticker shock for small teams

---

## IP Leverage

The proprietary threat-scoring engine and document tamper-chain are the core defensible assets. Protect them by:

1. **Trade secret regime** — keep algorithms in server-side code only; never expose scoring logic in the client bundle
2. **Patent filing** — provisional patent application on the AIS anomaly multi-stage scoring methodology (~$3–5k with a maritime-tech patent attorney)
3. **Copyright registration** — register the software copyright in the UK/US (~$65 per work)
4. **Trademark** — register "REDSEA LEDGER" and the logo in Classes 42 (SaaS) and 36 (financial intelligence services) in UK/EU/US
5. **Data licence contracts** — all customers sign a data licence prohibiting extraction, redistribution, or training of competing ML models
6. **Proprietary licence** — the `LICENSE` file in this repository makes clear that access to the code for evaluation does not grant any right to use, copy, or deploy

---

## Key Metrics to Track

| Metric | Target (Y1 end) |
|---|---|
| Monthly Recurring Revenue (MRR) | $25k |
| Paying customers | 75+ |
| Annual Churn Rate | <15% |
| Customer Acquisition Cost (CAC) | <$500 for Analyst, <$3k for Operator |
| Lifetime Value (LTV) | >6× CAC |
| API calls / month | 500k+ |
| Net Promoter Score (NPS) | >45 |

---

## Investor Story

**Problem:** Maritime security intelligence is fragmented, expensive ($10k+/mo), and locked behind enterprise contracts. The Red Sea crisis proved that real-time vessel risk data is mission-critical for operators of all sizes — but the tools don't exist at an accessible price point.

**Solution:** RedSea Ledger democratises maritime intelligence — the threat scoring, sanctions screening, and document verification that a Lloyd's of London analyst uses, available to a $99/mo self-serve subscriber.

**Traction levers:** AIS stream online, 21+ vessels tracked in real time, positions persisting to DB, threat profiles computed and stored.

**Ask:** Seed round — £500k–£1.5M to hire one maritime domain expert, one enterprise sales rep, and fund 12 months of go-to-market.
