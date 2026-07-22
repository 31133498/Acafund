# AcaFund

AcaFund is a financial management platform built for African student communities. It lets groups collect dues, track every naira through a community treasury, govern expense requests with an approval workflow, and publish transparency reports that any member can read.

## Architecture

![AcaFund Architecture](docs/acafund-architecture.svg)

The diagram above shows the full money flow: students pay through Monnify checkout or direct bank transfer, every payment is verified server-side before the ledger is credited, and all payouts are manual with a payout reference recorded before the ledger is debited.

## Stack

| Layer | Tech |
|-------|------|
| API | Python 3.11, FastAPI, SQLAlchemy 2.0 |
| Database | PostgreSQL 16 (SQLite in-memory for tests) |
| Payments | Monnify (NGN collections and reserved accounts) |
| AI assistant | NVIDIA Nemotron via the NVIDIA API |
| Container | Docker / docker-compose |
| Deploy | Render (Blueprint via render.yaml) |
| Frontend | React, TypeScript, Vite, Tailwind CSS |

## Local development

### Prerequisites

- Docker Desktop installed and running
- Copy `.env.example` to `.env` and fill in the values described below

```bash
cd backend
cp .env.example .env
# edit .env with your SECRET_KEY and any optional Monnify / NVIDIA keys

docker compose up          # starts postgres + api at http://localhost:8080
```

API docs are available at `http://localhost:8080/docs` once the container is up.

### Running tests

Tests run against an SQLite in-memory database so you do not need Postgres running locally.

```bash
docker compose exec api python -m pytest tests/ -v
```

To skip the live Monnify sandbox test:

```bash
docker compose exec api python -m pytest tests/ --ignore=tests/test_monnify_live.py -v
```

To run the live Monnify smoke test (requires real sandbox credentials in `.env`):

```bash
docker compose exec api sh -c "RUN_LIVE_MONNIFY_TESTS=1 python -m pytest tests/test_monnify_live.py -v -s"
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL DSN, e.g. `postgresql://user:pass@host/db`. Render sets this automatically from the managed database. |
| `SECRET_KEY` | yes | JWT signing secret, minimum 32 characters. Render auto-generates this on first deploy. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | JWT lifetime in minutes. Default: `60`. |
| `ALGORITHM` | no | JWT algorithm. Default: `HS256`. |
| `MONNIFY_API_KEY` | yes (payments) | Monnify merchant API key. |
| `MONNIFY_SECRET_KEY` | yes (payments) | Monnify merchant secret, used for webhook HMAC verification. |
| `MONNIFY_CONTRACT_CODE` | yes (payments) | Monnify contract code for your merchant account. |
| `MONNIFY_BASE_URL` | no | Monnify API base URL. Default: `https://sandbox.monnify.com`. Change to `https://api.monnify.com` for production. |
| `NVIDIA_API_KEY` | yes (assistant) | NVIDIA API key for the treasury AI assistant (Nemotron model). |
| `FRONTEND_ORIGIN` | no | CORS allowed origin. Default: `http://localhost:3000`. Set to your deployed frontend URL. |
| `EXPENSE_APPROVAL_THRESHOLD` | no | Informational threshold in NGN. Default: `50000`. |

## API overview

| Router | Prefix | Auth | Purpose |
|---|---|---|---|
| auth | `/auth` | None / Bearer | Register, login, profile |
| users | `/users` | Bearer | List communities for the current user |
| communities | `/communities` | Bearer | Create, join, manage roles, reserved account setup |
| collections | `/communities/{id}/collections` | Bearer | Create dues collections, close |
| payments | `/collections/{id}/pay` | Bearer | Initiate Monnify checkout |
| webhooks | `/webhooks/monnify` | None (HMAC) | Receive payment events from Monnify |
| expenses | `/communities/{id}/expenses` | Bearer | Submit, approve, reject, mark as disbursed |
| reports | `/collections/{id}/transparency` | None | Public accountability report for a collection |
| reports | `/communities/{id}/dashboard` | Bearer | Treasury snapshot for community members |
| assistant | `/communities/{id}/assistant/ask` | Bearer | AI-powered treasury Q&A |

### Key endpoints

```
POST   /communities                             Create a community
POST   /communities/join                        Join with an invite code
GET    /communities/{id}                        Community details
GET    /communities/{id}/reserved-account       Monnify reserved account for the community (null if not set)
POST   /communities/{id}/reserved-account       Provision a Monnify reserved account (BVN required)
GET    /users/me/communities                    All communities the current user belongs to

POST   /communities/{id}/collections            Create a dues collection
POST   /collections/{id}/pay                    Initiate payment checkout
POST   /collections/{id}/close                  Close a collection

POST   /expenses/{id}/approve                   Auditor approves an expense
POST   /expenses/{id}/reject                    Auditor rejects an expense
POST   /expenses/{id}/mark-paid-out             Admin or Treasurer records payout reference (triggers ledger debit)

GET    /collections/{id}/transparency           Public report with payment stats, expenses, and bank details
POST   /webhooks/monnify                        Webhook receiver for structured payments and direct transfers
```

## Test coverage

| Test file | What it covers | Tests |
|---|---|---|
| `test_auth.py` | Registration, login, JWT validation | 9 |
| `test_communities.py` | Create, join, roles, invite codes | 11 |
| `test_collections.py` | Collections lifecycle, member enrollment | 16 |
| `test_payments.py` | Checkout initiation, webhook reconciliation, sync | 5 |
| `test_expenses.py` | Submit, approve, reject, mark-paid-out, ledger debit timing | 10 |
| `test_reports.py` | Transparency report, dashboard, AI assistant | 4 |
| `test_reserved_account.py` | Monnify reserved account setup and webhook handling | 7 |
| `test_disbursement.py` | Mark-paid-out flow, payout reference, three-state transparency | 8 |
| `test_monnify_live.py` | Live Monnify sandbox (skipped by default) | 1 |

67 automated tests, all passing.
