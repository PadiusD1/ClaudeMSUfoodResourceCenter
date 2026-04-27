# Morgan State Food Resource Center

> A single-binary, offline-first pantry database that turns every donation and pickup into research-grade primary data.

The Morgan State Food Resource Center (FRC) handles thousands of pounds of food per semester. This system runs the pantry's day-to-day operations (intake, distribution, requests, reports) and captures every event as GPS-stamped, weighed, valued, itemized data. Designed for a single laptop, zero recurring cost, and seven volunteer-friendly surfaces over one SQLite database.

**Status:** Spring 2026 build, 18 tables, 10 enums, 7 frontend surfaces, demo-seeded with 41 transactions, 27 SKUs, 10 students, 6 donors, 791.8 lbs.

**License:** MIT (see [LICENSE](LICENSE)).

**Companion case study (presentation, screenshots, narrative):** https://github.com/PadiusD1/morgan-frc-research-paper

**Engineering white paper (this repo):** [RESEARCH_PAPER.md](RESEARCH_PAPER.md)

---

## Tech Stack

**Frontend**
- React 19
- Wouter (routing)
- TanStack Query (server state)
- Radix UI primitives
- Tailwind CSS v4
- Recharts, Lucide, date-fns

**Backend**
- Node.js + TypeScript via `tsx`
- Express 5 (async error handling)
- Drizzle ORM (Postgres dialect schema, SQLite runtime)
- Zod for validation
- Passport for auth scaffolding

**Storage**
- SQLite via better-sqlite3 (WAL mode, single-writer)
- One file: `data/app.db`
- Drizzle schema is Postgres-portable for future federation

**Build**
- Vite for the client
- esbuild for the server (single CommonJS bundle in `dist/`)

---

## Quick Start

```bash
git clone https://github.com/PadiusD1/ClaudeMSUfoodResourceCenter.git
cd ClaudeMSUfoodResourceCenter
npm install
npm run dev
```

Open `http://localhost:5000`.

The first run auto-creates `data/app.db` and runs migrations. No database server required. No cloud account required.

### Production build

```bash
npm run build
npm start
```

Bundles to `dist/index.cjs`. Single binary, single port.

### Optional environment variables

Copy `.env.example` to `.env` and fill in only what you want. All keys are optional; missing keys are silently skipped.

| Variable | Purpose |
|---|---|
| `PORT` | Server port (default 5000) |
| `ALLOWED_ORIGINS` | Comma-separated CORS allow-list for production |
| `UPCITEMDB_API_KEY` | Higher rate limits on UPC Item DB |
| `NUTRITIONIX_APP_ID`, `NUTRITIONIX_APP_KEY` | Nutritionix barcode lookup |
| `USDA_API_KEY` | USDA FoodData Central (defaults to `DEMO_KEY`) |

---

## Surfaces

Seven operational pages and two public pages, all over one database:

| Route | Audience |
|---|---|
| `/` Dashboard | Staff |
| `/inventory` | Staff, Volunteer |
| `/clients`, `/clients/:id` | Staff |
| `/donors`, `/donors/:id` | Staff |
| `/check-in` | Volunteer |
| `/check-out` | Volunteer |
| `/requests` | Staff |
| `/reports` | Staff |
| `/activity` (audit log) | Staff |
| `/settings` | Admin |
| `/portal` | Student (public) |
| `/kiosk` | Walk-up student |

See [RESEARCH_PAPER.md](RESEARCH_PAPER.md) section 8 for what each surface does and section 5 for the schema groups behind them.

---

## Why This Exists

Walk into any campus food pantry and you will see the same thing: real demand, real supply, real volunteer effort, and primary research data evaporating into clipboards and sticky notes. The hypothesis behind this system is that the same database that runs the pantry on Tuesday afternoon should answer real research questions on Friday morning. Demand by category. Donor gap analysis. Per-item value moved. Whether students who request a partial fulfillment ever come back.

The full thesis, design goals, schema rationale, request state machine, and trade-offs live in [RESEARCH_PAPER.md](RESEARCH_PAPER.md).

---

## Repository Structure

```
client/         React 19 SPA (Vite)
  src/pages/    14 route components (dashboard, inventory, ...)
  src/components/  Radix-based UI library
  src/lib/      Repository abstraction, query client
server/         Express 5 API + Vite middleware
  index.ts      Entry point, CORS, error handler, graceful shutdown
  routes.ts     ~50 REST endpoints
  db.ts         SQLite open + migrations (18 CREATE TABLE statements)
  sqlite-storage.ts  IStorage adapter (Drizzle types to SQLite rows)
  storage.ts    IStorage interface
  barcode-lookup.ts  Parallel barcode resolver (USDA, Open Food Facts, UPC Item DB, optional Nutritionix)
shared/
  schema.ts     Drizzle schema + Zod insert schemas + inferred TS types
data/           SQLite database file (gitignored)
docs/           Deployment and server-setup notes
scripts/        Backup, seed, and ops scripts
```

---

## Contributing

This system is MIT-licensed and open to contribution. Particularly welcome:

- HBCU pantry pilots (drop in, run it, file issues)
- Postgres federation (the schema is portable; the sync layer is not built)
- Demand forecasting models on `transaction_items`
- Donor gap analysis reports
- Accessibility audits on the kiosk and student portal

Open an issue before sending a PR for anything substantive.

---

## License

[MIT](LICENSE). Copyright 2026 Patrick Valery.

---

*A pantry is not a charity program. A pantry is an observatory.*
