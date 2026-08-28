# eID provider port status (task 5.3)

This document records the port of `src/lib/auth/eid-provider.ts` to Cloudflare Workers. It covers the audit, the changes, and the sandbox test procedure. Change context: OpenSpec change `option-b-cloudflare-only`, task 5.3.

## Audit result

The audit looked for Node-specific APIs in `src/lib/auth/eid-provider.ts` and in the modules it imports. The file uses HTTPS through `fetch`. It does not use TCP sockets, the `path` module, `Buffer`, or CommonJS `require()`.

| API | Where | Status |
| --- | --- | --- |
| `import crypto from 'node:crypto'` for `randomUUID` | `DemoEidProvider.start` | Ported. The file now uses the Web Crypto global `crypto.randomUUID()`. Workers and Node 19 or later provide it. The repo pins Node 20 or later. |
| `process.env.EID_DEMO_ISIKUKOOD` | `getDemoIsikukoods` | Workers-compatible. The `nodejs_compat` flag is on (`wrangler.jsonc`, compat date 2025-04-01). Workerd fills `process.env` from vars and secrets. `jwt.ts` and `encryption.ts` read env the same way. |
| `hash` from `src/lib/crypto.ts` | `completeEidLogin` | Transitive dependency, left untouched (task 5.3 owns only `eid-provider.ts`). It calls the sync `createHash('sha256')` from `node:crypto`. Workerd implements `createHash`, so the code path runs on Workers. |
| In-memory `Map` for demo sessions | `DemoEidProvider` | Not a Node API. The map lives in one isolate, so a restart or a second isolate loses it. Acceptable for the demo simulator only. |
| `NextResponse.json` and `response.cookies` | `completeEidLogin` | Workers-compatible. OpenNext supports these APIs on Workers. |

No unresolvable blocker exists in this file.

## Changes made in task 5.3

1. Removed the `node:crypto` import. `DemoEidProvider.start` now calls the global `crypto.randomUUID()`.
2. Added `EidEasyProvider`. It talks to the eID Easy identity API through `fetch` and the `URL` constructor. It holds no session state, so any isolate can serve any poll or complete request.
3. `getEidProvider` now selects by environment. With `EIDEASY_CLIENT_ID` and `EIDEASY_SECRET` set, it returns `EidEasyProvider`. Without them, it returns the demo provider. All existing routes and tests keep the demo behavior.

No third-party eID SDK is installed. The guardrails name eID Easy or Signicat as the aggregator. `EidEasyProvider` replaces SDK calls with direct `fetch` requests, so no Node-internal SDK code enters the bundle.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `EIDEASY_CLIENT_ID` | Aggregator client id. Both this and the secret must be set to enable the aggregator. |
| `EIDEASY_SECRET` | Aggregator secret. |
| `EIDEASY_API_URL` | Aggregator base URL. Default: `https://id.eideasy.com`. |
| `EID_DEMO_ISIKUKOOD` | Demo mode only. Comma-separated isikukood list for the simulator. |

## What runs on Workers

- The demo simulator, the aggregator client, and `completeEidLogin` use Web-standard APIs only.
- Session tokens verify through Web Crypto. The test suite signs a session the node way, then reads the token with `verifyAccessTokenAsync` and `verifyRefreshTokenAsync` from task 5.2. Both use `crypto.subtle`.
- One dependency stays on sync `node:crypto`: the `hash` import in `completeEidLogin`. It runs under `nodejs_compat`. Follow-up: add a Web-Crypto async twin in `src/lib/crypto.ts`, in the same style as `jwt.ts` and `encryption.ts`. That file belongs to another task.

## What needs the aggregator sandbox

The eID Easy field names in `EidEasyProvider` follow their public API docs. The mock tests lock our request and response handling. Only a live sandbox run can confirm these points:

1. The endpoint paths `api/identity/start-session` and `api/identity/status`.
2. The body fields `client_id`, `secret`, `method`, `identifier`, and `session_token`.
3. The response fields `status`, `data.session_token`, `data.verification_control_code`, and `data.identifier`.
4. The method slugs `smartid`, `mobileid`, and `idcard`.

No sandbox credentials exist in this repository. The sandbox test did not run in task 5.3. A user must register an account and store the credentials.

## Sandbox login test procedure

Preconditions:

1. An eID Easy account with sandbox credentials (client id and secret). Register at `https://eideasy.com`.
2. Node 20 or later and pnpm 9 installed.
3. A sandbox test person whose identifier matches a seeded user. Run `pnpm seed:reset` from `apps/platform` first. The seed users carry the demo isikukoods.

Steps, run from `apps/platform`:

1. Create `.dev.vars` with these lines. Replace the bracketed values with your sandbox credentials.

   ```
   EIDEASY_CLIENT_ID=[your sandbox client id]
   EIDEASY_SECRET=[your sandbox secret]
   JWT_SECRET=[any long random string]
   ISIKUKOOD_ENCRYPTION_KEY=[any long random string]
   ```

2. Apply the local D1 schema and seed the demo users.

   ```
   pnpm db:migrate:local
   pnpm seed:reset
   ```

3. Build the worker and start it on localhost.

   ```
   pnpm build:cf
   pnpm exec wrangler dev
   ```

4. Start a Smart-ID session. Replace `38803160272` with a sandbox identifier from your eID Easy test account. The response holds `sessionRef` and `controlCode`.

   ```
   curl -s -X POST http://localhost:8787/api/v1/auth/smartid/start \
     -H 'content-type: application/json' \
     -d '{"isikukood": "38803160272"}'
   ```

5. Approve the request in the sandbox app or simulator. Then poll the status until it reports `completed`.

   ```
   curl -s "http://localhost:8787/api/v1/auth/smartid/status?sessionRef=SESSION_REF"
   ```

6. Complete the login. The response holds the user object and the session cookies. Make sure that the status code is 200 and that the `access_token` cookie is present.

   ```
   curl -s -X POST http://localhost:8787/api/v1/auth/smartid/complete \
     -H 'content-type: application/json' \
     -d '{"sessionRef": "SESSION_REF"}'
   ```

7. If a step fails, read the worker log output in the `wrangler dev` terminal. A 401 from the complete step means no seeded user matches the sandbox identifier.

The same procedure covers Mobile-ID and ID-card. Replace `smartid` in the URL paths with `mobileid` or `idcard`.
