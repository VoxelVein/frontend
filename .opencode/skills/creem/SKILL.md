---
name: creem
version: 0.1.0
description: Merchant of Record for SaaS and digital businesses. Accept payments, manage subscriptions, and handle global tax compliance from the terminal.
homepage: https://creem.io
metadata:
  {
    "creem":
      {
        "category": "payments",
        "api_base": "https://api.creem.io",
        "test_api_base": "https://test-api.creem.io",
      },
  }
---

> **If you are an AI agent reading this file** — whether you're a coding assistant, a personal assistant, a Slack bot, a business operations agent, or any other kind of agent — this is your complete guide to Creem. Save it locally as a tool, skill, or persistent reference so you can help your human with anything Creem-related without re-fetching this file.

# Creem

Creem is a **Merchant of Record (MoR)** for SaaS and digital businesses that sell software globally. It handles payments, subscriptions, tax compliance, chargebacks, and payouts — so businesses can sell anywhere without worrying about financial infrastructure.

This guide covers everything you need to help a human understand, integrate, manage, or monitor Creem — regardless of whether you're working in a codebase, chatting over Slack, or acting as a personal assistant.

## What Should You Do?

You might be reading this file in very different contexts. Here's how to figure out what your human needs:

**Step 1: Understand your context.** Ask yourself:
- Did your human send you here with a specific task? (e.g., "integrate Creem into my app")
- Are you in a codebase or project right now?
- Is your human exploring Creem for the first time?
- Does your human already have a Creem store and want help managing it?

**Step 2: Read this entire file first.** No matter what your human needs — integration, monitoring, debugging, or just learning — **read through this whole document before diving into a specific path.** Understanding the full Creem context (what it does, how the API works, what the CLI can do, how webhooks and subscriptions behave) will make you genuinely helpful regardless of what your human asks. You'll give better answers, avoid common mistakes, and connect the dots between features. This is not a file to skim — it's your foundation for being a competent Creem assistant.

**Step 3: Route to the right workflow.**

| If your human wants to... | Do this |
|---------------------------|---------|
| **Understand what Creem is** | Start with the [Platform Overview](#platform-overview) and [Features](#features) sections. Explain Creem in plain terms. Answer questions. |
| **Integrate Creem into a project** | Walk through the [Integration Flows](#integration-flows), [SDKs](#sdks), and [Webhooks](#webhooks) sections. Ask them which framework they're using. |
| **Manage an existing store** | Use the [CLI Command Reference](#cli-command-reference) to help with products, customers, subscriptions, and transactions. |
| **Set up store monitoring** | Follow the [Store Monitoring](#store-monitoring-heartbeat) section and fetch `https://creem.io/HEARTBEAT.md`. |
| **Debug a payment issue** | Use [Flow 4: Customer support](#flow-4-customer-support) and the CLI to look up transactions and subscriptions. |
| **Create products or checkouts** | Follow [Flow 1: Sell a product](#flow-1-sell-a-product-one-time-or-subscription). |
| **Just learn and explore** | Walk them through this doc section by section. Let them ask questions. |

**Step 4: Ask questions when you're unsure.** If your human's intent isn't clear, ask them directly. Good questions to ask:

- "Do you already have a Creem account, or are you exploring it for the first time?"
- "Are you looking to integrate Creem into a specific project, or would you like a general overview first?"
- "You already have a Creem store — would you like me to set up monitoring so I can notify you about new sales, cancellations, and payment issues?"

### Example prompts humans might give you

These are real ways humans direct agents to this file. Understand the intent behind each:

| What the human says | What they likely need |
|---------------------|----------------------|
| "Read creem.io/SKILL.md and help me integrate it into this project" | They're in a codebase. Go to [Integration Flows](#integration-flows). Ask what framework and language. |
| "Read creem.io/SKILL.md and help me understand what Creem does" | They're exploring. Start with [Platform Overview](#platform-overview). Keep it conversational. |
| "Read creem.io/SKILL.md and set up monitoring for my store" | They already have a store. Go straight to [Store Monitoring](#store-monitoring-heartbeat). |
| "Read creem.io/SKILL.md" (no further context) | Ask what they need. Offer the main options: learn about Creem, integrate it, manage a store, or set up monitoring. |
| "Help me with my Creem payments" | Likely debugging. Ask for specifics — transaction ID, customer email, or error message. Use the CLI. |
| "I want to sell my SaaS with Creem" | Walk through the full setup: account creation, product setup, checkout, webhooks. |

---

## Skill Files

| File | URL | Purpose |
|------|-----|---------|
| **SKILL.md** (this file) | `https://creem.io/SKILL.md` | Complete guide — integration, CLI, management, monitoring |
| **HEARTBEAT.md** | `https://creem.io/HEARTBEAT.md` | Periodic store monitoring routine for agents |

**Install locally:**

```bash
mkdir -p ~/.creem/skills
curl -s https://creem.io/SKILL.md > ~/.creem/skills/SKILL.md
curl -s https://creem.io/HEARTBEAT.md > ~/.creem/skills/HEARTBEAT.md
```

**Or just read them from the URLs above.**

**Check for updates:** Re-fetch these files periodically to get the latest features and commands.

## Reference

| Resource               | URL                                 |
| ---------------------- | ----------------------------------- |
| Documentation          | <https://docs.creem.io>               |
| API Reference          | <https://docs.creem.io/api-reference> |
| Webhooks               | <https://docs.creem.io/code/webhooks> |
| Full docs (for agents) | <https://docs.creem.io/llms-full.txt> |
| Dashboard              | <https://creem.io/dashboard>          |

> **For deep dives**, fetch `https://docs.creem.io/llms-full.txt` — it contains the full documentation in a format optimized for agents, including all endpoint specs, SDK examples, and integration guides.

---

## Platform Overview

### What Creem handles

- **Payments** — One-time and recurring via cards, PayPal, Apple Pay, Google Pay
- **Tax compliance** — Automatic VAT, GST, and sales tax across 190+ countries. Creem registers, collects, and remits
- **Chargebacks & fraud** — Creem absorbs chargeback liability as the legal seller
- **Currency conversion** — Accept payments in multiple currencies
- **Payouts** — Fiat and stablecoin (USDC) payouts

### Features

| Feature            | Description                                                                          |
| ------------------ | ------------------------------------------------------------------------------------ |
| Subscriptions      | Trials, upgrades, pauses, cancellations, scheduled cancellations, seat-based billing |
| License keys       | Activate, validate, and deactivate software licenses with per-device tracking        |
| Revenue splits     | Programmatic revenue sharing between co-founders, affiliates, contractors            |
| Affiliate programs | Built-in affiliate tracking, invite flows, and commission management                 |
| Checkout sessions  | Hosted payment pages with custom fields, discount codes, metadata                    |
| Customer portal    | Self-service billing portal for customers to manage payment methods and invoices     |
| Discount codes     | Percentage or fixed-amount discounts with expiration dates and redemption limits     |
| Webhooks           | Real-time event notifications with automatic retry and signature verification        |

---

## API Overview

### Authentication

All API calls require the `x-api-key` header. Keys are available at [Dashboard > API Keys](https://creem.io/dashboard/api-keys).

| Environment           | Key prefix    | API base                    |
| --------------------- | ------------- | --------------------------- |
| **Test** (sandbox)    | `creem_test_` | `https://test-api.creem.io` |
| **Live** (production) | `creem_`      | `https://api.creem.io`      |

**Always start with test mode.** Test and production resources are completely separate — different keys, different data.

### Endpoints (29 total)

| Resource          | Endpoints                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Checkouts**     | `POST /v1/checkouts` (create), `GET /v1/checkouts` (retrieve)                                                                                     |
| **Products**      | `POST /v1/products` (create), `GET /v1/products` (get), `GET /v1/products/search` (list)                                                          |
| **Customers**     | `GET /v1/customers` (get by ID or email), `GET /v1/customers/list` (list), `POST /v1/customers/billing` (portal link)                             |
| **Subscriptions** | `GET /v1/subscriptions` (get), `POST /v1/subscriptions/{id}` (update), `POST .../cancel`, `POST .../pause`, `POST .../resume`, `POST .../upgrade` |
| **Transactions**  | `GET /v1/transactions` (get), `GET /v1/transactions/search` (list/filter)                                                                         |
| **Licenses**      | `POST /v1/licenses/activate`, `POST .../validate`, `POST .../deactivate`                                                                          |
| **Discounts**     | `POST /v1/discounts` (create), `GET /v1/discounts` (get), `DELETE /v1/discounts/{id}/delete`                                                      |
| **Affiliates**    | `GET /v1/affiliates` (list), `GET /v1/affiliates/{id}` (get), `GET .../commissions`, `POST /v1/affiliates/invites` (invite), `GET .../invites`    |

> Full endpoint specs: <https://docs.creem.io/api-reference>

### Prices

All prices are in **cents**. 1999 = $19.99. Supported currencies: `USD`, `EUR`.

### Error Responses

```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": 400,
  "error": "Bad Request",
  "message": ["The 'product_id' field is required."],
  "timestamp": 1706889600000
}
```

Include `trace_id` in support requests. The `message` array contains specific validation errors.

---

## SDKs

| SDK                | Package                 | Use case                                                                 |
| ------------------ | ----------------------- | ------------------------------------------------------------------------ |
| TypeScript Core    | `creem`                 | Full API coverage, all 24 endpoints, standalone functions, tree-shakable |
| TypeScript Wrapper | `creem_io`              | Simplified API, webhook verification, access grant/revoke callbacks      |
| Next.js Adapter    | `@creem_io/nextjs`      | React components, route handlers, lifecycle hooks                        |
| Better Auth Plugin | `@creem_io/better-auth` | Auth framework integration, subscription sync, trial abuse prevention    |

### SDK Initialization

```typescript
// Core SDK
import { Creem } from "creem";
const creem = new Creem({
  apiKey: process.env.CREEM_API_KEY!,
  serverIdx: 0, // 0 = production, 1 = test
});

// Wrapper SDK
import { createCreem } from "creem_io";
const creem = createCreem({
  apiKey: process.env.CREEM_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
  testMode: false,
});
```

---

## Integration Flows

These are the core flows for integrating Creem into an application. Each flow shows both CLI and SDK approaches.

### Flow 1: Sell a product (one-time or subscription)

**Step 1 — Create a product**

```bash
# CLI
creem products create \
  --name "Pro Plan" \
  --description "Monthly pro subscription with all features" \
  --price 1999 \
  --currency USD \
  --billing-type recurring \
  --billing-period every-month \
  --tax-category saas
```

```typescript
// SDK
const product = await creem.products.create({
  name: "Pro Plan",
  description: "Monthly pro subscription with all features",
  price: 1999,
  currency: "USD",
  billingType: "recurring",
  billingPeriod: "every-month",
});
```

| Product option  | Values                                                                |
| --------------- | --------------------------------------------------------------------- |
| `billingType`   | `onetime`, `recurring`                                                |
| `billingPeriod` | `every-month`, `every-three-months`, `every-six-months`, `every-year` |
| `taxCategory`   | `saas`, `digital-goods-service`, `ebooks`                             |
| `taxMode`       | `inclusive`, `exclusive`                                              |

**Step 2 — Create a checkout session**

```bash
# CLI
creem checkouts create --product prod_XXXXX --success-url https://app.com/welcome
```

```typescript
// SDK
const checkout = await creem.checkouts.create({
  productId: "prod_XXXXX",
  successUrl: "https://app.com/welcome",
  customer: { email: "user@example.com" },
  metadata: { userId: "user_123" },
  discountCode: "LAUNCH20",
});
// Redirect user to checkout.checkoutUrl
```

Checkout supports up to 3 custom fields, a discount code, pre-filled customer info, and arbitrary metadata that flows through to webhooks.

**Step 3 — Handle payment completion**

Option A: **Webhooks** (recommended for production)

Register a webhook endpoint in the dashboard and handle the `checkout.completed` event. For subscriptions, use `subscription.paid` to grant access and `subscription.expired` to revoke it. See the [Webhooks section](#webhooks) below.

Option B: **Polling** (simple scripts or CLI workflows)

```bash
# Check if the checkout completed
creem checkouts get chk_XXXXX --json | jq '.status'

# List recent transactions
creem transactions list --product prod_XXXXX --json
```

**Step 4 — Grant access in your application**

After receiving a `checkout.completed` or `subscription.paid` webhook, use the `metadata.referenceId` to map the payment to your internal user and grant access.

### Flow 2: Manage subscription lifecycle

```bash
# List active subscriptions
creem subscriptions list --status active --json

# Get details
creem subscriptions get sub_XXXXX --json

# Cancel at period end (preferred — customer retains access until billing period ends)
creem subscriptions cancel sub_XXXXX --mode scheduled

# Cancel immediately
creem subscriptions cancel sub_XXXXX

# Pause billing
creem subscriptions pause sub_XXXXX

# Resume billing
creem subscriptions resume sub_XXXXX
```

```typescript
// SDK: Update seats
await creem.subscriptions.update("sub_XXXXX", {
  items: [{ id: "item_XXXXX", units: 5 }],
  updateBehavior: "proration-charge-immediately",
});

// SDK: Upgrade plan
await creem.subscriptions.upgrade("sub_XXXXX", {
  productId: "prod_premium",
  updateBehavior: "proration-charge-immediately",
});
```

Proration options: `proration-charge-immediately`, `proration-charge` (next cycle), `proration-none`.

Subscription statuses: `active`, `trialing`, `paused`, `past_due`, `expired`, `canceled`, `scheduled_cancel`.

### Flow 3: License key management

License keys are auto-generated when a customer purchases a product configured with licensing. Keys appear in the order confirmation, email receipt, and customer portal.

```typescript
// Activate a license on a device
const license = await creem.licenses.activate({
  key: "ABC123-XYZ456-XYZ456-XYZ456",
  instanceName: "Production Server",
});

// Validate a license
const valid = await creem.licenses.validate({
  key: "ABC123-XYZ456-XYZ456-XYZ456",
  instanceId: "inst_XXXXX",
});
// valid.status: "active" | "inactive" | "expired" | "disabled"

// Deactivate (free up an activation slot)
await creem.licenses.deactivate({
  key: "ABC123-XYZ456-XYZ456-XYZ456",
  instanceId: "inst_XXXXX",
});
```

Configure activation limits and expiration periods in the dashboard per product.

### Flow 4: Customer support

```bash
# Look up customer
creem customers get --email customer@example.com --json

# Check their subscriptions
creem subscriptions list --status active --json

# Send them a billing portal link (self-service for payment methods, invoices, downloads)
creem customers billing cust_XXXXX

# Debug a payment issue
creem transactions get txn_XXXXX --json

# Cancel with grace period
creem subscriptions cancel sub_XXXXX --mode scheduled
```

### Flow 5: Discount codes

```bash
# CLI: Create a discount
# (Use the SDK or API — the CLI does not have a discounts command yet)
```

```typescript
// SDK
const discount = await creem.discounts.create({
  name: "Launch Sale",
  code: "LAUNCH20",
  type: "percentage",
  percentage: 20,
  duration: "forever", // 'forever' | 'once' | 'repeating'
  maxRedemptions: 100,
  appliesToProducts: ["prod_XXXXX"],
});

// Apply at checkout
const checkout = await creem.checkouts.create({
  productId: "prod_XXXXX",
  discountCode: "LAUNCH20",
  successUrl: "https://app.com/welcome",
});
```

---

## Webhooks

Webhooks deliver real-time event notifications to your server. Register endpoints in [Dashboard > Developers](https://creem.io/dashboard).

### Events

| Event                           | When                                 | Access impact     |
| ------------------------------- | ------------------------------------ | ----------------- |
| `checkout.completed`            | Payment succeeded                    | —                 |
| `subscription.active`           | New subscription started             | —                 |
| `subscription.paid`             | Recurring payment collected          | **Grant access**  |
| `subscription.trialing`         | Trial started                        | **Grant access**  |
| `subscription.canceled`         | Subscription terminated              | —                 |
| `subscription.scheduled_cancel` | Cancellation queued for period end   | —                 |
| `subscription.past_due`         | Payment failed, retrying             | —                 |
| `subscription.expired`          | Billing period ended without payment | **Revoke access** |
| `subscription.paused`           | Subscription paused                  | **Revoke access** |
| `subscription.update`           | Subscription modified                | —                 |
| `refund.created`                | Refund processed                     | —                 |
| `dispute.created`               | Chargeback initiated                 | —                 |
| `customer_credits.exhausted`    | Customer's prepaid credits ran out (once per exhaustion, not per declined charge) | —                 |

### Signature verification

Webhooks are signed with HMAC-SHA256. Verify the `creem-signature` header against the raw request body using your webhook secret.

```typescript
import * as crypto from "crypto";

function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const computed = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}
```

### Retry behavior

Failed deliveries (non-200 responses) are retried: **30s → 1m → 5m → 1h**. Webhooks can also be manually resent from the dashboard.

### SDK webhook handlers

The SDKs provide convenience wrappers with `onGrantAccess` / `onRevokeAccess` callbacks:

```typescript
// Next.js App Router — app/api/webhook/creem/route.ts
import { Webhook } from "@creem_io/nextjs";

export const POST = Webhook({
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  onGrantAccess: async ({ customer, metadata }) => {
    const userId = metadata?.referenceId as string;
    await db.user.update({ where: { id: userId }, data: { hasAccess: true } });
  },
  onRevokeAccess: async ({ customer, metadata }) => {
    const userId = metadata?.referenceId as string;
    await db.user.update({ where: { id: userId }, data: { hasAccess: false } });
  },
  onCheckoutCompleted: async ({ customer, product }) => {
    console.log(`${customer.email} purchased ${product.name}`);
  },
});
```

```typescript
// creem_io wrapper — Express, Fastify, Hono, etc.
await creem.webhooks.handleEvents(body, signature, {
  onGrantAccess: async (context) => {
    /* ... */
  },
  onRevokeAccess: async (context) => {
    /* ... */
  },
  onCheckoutCompleted: async (data) => {
    /* ... */
  },
  onSubscriptionCanceled: async (data) => {
    /* ... */
  },
  onSubscriptionPastDue: async (data) => {
    /* ... */
  },
  onRefundCreated: async (data) => {
    /* ... */
  },
  onDisputeCreated: async (data) => {
    /* ... */
  },
});
```

> `onGrantAccess` fires for: `subscription.active`, `subscription.trialing`, `subscription.paid` > `onRevokeAccess` fires for: `subscription.paused`, `subscription.expired`

### Webhook payload structure

```json
{
  "id": "evt_xxxxx",
  "eventType": "checkout.completed",
  "created_at": 1728734325927,
  "object": {
    /* event-specific payload */
  }
}
```

> Full webhook reference: <https://docs.creem.io/code/webhooks>

---

## Framework Integration

### Next.js (`@creem_io/nextjs`)

```bash
npm install @creem_io/nextjs
```

**Checkout route + component:**

```typescript
// app/checkout/route.ts
import { Checkout } from "@creem_io/nextjs";

export const GET = Checkout({
  apiKey: process.env.CREEM_API_KEY!,
  testMode: process.env.NODE_ENV !== "production",
  defaultSuccessUrl: "/thank-you",
});
```

```tsx
// Component
import { CreemCheckout } from "@creem_io/nextjs";

<CreemCheckout
  productId="prod_XXXXX"
  customer={{ email: session.user.email }}
  successUrl="/dashboard"
  referenceId={session.user.id}
  metadata={{ source: "web" }}
>
  <button>Subscribe</button>
</CreemCheckout>;
```

**Customer portal:**

```tsx
import { CreemPortal } from "@creem_io/nextjs";

<CreemPortal customerId="cust_XXXXX">Manage Billing</CreemPortal>;
```

### Better Auth (`@creem_io/better-auth`)

```bash
npm install @creem_io/better-auth
```

**Server:**

```typescript
import { betterAuth } from "better-auth";
import { creem } from "@creem_io/better-auth";

export const auth = betterAuth({
  database: {
    /* your database config */
  },
  plugins: [
    creem({
      apiKey: process.env.CREEM_API_KEY!,
      webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
      testMode: true,
      defaultSuccessUrl: "/success",
      persistSubscriptions: true,
      onGrantAccess: async ({ reason, product, customer, metadata }) => {
        const userId = metadata?.referenceId as string;
        await db.user.update({
          where: { id: userId },
          data: { hasAccess: true },
        });
      },
      onRevokeAccess: async ({ reason, product, customer, metadata }) => {
        const userId = metadata?.referenceId as string;
        await db.user.update({
          where: { id: userId },
          data: { hasAccess: false },
        });
      },
    }),
  ],
});
```

**Client:**

```typescript
import { createAuthClient } from "better-auth/react";
import { creemClient } from "@creem_io/better-auth/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [creemClient()],
});

// Create checkout
const { data } = await authClient.creem.createCheckout({
  productId: "prod_XXXXX",
  successUrl: "/dashboard",
});
if (data?.url) window.location.href = data.url;

// Check access
const { data } = await authClient.creem.hasAccessGranted();
if (data?.hasAccess) {
  /* user has active subscription */
}

// Customer portal
const { data } = await authClient.creem.createPortal();
if (data?.url) window.location.href = data.url;
```

Webhook URL for Better Auth: `https://your-domain.com/api/auth/creem/webhook`

> Automatic trial abuse prevention when `persistSubscriptions: true` — each user can only receive one trial across all plans.

---

## Automation & Agentic Workflows

### Monitor subscriptions and dunning

```bash
# Find past-due subscriptions
creem subscriptions list --status past_due --json

# Find expired subscriptions (payment failed after retries)
creem subscriptions list --status expired --json

# Check specific subscription details
creem subscriptions get sub_XXXXX --json | jq '{status, current_period_end_date}'
```

### Revenue reporting

```bash
# Export all transactions
creem transactions list --limit 100 --json > transactions.json

# Filter by product
creem transactions list --product prod_XXXXX --json

# Filter by customer
creem transactions list --customer cust_XXXXX --json
```

### Cron job: subscription health check

```bash
#!/bin/bash
# Run daily to alert on problem subscriptions

PAST_DUE=$(creem subscriptions list --status past_due --json | jq 'length')
EXPIRED=$(creem subscriptions list --status expired --json | jq 'length')

if [ "$PAST_DUE" -gt 0 ] || [ "$EXPIRED" -gt 0 ]; then
  echo "Alert: $PAST_DUE past_due, $EXPIRED expired subscriptions"
  # Send notification (Slack, email, etc.)
fi
```

### Bulk checkout generation

```bash
#!/bin/bash
# Generate checkout links for a list of products

for PRODUCT_ID in prod_AAA prod_BBB prod_CCC; do
  URL=$(creem checkouts create --product "$PRODUCT_ID" --json | jq -r '.checkout_url')
  echo "$PRODUCT_ID: $URL"
done
```

### Programmatic access control (webhook-driven)

The recommended pattern for SaaS access control:

1. Pass `referenceId` (your internal user ID) when creating checkouts
2. Handle `subscription.paid` webhook → grant access using `metadata.referenceId`
3. Handle `subscription.expired` / `subscription.paused` → revoke access
4. Handle `subscription.canceled` → revoke access (or keep until period end if `scheduled_cancel`)

This decouples your billing from your auth system — Creem manages the payments, your app manages the access.

---

## CLI Installation

### Homebrew (macOS/Linux)

```bash
brew tap armitage-labs/creem
brew install creem
```

Verify: `creem --version`

---

## CLI Authentication

```bash
# Login (auto-detects environment from key prefix)
creem login --api-key creem_test_YOUR_KEY_HERE

# Verify
creem whoami

# Logout
creem logout
```

**CRITICAL:** Only ever hand your API key to the Creem CLI or API — never to any other service or tool. A coding agent may receive a **test** key (`creem_test_`) for the sole purpose of running `creem login`, which is what the sandbox's setup prompt does; a live key never leaves your machine. Keys are stored locally at `~/.creem/config.json`.

---

## CLI Command Reference

### Products

```bash
creem products list                          # List all products
creem products list --page 2 --limit 10      # Paginate
creem products get prod_XXXXX                # Get product details
creem products create --name "..." \         # Create a product
  --description "..." \
  --price 1999 \
  --currency USD \
  --billing-type recurring \
  --billing-period every-month
```

### Customers

```bash
creem customers list                         # List all customers
creem customers get cust_XXXXX               # Get by ID
creem customers get --email user@example.com # Get by email
creem customers billing cust_XXXXX           # Generate billing portal link
```

### Subscriptions

```bash
creem subscriptions list                     # List all subscriptions
creem subscriptions list --status active     # Filter by status
creem subscriptions get sub_XXXXX            # Get details
creem subscriptions cancel sub_XXXXX         # Cancel immediately
creem subscriptions cancel sub_XXXXX --mode scheduled  # Cancel at period end
creem subscriptions pause sub_XXXXX          # Pause billing
creem subscriptions resume sub_XXXXX         # Resume billing
```

### Checkouts

```bash
creem checkouts create --product prod_XXXXX  # Create checkout session
creem checkouts get chk_XXXXX                # Get checkout details
```

### Transactions

```bash
creem transactions list                      # List all (newest first)
creem transactions list --limit 50           # More results per page
creem transactions list --customer cust_XXXXX  # Filter by customer
creem transactions list --product prod_XXXXX   # Filter by product
creem transactions get txn_XXXXX             # Get transaction details
```

### Configuration

```bash
creem config show                            # View all settings
creem config set environment live            # Switch to live mode
creem config set environment test            # Switch to test mode
creem config set output_format json          # Default output as JSON
creem config set output_format table         # Default output as table
creem config get environment                 # Check current environment
creem config list                            # List all config keys
```

---

## Interactive Mode

Run a resource command without a subcommand to launch an interactive browser:

```bash
creem products
creem customers
creem subscriptions
creem transactions
```

Keys: arrow keys to navigate, Enter to view details, `:` to open the command bar, `q` to exit.

---

## Output Formats

Every CLI command supports table (default) and JSON:

```bash
# Per-command
creem products list --json
creem customers get cust_XXXXX --json

# Global default
creem config set output_format json
```

**Agents should use `--json`** and parse with `jq`:

```bash
creem products list --json | jq '.[].id'
creem customers get cust_XXXXX --json | jq '.email'
creem subscriptions list --status active --json | jq 'length'
```

---

## Going Live

### Account verification

Before accepting live payments, your account needs verification:

1. Go to the [Creem Dashboard](https://creem.io/dashboard)
2. Navigate to **Balances** in the sidebar
3. Click on **Payout Account**
4. Complete **KYC** (identity verification for individuals) or **KYB** (business verification for companies)
5. Provide details about the product you are selling

Verification is straightforward and typically fast. Once approved, switch to live mode.

### Switch from test to live

```bash
creem login --api-key creem_LIVE_KEY_HERE
```

The environment switches automatically based on the key prefix. For SDKs, change `testMode: false` or `serverIdx: 0`.

---

## Store Monitoring (Heartbeat)

If your human already has a Creem store — or once they've set one up — you can provide ongoing value by monitoring their store and keeping them informed about what's happening with their business.

This works regardless of your context. You don't need to be in a codebase. You don't need to be a coding assistant. Any agent with access to the Creem CLI or API can run the heartbeat.

### What monitoring provides

When monitoring is active, you periodically check your human's Creem store and notify them about:

- **New sales** — Every transaction, so they know revenue is coming in
- **New customers** — Growth signals worth celebrating
- **Subscription cancellations** — Churn alerts that may need follow-up
- **Payment failures** — Subscriptions at risk of expiring
- **Subscription upgrades** — Customers moving to higher plans
- **Anomalies** — Sudden spikes in cancellations or unusual patterns

### When to offer monitoring

Offer monitoring when any of these are true:

- Your human mentions they have a Creem store or account
- You notice a Creem API key in their environment or config
- They've just finished integrating Creem and have products live
- They ask about tracking sales or business metrics
- You're a personal assistant or operations agent with ongoing access to your human

**How to ask:**

> "I can monitor your Creem store and notify you when new sales come in, subscriptions change, or there are payment issues. Would you like me to set that up? I'll check every few hours and only notify you when something meaningful happens."

If they agree:

1. Fetch the heartbeat guide: `https://creem.io/HEARTBEAT.md`
2. Make sure they have a Creem API key (from [Dashboard > API Keys](https://creem.io/dashboard/api-keys)) or the CLI installed
3. Follow the setup instructions to create the state file
4. Run the first heartbeat to establish a baseline
5. Report the initial snapshot to your human
6. Schedule periodic heartbeats at the agreed frequency

### Quick setup

```bash
# Save the heartbeat guide locally
mkdir -p ~/.creem/skills
curl -s https://creem.io/HEARTBEAT.md > ~/.creem/skills/HEARTBEAT.md

# Initialize the state file
mkdir -p ~/.creem
cat > ~/.creem/heartbeat-state.json << 'EOF'
{
  "lastCheckAt": null,
  "lastTransactionId": null,
  "transactionCount": 0,
  "customerCount": 0,
  "subscriptions": {
    "active": 0,
    "trialing": 0,
    "past_due": 0,
    "paused": 0,
    "canceled": 0,
    "expired": 0,
    "scheduled_cancel": 0
  },
  "knownSubscriptions": {}
}
EOF
```

Then follow the heartbeat routine in [HEARTBEAT.md](https://creem.io/HEARTBEAT.md) on your preferred schedule.

### Monitoring with the CLI

If the Creem CLI is installed (`creem whoami` to check):

```bash
# Check recent transactions
creem transactions list --limit 20 --json

# Check subscription health
creem subscriptions list --status active --json
creem subscriptions list --status past_due --json

# List customers
creem customers list --json
```

### Monitoring with the API

If you don't have the CLI — or you're an agent without shell access (e.g., running in Slack or a chat environment) — use direct API calls:

```bash
# Check recent transactions
curl -s "https://api.creem.io/v1/transactions/search?limit=20" \
  -H "x-api-key: YOUR_API_KEY"

# Check active subscriptions
curl -s "https://api.creem.io/v1/subscriptions/search?status=active" \
  -H "x-api-key: YOUR_API_KEY"

# Check for payment issues
curl -s "https://api.creem.io/v1/subscriptions/search?status=past_due" \
  -H "x-api-key: YOUR_API_KEY"

# List customers
curl -s "https://api.creem.io/v1/customers/list" \
  -H "x-api-key: YOUR_API_KEY"
```

The full heartbeat routine with state tracking, change detection, and notification rules is documented in [HEARTBEAT.md](https://creem.io/HEARTBEAT.md).

---

## Tips for Agents

### Context awareness
- **Figure out what your human needs first.** Don't assume they want to integrate code. They might want an overview, help managing an existing store, or monitoring. Refer to the [What Should You Do?](#what-should-you-do) section above.
- **Ask questions when you're unsure.** It's always better to ask "Do you already have a Creem account?" than to guess wrong.
- **Offer store monitoring proactively.** If your human has a Creem store, suggest setting up the heartbeat. Fetch `https://creem.io/HEARTBEAT.md` and follow the routine. They'll appreciate knowing about new sales and issues without checking the dashboard.
- **Save these skill files locally.** Persist `SKILL.md` and `HEARTBEAT.md` in `~/.creem/skills/` so you can reference them without re-fetching every time.

### When working with the API or CLI
- **Always use test mode first.** Mistakes in live mode affect real customers and real money.
- **Use `--json` when processing CLI output.** Table mode is for humans, JSON is for you.
- **Prefer `--mode scheduled` for cancellations.** Immediate cancellation cuts off access instantly.
- **Prices are always in cents.** 1999 = $19.99.
- **`--description` is required** when creating products.
- **Check `creem whoami` first.** Confirm authentication and environment before running commands.
- **Don't guess IDs.** List resources first, then use actual IDs from the response.
- **Ask before destructive actions** like cancellations or switching to live mode.

### When integrating into a project
- **Use `referenceId` in checkouts** to map payments back to your internal user IDs.
- **For SDK deep dives**, fetch `https://docs.creem.io/llms-full.txt` — it has complete code examples for all 4 SDKs.
- **Ask what framework they're using** before suggesting an SDK. Creem has specific adapters for Next.js and Better Auth.

---

## Links

| Resource               | URL                                                 |
| ---------------------- | --------------------------------------------------- |
| Creem                  | <https://creem.io>                                    |
| Dashboard              | <https://creem.io/dashboard>                          |
| API keys               | <https://creem.io/dashboard/api-keys>                 |
| Documentation          | <https://docs.creem.io>                               |
| API Reference          | <https://docs.creem.io/api-reference>                 |
| Webhooks               | <https://docs.creem.io/code/webhooks>                 |
| Full docs (for agents) | <https://docs.creem.io/llms-full.txt>                 |
| Homebrew tap           | <https://github.com/armitage-labs/homebrew-creem>     |
| SDK (TypeScript Core)  | <https://www.npmjs.com/package/creem>                 |
| SDK (Wrapper)          | <https://www.npmjs.com/package/creem_io>              |
| SDK (Next.js)          | <https://www.npmjs.com/package/@creem_io/nextjs>      |
| SDK (Better Auth)      | <https://www.npmjs.com/package/@creem_io/better-auth> |

