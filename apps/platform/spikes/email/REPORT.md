# Email Service spike report

Change: `option-b-cloudflare-only`, task 1.3.
Date: 2026-08-28. Operator: fullstack-engineer (build wave).
Scope of this spike: read-only investigation of Cloudflare Email Service on account `29f50b2c797dc5cd6ccd0cff405adb43`.
No account change was made. No test email was sent. Both blockers sit before the enable step, see "Blockers".

## Summary

The Email Service cannot be enabled today. The zone `erametsad.ee` is not a Cloudflare zone. Its nameservers run at Zone Media, and the domain has live mail there. Email Service requires Cloudflare DNS. The API token also lacks the permissions for Email Sending and Email Routing. The send API itself fits the project needs once these gaps are closed.

## State found

Wrangler 4.127.0 authenticates with a User API Token from `CLOUDFLARE_API_TOKEN`. The variable is defined in `.env` at the repo root and in `apps/platform/.env`. A plain shell does not inherit it. Run API calls through `pnpm exec wrangler`, or source an `.env` file first.

Resources that match the design doc, verified by API:

| Resource     | Value                                           | Verified with                                      |
| ------------ | ----------------------------------------------- | -------------------------------------------------- |
| Queue        | `eametsad-jobs`                                 | `GET /accounts/{account_id}/queues`                |
| KV namespace | `5b67cd2c595f4d31b3b1be5db76e9bef` (title `KV`) | `GET /accounts/{account_id}/storage/kv/namespaces` |
| R2 buckets   | `eametsad-media`, `eametsad-media-preview`      | `GET /accounts/{account_id}/r2/buckets`            |

Zones the token can see (`GET /zones`): `pagepocket.app`, `painsignal.app`, `seoweb.ee`, `ww0.dev`. All are active. `erametsad.ee` is not among them.

Public DNS for `erametsad.ee` (`dig`):

| Record | Value                                           | Meaning                                     |
| ------ | ----------------------------------------------- | ------------------------------------------- |
| NS     | `ns.zone.eu`, `ns2.zone.ee`, `ns3.zonedata.net` | Zone Media hosts the domain, not Cloudflare |
| MX     | `10 zonemx.eu`                                  | Live mail runs on Zone Media                |
| TXT    | `"v=spf1 a mx include:_spf.zone.eu -all"`       | SPF points at Zone Media                    |

Email Service state:

- Email Sending is onboarded per zone. The API path is `POST /zones/{zone_id}/email/sending/subdomains`. The API reference lists no account-level enable endpoint.
- No sending subdomain exists, because no `erametsad.ee` zone exists to attach it to.
- Workers Paid state is unknown. `GET /accounts/{account_id}/subscriptions` returns `Authentication error` with this token.

Token scope, observed by probing (`GET /user/tokens/verify` returned `active`):

| Area                                                   | Result                                      |
| ------------------------------------------------------ | ------------------------------------------- |
| Zones read, queues, KV, R2                             | Works                                       |
| `POST /accounts/{account_id}/email/sending/send` probe | HTTP 401, code 10000 `Authentication error` |
| `GET /accounts/{account_id}/email/routing/addresses`   | Code 10000 `Authentication error`           |
| `GET /accounts/{account_id}/subscriptions`             | `Authentication error`                      |

## Actions taken

All API calls were read-only GET requests, plus DNS lookups. The one authorized account-level change was not made, because its prerequisites fail. No DNS record, zone, or account setting changed.

1. Verified the token with `GET /user/tokens/verify`. Status `active`.
2. Listed zones with `GET /zones?per_page=50`. Four zones, no `erametsad.ee`.
3. Probed `/accounts/{account_id}/email/sending`, `/email/sending/send`, `/email/sending/status`, `/email/sending/quota`, `/email/sending/domains`. All returned 401 or 404 with auth errors. The token has no Email Sending permission.
4. Read `GET /accounts/{account_id}/email/routing/addresses`. Auth error. The verified-destination list is not readable.
5. Read queues, KV namespaces, and R2 buckets. All match the design doc.
6. Ran `dig NS/MX/TXT erametsad.ee`. The zone runs at Zone Media with live mail.
7. Read the docs for Email Service: index, send-emails guide, REST API, domain configuration, limits, pricing. Pages dated 2026-06-09 to 2026-07-17.

Note on the test send: before a sending domain is onboarded, the API accepts sends only to verified destination addresses, and only from routing domains. No routing domain exists on this account. So the pre-onboarding path for `siim.liimand@gmail.com` is also closed.

## Blockers

Each blocker below stops the enable step. They were recorded instead of worked around, per the task rules.

1. The zone `erametsad.ee` is not on Cloudflare. Nameservers sit at Zone Media, and the domain carries live MX. Needed action: add the domain as a zone in the Cloudflare dashboard, then change the nameservers at the registrar (Zone Media client portal). Email Service requires Cloudflare DNS. This is a registrar change plus a DNS migration, not a dashboard toggle. Plan a mail cutover so current mail on `zonemx.eu` keeps working.
2. The token lacks Email Sending and Email Routing permissions. Needed action: edit the token at `dash.cloudflare.com/profile/api-tokens` and add `Email Sending : Edit` plus `Email Routing : Edit`. Add `Billing : Read` if scripts must check the plan state. A dedicated token for email is an option.
3. Workers Paid state is unknown. Needed action: check the plan in the dashboard under Workers and Pages, or Billing. The Email Sending beta requires Workers Paid.
4. The current daily quota is not exposed by API. The Email Sending API reference has no quota endpoint. Needed action: read the daily limit in the dashboard under `Compute > Email Service > Email Sending` after onboarding, or infer it from send responses during ramp.

## Beta terms

From the Email Service docs, pages dated 2026-06-09 to 2026-07-17:

- Email Sending is in beta and requires the Workers Paid plan. Email Routing is available on free and paid plans.
- Included volume: 3,000 outbound emails per account per month. Beyond that, $0.35 per 1,000 emails. The cycle follows the Cloudflare billing month.
- Hard bounces and accepted sends count toward the quota. Sends rejected at the API boundary do not count.
- Sends to verified destination addresses are free on all plans. They do not count toward the monthly quota or the daily limit. Before domain onboarding, these are the only allowed recipients, and the from address must be on a routing domain.
- Daily limits start low on new accounts and grow with sending behavior and account standing. A limit increase request form exists in the docs.
- Content limits: 50 recipients per email, subject line 998 characters, message size 5 MiB, or 25 MiB to verified destinations, headers 16 KB.
- Zone and routing limits: 30 email domains per zone, 200 routing rules per domain, 200 destination addresses per account, 25 MiB inbound message size.
- Compliance: CAN-SPAM, GDPR, CASL, plus working unsubscribe handling.
- Domain onboarding adds MX, SPF, and DKIM records on `cf-bounce.<domain>` and a DMARC record on `_dmarc.<domain>`. Email Routing adds MX, SPF, and DKIM on the root domain. These records lock after onboarding.
- Email preview stores sent messages for about seven days. It turns on by default for new sending domains.

## Send interfaces, for later use

- REST: `POST /accounts/{account_id}/email/sending/send`. Body fields `to`, `from`, `subject`, `html`, `text`, plus `attachments` and custom `headers`. The response carries `delivered`, `queued`, `permanent_bounces`, and `message_id`. Related endpoints: `send_raw`, suppressions CRUD at `/accounts/{account_id}/email/sending/suppressions`, sending subdomain CRUD at `/zones/{zone_id}/email/sending/subdomains`.
- SMTP: `smtps://smtp.mx.cloudflare.net:465`, user `api_token`, password the API token.
- Workers binding: `send_email` in the wrangler config with `remote = true`. Returns a `messageId` per `send()` call.

## Facts for the Phase 0 gate

- The account holds the queue, KV, and R2 resources from the design doc. The account id is correct.
- The zone `erametsad.ee` is not on Cloudflare. Sending from `noreply@erametsad.ee` needs a zone move, a nameserver change at Zone Media, and a mail cutover. The live MX at `zonemx.eu` makes this a migration with downtime risk, not a toggle.
- Workers Paid must be confirmed before the beta can be enabled at all.
- The token needs new permissions before any email automation can run from CI.
- Cost fits the plan: 3,000 emails per month are included, and transactional volume for the auction portal stays well under that. The ramped daily quota on new accounts is the main launch-day risk.
- The send API returns per-recipient delivery status and a message id. Suppression and bounce handling are built in. No extra provider is needed once the zone and plan questions are settled.

## Prototype rescope (ww0.dev)

Date: 2026-08-28. This is a re-run of task 1.3 under the rescope in the
design addendum "Addendum: prototype domain strategy". The prototype does
not use `erametsad.ee`. All prototype email moves to the `ww0.dev` zone.

### Prototype hostnames

| Role | Prototype host | Production host |
| ---- | ------------------------------ | ----------------------- |
| Marketing | `erametsad.ww0.dev` | `eametsad.ee` |
| Portal | `oksjonid.erametsad.ww0.dev` | `oksjonid.eametsad.ee` |
| API | `api.erametsad.ww0.dev` | `api.eametsad.ee` |
| Admin | `admin.erametsad.ww0.dev` | `admin.eametsad.ee` |

No placeholder DNS records were created for these web hostnames. Workers
custom domains attach at deploy time. A pre-existing record on the same name
blocks attachment. Only the email sending subdomain can hold records, and
onboarding creates them.

### Zone

`GET /zones?name=ww0.dev` returned one active zone:

| Field | Value |
| ---- | -------------------------------- |
| Zone name | `ww0.dev` |
| Zone id | `8761a52640daef70b6cf6f14d38e6dd9` |
| Status | `active` |

Sending subdomain for onboarding: `erametsad`. The prototype sender is
`noreply@erametsad.ww0.dev`.

### Probe results

The token in `CLOUDFLARE_API_TOKEN` is active (`GET /user/tokens/verify`,
HTTP 200). Zone list read works. Email endpoints still fail:

| Endpoint | Result |
| ---- | ------ |
| `GET /zones/{zone_id}/email/sending/subdomains` | HTTP 403, code 10000 `Authentication error` |
| `GET /accounts/{account_id}/email/sending/domains` | HTTP 404, code 10001 `Unable to authenticate request` |
| `GET /accounts/{account_id}/email/sending/quota` | HTTP 404, code 10001 `Unable to authenticate request` |
| `GET /accounts/{account_id}/email/sending/status` | HTTP 404, code 10001 `Unable to authenticate request` |
| `GET /accounts/{account_id}/email/routing/addresses` | HTTP 403, code 10000 `Authentication error` |
| `GET /accounts/{account_id}/subscriptions` | HTTP 403, code 10000 `Authentication error` |
| `GET /zones/{zone_id}/dns_records` | HTTP 403, code 10000 `Authentication error` |

The token reads the zone list but cannot read DNS records on `ww0.dev`. So
the token also lacks `DNS : Read` on this zone. Public DNS checks with `dig`
need no API access. They stay available for record verification.

### Actions taken

Read-only GET requests only. No onboarding POST, no DNS change, no account
change, no email sent. The token value was not printed and is not stored in
this report. Endpoints used:

1. `GET /zones?name=ww0.dev`
2. `GET /user/tokens/verify`
3. `GET /zones/8761a52640daef70b6cf6f14d38e6dd9/email/sending/subdomains`
4. `GET /accounts/29f50b2c797dc5cd6ccd0cff405adb43/email/sending/domains`
5. `GET /accounts/29f50b2c797dc5cd6ccd0cff405adb43/email/sending/quota`
6. `GET /accounts/29f50b2c797dc5cd6ccd0cff405adb43/email/sending/status`
7. `GET /accounts/29f50b2c797dc5cd6ccd0cff405adb43/email/routing/addresses`
8. `GET /accounts/29f50b2c797dc5cd6ccd0cff405adb43/subscriptions`
9. `GET /zones/8761a52640daef70b6cf6f14d38e6dd9/dns_records?per_page=5`

### Enablement, send, quota

Not done. The enablement step stopped at the permission check, under the
task rules. The daily quota stays unreadable until the token reaches the
email endpoints after onboarding.

### Remaining blockers

1. The token lacks email permissions. Add `Email Sending : Edit` and
   `Email Routing : Edit` for the `ww0.dev` zone at
   `dash.cloudflare.com/profile/api-tokens`. Add `DNS : Read` on `ww0.dev`
   if record checks must use the API.
2. Workers Paid state stays unknown. `GET /accounts/{account_id}/subscriptions`
   still returns code 10000. Check the plan in the dashboard, or add
   `Billing : Read` to the token.
3. After the permissions are fixed, re-run this task: onboard the
   `erametsad` subdomain on zone `8761a52640daef70b6cf6f14d38e6dd9`, check
   SPF and DKIM with `dig`, send one test email to `siim.liimand@gmail.com`,
   and record the daily quota.
