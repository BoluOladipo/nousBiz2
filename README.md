This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Billing setup

The app offers Free, Premium (₦4,500/month), and Enterprise (₦9,000/month).
Free accounts can create up to 50 sales, expenses, invoices, products/services,
and customers per calendar month in Africa/Lagos time (50 of each). Premium
removes these record limits. Enterprise also supports up to 10 business
members, including the owner. Existing records remain available when a plan
changes.

### 1. Apply the Supabase migration

Install/use the Supabase CLI, sign in, link the correct Supabase project, and
push the migrations. Run these commands from the repository root in
PowerShell; replace the example project reference with your own:

```powershell
npx supabase login
$PROJECT_REF = "your-project-ref"
npx supabase link --project-ref $PROJECT_REF
npx supabase db push
```

The CLI may prompt for the database password when linking. Enter it in the
prompt; do not put it in a command, source file, or chat. Confirm the linked
project before running `db push`. This applies
`supabase/migrations/20261029000000_add_billing_and_plan_limits.sql` after
the other migrations. The database enforces Free-plan limits on inserts,
including inserts made through existing database functions.

### 2. Create Flutterwave payment plans

In the Flutterwave Dashboard, create two **monthly** payment plans in **NGN**:

| Plan | Amount | Interval |
|---|---:|---|
| NousBiz Premium | 4,500 | Monthly |
| NousBiz Enterprise | 9,000 | Monthly |

Copy each plan's numeric ID into `FLW_PREMIUM_PLAN_ID` and
`FLW_ENTERPRISE_PLAN_ID`. Flutterwave recurring payment plans require card
payments.

### 3. Configure server environment variables

Set these variables in the local, untracked `.env.local` for development and in
the deployment platform's server environment for production. Use the same
production site URL that customers visit. Never expose secret keys in
`NEXT_PUBLIC_*` variables, commit them, or send them in chat.

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=
FLW_SECRET_KEY=
FLW_PREMIUM_PLAN_ID=
FLW_ENTERPRISE_PLAN_ID=
FLW_WEBHOOK_SECRET_HASH=
```

`SUPABASE_SERVICE_ROLE_KEY` is available in the Supabase project's API
settings. `FLW_SECRET_KEY` and the webhook secret hash come from Flutterwave.
Restart the local Next.js server after changing `.env.local`.

### 4. Configure and test the webhook

In Flutterwave's webhook settings, add
`https://<your-production-domain>/api/billing/webhook`, enable charge and
subscription events, and set its secret hash to the same value as
`FLW_WEBHOOK_SECRET_HASH`. Keep the test and live Flutterwave credentials,
plan IDs, and webhook settings paired with their corresponding environment.

The app verifies checkout transactions directly with Flutterwave before
activating a plan. The signed webhook processes recurring charges and
cancellation notifications. Users manage cancellation through Flutterwave's
subscription emails. Complete a test-mode checkout for each plan and confirm
the selected plan is shown on **Plans & billing** before enabling live
payments.

Team invitations are available to Enterprise owners from **Plans & billing**.
Supabase Auth email invitations must be configured for the project.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
