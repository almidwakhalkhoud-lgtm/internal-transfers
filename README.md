# BUZZ — Internal Inventory Transfers

Next.js App Router, strict TypeScript, PostgreSQL and Prisma application for MEHDI ALI TRADING Co. The supplied BUZZ logo and Yekan Bakh web fonts are used locally. English and Persian interfaces support LTR/RTL layouts.

## Current local installation

- Application: `http://127.0.0.1:3100`
- PostgreSQL: `127.0.0.1:54329`; the configured application database is `buzz_utf8`.
- Real catalog: **3,299 products**; **59** have units that passed the source checks.
- Administrator: your original administrator account and active session have been preserved in the final UTF-8 database. Sign in using the credentials you chose. No default password exists.
- For a fresh installation without an administrator, `npm run setup` creates a private one-time URL in `.postgres/admin-setup-link.txt`. The token and link are removed after provisioning.

The application uses PostgreSQL for users, sessions, catalog records, drafts, confirmed transfers, PDF bytes, approval history and audit records. Browser storage is not the source of truth.

## Forms, access codes and menu permissions

Standard forms share React Hook Form registration (custom named dropdowns use Controller through FormProvider) with explicit English/Persian validation messages and inline accessible errors. Transfer review uses an RHF resolver and quantity entry uses RHF field validation, while the authenticated server independently validates every final document and administrative write. Native browser validation popups are disabled. Desktop small text is enlarged by a shared typography token. The mobile navigation closes on outside clicks or Escape. A custom Gregorian calendar replaces browser date pickers for transfer dates and history filters; it supports month/year selection, Today, clearing filters, arrow/Home/End/PageUp/PageDown navigation and leap-year-safe month changes. Custom coded listboxes use the browser top layer to escape clipped cards and transformed ancestors, while retaining custom UI and keyboard behavior. They support arrows, Home/End, typing, Enter, Escape and Tab. Yekan Bakh applies to both languages. Loading skeletons, reduced-motion-aware floating transitions and touch-sized mobile item cards are included.

Administrators choose each user's reusable access code in **Create user** or **Manage access code**. Codes contain 8–32 ASCII letters, digits, hyphens or underscores and ignore letter case. They remain valid until explicitly changed or revoked; they are not one-time passwords. Existing long random codes continue working until replaced. Codes are never stored or returned as plaintext. A private server HMAC key provides the unique lookup digest, and bcrypt cost 12 verifies chosen codes. Replacement, revocation, deactivation and location/menu changes terminate existing sessions. Login and replacement serialize on the user row to prevent an old code from creating a session after revocation. Login attempts are limited; unknown codes share bounded time buckets rather than creating arbitrary database rows.

The private lookup key is generated locally in ignored `.postgres/access-code-pepper`. Back it up securely with the database and use the same key on every application instance. Test runs use a separate ignored key. Never commit or share either file.

The original first administrator can still use the initial administrator sign-in until their first access code is assigned. After assigning a code this password path is disabled, including after code revocation. New users, including newly created administrators, use codes. Do not revoke your own only usable code without another active administrator available to issue a replacement.

Under **Users → Edit**, administrators select the user's source/destination locations and allowed workspace menus. Both page routes and API endpoints enforce these permissions. Administrators retain full administrative access. A new-transfer-only user can retrieve the exact product and authorized PDF needed for confirmation without gaining general product browsing or transfer-history access. **User transfers** opens history filtered by that exact user ID, with routes, totals, approval states and document detail links.

## Source reconciliation

`ITEMS.xls` contains 3,278 data rows. **3,277 valid records** were imported. An additional row for code `3277` has an empty description and was excluded; the valid record was retained. The original workbook is unchanged, verified using SHA-256:

```text
48e2a178ac973656f1c2852ca0f5c3166e0e67f87872838b3f83f5a872400e8d
```

After the user signed in personally to `https://mehdiali.om`, read-only exports were downloaded for all four available store selections:

| Store selection | Exported rows |
| --- | ---: |
| Order, with All Stores and all activity states | 1,236 |
| HyperMarket, all activity states | 816 |
| VAN SALES STORE, all activity states | 226 |
| SMOKING, all activity states | 326 |

These exports overlap; their row counts must not be added as unique product counts. Matching uses exact codes. Website `Name` supplies the product name; the website's `Description` field contains pricing information and is not substituted for the workbook's product description. Only the explicit `Units` field supplies units. No packaging strings are interpreted as units and no unit conversions occur.

The imports added **22** website products. There are **1,605 source-review entries covering 1,177 distinct codes**. Disputed values are preserved for administrator review under Products. Unit candidates on conflicting records are held back. The administrator sees both the current catalog value and original/proposed source values. Applying a proposal checks the current record version, so another administrator's changes cannot be silently overwritten.

**The workbook has no barcode column, and every Barcode field in the downloaded website exports is empty. No physical-product barcodes were invented or inferred from descriptions.** Verified barcodes can be registered through administrator product editing. Code and barcode lookup and barcode PDF output are implemented; barcode edge cases use explicitly marked fixtures only in the test database.

Source exports are kept in ignored `data/sources/`. Source hashes, import counts and the incomplete row are recorded in `data/reconciliation-report.json`; final catalog counts are in `data/catalog-validation.json`. The audit log also records initial reconciliation and held unit candidates. The original workbook, reference PDF, font source directory and source exports are excluded from Git.

## Daily workflow

1. Select different source and destination locations and a transfer date.
2. Enter an exact item code or a registered barcode and press TAB or Enter. An unsuccessful lookup keeps focus on the code field.
3. Enter a positive quantity with up to three decimal places. TAB moves to the valid unit selection when defined, or directly to the next row when no unit is defined.
4. Review duplicate products explicitly. Either return to the existing quantity to update it, or keep a separate line.
5. Save a draft to PostgreSQL if needed. Saved drafts can be reopened from New Transfer, and their owner can delete a saved draft (from the saved-draft list or with **Delete draft** while it is open) instead of removing every item. The deletion is audited and the reserved number is not reused.
6. Click **Confirm Transfer**. The review dialog shows the reserved number, route, line count and exact quantity total.
7. Confirm. The server validates permissions, current catalog versions, quantities and units, then persists an immutable `CONFIRMED` document in a database transaction. A UUID idempotency key prevents duplicate confirmation records. Numbers are reserved atomically when drafts are saved; abandoned drafts can leave numbering gaps.
8. The same screen immediately offers **Download PDF** and **Share via WhatsApp**, plus Preview/Print and Create another transfer. PDF generation failure leaves the confirmed transfer saved and provides a safe retry.

Confirmation is separate from approval. Every confirmed transfer initially has approval `PENDING`. Administrators can approve/reject pending records and mark approved records received. Document fields remain immutable. Corrections require a new transfer with an explicit reference in its remarks; there is no silent editing of confirmed documents. Administrators can delete a confirmed transfer from its detail page with an optional reason; the audit log keeps a full snapshot (number, route, dates, creator, approval, remarks, lines, total and PDF hash). Staff cannot delete confirmed transfers. No external stock balances or ERP records are modified.

## Requests (طلبیه)

A location that needs items from another one opens **Requests → New request**, chooses the location to ask (**Request from**) and its own location (**Deliver to**), and enters codes, quantities and units with the same keyboard flow as a new transfer. Requests are numbered `REQ-0001`, `REQ-0002`, … on their own counter.

The asked location sees the request under **Requests to us** marked *Awaiting your reply*. For each line it types the quantity it can send (it starts at the requested quantity and may be lower or higher), and marks lines it does not have as **Not available**; a line can be restored before confirming. **Save progress** keeps this without sending anything. **Confirm and create transfer** then, in one transaction, creates a normal confirmed transfer from the asked location to the requester with only the available lines and the entered quantities, takes the next number on the shared transfer counter, records `Request REQ-…` in its remarks and closes the request as *Fulfilled*. The same screen offers the PDF and WhatsApp sharing, and the transfer follows the usual approval flow. The requester sees requested and sent quantities side by side, with a link to the transfer.

Before it is fulfilled, the requester can **Cancel** a request and the asked location can **Decline** it, each with an optional reason. Only users assigned to the asked location (or administrators) can fill, save or decline; only the requester's location, its creator or administrators can cancel. Every create, fulfil, cancel and decline is audited. The **Requests** menu is granted per user under **Users → Edit**; the migration adds it to existing users who already have **New transfer**.

## PDF and WhatsApp

PDFs use a real Chromium print pipeline, not a screenshot. The template follows the supplied `MA-3210.pdf` structure: company header, transfer information, Item / Description / Quantity / Unit table, quantity total and employee/manager signature/date fields. Output is A4 with repeating table headings and page numbers. Original multilingual descriptions are preserved and Yekan Bakh is embedded. Registered printable barcodes are rendered as Code 128 with quiet zones.

PDF bytes are stored with the saved document and are protected by the same server-side access checks as transfer details. Responses are private and non-cacheable. The employee name is captured at confirmation, so delayed PDF generation cannot pick up later user-name changes. Database triggers prevent later changes to confirmed document fields or saved PDF content; audit entries are append-only. Deleting a confirmed transfer is only accepted inside the administrator delete transaction, which opts in with a transaction-local setting; direct SQL deletes remain rejected.

Where supported, the WhatsApp button passes an actual `File` with PDF bytes to the native Web Share API. The user selects WhatsApp from the device's share sheet. If file sharing is unsupported or fails, BUZZ downloads the PDF, opens WhatsApp with a prepared message, and displays a clear manual-attachment instruction. An **Open WhatsApp** link remains available if the browser blocks the popup. It never claims that the fallback has attached a PDF and never creates a public document link. Native file sharing requires HTTPS outside localhost.

## Starting and provisioning

Use Node.js 22 or later (this installation was built and tested with Node 24).

```powershell
npm ci
npx playwright install chromium
npm run db:local
```

Leave the database process running. For a fresh local installation, it generates a random database password and creates an ignored `.env` file with the database connection and application origin. It binds PostgreSQL to loopback and uses UTF-8.

In another terminal:

```powershell
npm run db:deploy
npm run setup
npm run build
npm run start
```

Open the private setup URL from `.postgres/admin-setup-link.txt` and create the administrator account. Passwords are hashed using bcrypt with cost 12. Sessions use random opaque tokens, hashed in the database, with HttpOnly/SameSite cookies and an eight-hour expiry. Login attempts are limited per account. Deactivation and credential changes revoke sessions. The initial password path is limited to the first administrator until an access code is issued.

An interactive alternative for provisioning an administrator is `npm run admin`; it accepts the password through hidden terminal input, never a command argument.

`npm run dev` starts development mode at the same application URL. Stop the application before generating Prisma on Windows, because a running process can hold the Prisma engine DLL open.

## Importing or updating data

Administrators can upload `.xls`, `.xlsx` or `.csv` files from Products, choose the worksheet, map columns, preview rows and see validation errors before applying an import. Missing units/barcodes remain empty. Alternative values may be separated with `|`; explicit exported units also accept comma separators. Conflicting updates are queued for review rather than overwriting current values. Individual descriptions, barcodes and unit lists can be edited with an audit record.

`npm run catalog:initial` is an initial-only importer for an **empty** catalog with the supplied workbook and the four authorized website export files in `data/sources/`. It runs transactionally. It is deliberately refused once products exist. Use the administrator interface for later changes. `npx tsx --env-file=.env scripts/audit-import.ts` performs a read-only catalog audit and refreshes the local validation report.

## Verification

### QBM unit evidence

`npm run qbm:inspect -- <Items.json>` audits the official QBM export without connecting to either database. The supplied 3,277-item export contains only `unitName`: 1,040 populated defaults and 2,237 blank defaults. It does **not** export subunits or their factors. `3277.json` contains only item 3277 and matches that record in the full export. Default units alone must not be presented as all available units.

The human-launched `Record QBM Units.cmd` opens a Play/Stop/resume control window, using the existing local `qbmm` project's UI Automation support. See [the recorder instructions](tools/qbm-recorder/README.md). It records exact unit menu names into a source-bound checkpoint; it does not apply catalog changes, infer conversion factors or save a QBM document. Start with the single-item export and a blank disposable document. Offline parser/checkpoint tests pass; live full-catalog capture remains unverified.

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm audit
```

The end-to-end runner creates and resets the fixed **`buzz_test`** database. It does not clear or write transfers into the application database. It reads actual product records for the real-product workflow and multi-page PDF tests. Synthetic barcode and performance fixtures are clearly marked and remain confined to the test database. Test passwords are generated per run and are not logged or hardcoded.

The browser suite covers initial administrator provisioning, staff creation/login, real product entry and conditional units, scanner Enter/TAB suffixes, leading zeros, invalid quantities/codes, duplicate decisions, confirmation, PDF download, WhatsApp fallback, native file-share payloads, permissions, CSRF, concurrent/idempotent confirmation, approval separation, database immutability, Persian/RTL persistence, import conflicts, stale catalog versions, 200-row PDF generation, a 10,000-product catalog, rapid edits, saved draft recovery mobile layout, code issuance/rotation/revocation, server menu authorization, per-user transfer filtering, manual RHF error messages, custom dropdown keyboard behavior and the English font.

PDF QA artifacts and screenshots are saved under ignored `output/qa/`. `scripts/verify-pdfs.py` checks A4 pages, nonempty output, all 200 item codes in order, the exact total, signatures and decoding of the printed fixture barcode. It requires Python with `pymupdf`, `Pillow` and `zxing-cpp`.

Native sharing is tested using an instrumented Web Share API. A physical Android device, WhatsApp recipient delivery, physical scanner hardware and an actual printer still require an operational device check. The browser download/manual-attachment fallback is tested end to end; automated tests do not send company documents to anyone.

## Deploying to Vercel

The application runs on Vercel with a hosted PostgreSQL database. The steps below keep existing accounts, access codes, transfers and PDFs.

1. **Database.** Create a PostgreSQL database (for example Neon or Supabase) in a region close to the Vercel functions. Use a direct or session-mode connection string, not a transaction-mode pooler, because confirmation uses interactive transactions.
2. **Vercel environment variables** (Project → Settings → Environment Variables, for Production and Preview):
   - `DATABASE_URL`: the hosted connection string.
   - `APP_ORIGIN`: the public address, for example `https://buzz.example.com` or `https://<project>.vercel.app`, without a trailing slash. Vercel's own deployment, branch and production domains are also accepted automatically.
   - `ACCESS_CODE_PEPPER`: the exact contents of the local `.postgres/access-code-pepper`. Without the same value, existing access codes stop working. Keep it secret.
   - `BUZZ_SETUP_TOKEN`: only for a fresh hosted install without an administrator; 64 hex characters. Open `/setup?token=<value>` once, then remove the variable.
3. **Schema.** The `vercel-build` script (`scripts/vercel-build.mjs`) runs `prisma migrate deploy` before `next build`, so each deployment applies pending migrations to `DATABASE_URL`. If `DATABASE_URL` is not set, it skips migrations with a warning and the build still succeeds, but the site cannot sign anyone in until the variable is set and the project is redeployed. Preview deployments share that database unless you give Preview a separate `DATABASE_URL`.
4. **Existing data.** After the first deployment has created the schema, copy the local data once from your computer (local database running):

   ```powershell
   $env:TARGET_DATABASE_URL="postgresql://..."; npm run db:copy
   ```

   The copy refuses a non-empty target. Sessions are not copied, so everyone signs in again. If a copy is interrupted, recreate the hosted database and run it again.
5. **Logo.** `public/logo.jpeg` is no longer ignored by Git. Commit it so the hosted site shows the logo: `git add public/logo.jpeg`.
6. **Deploy.** Merging to `main` deploys production when the repository is connected to Vercel.

On Vercel, PDFs are generated with the serverless Chromium build from `@sparticuz/chromium`; locally the Playwright Chromium is still used. The API function allows up to 60 seconds for a cold browser start.

## Production deployment

This project has been implemented and tested locally. No hosted deployment has been created. Before staff rollout, finish the administrator's source review, register verified physical barcodes where required, and complete a device check.

Use a persistent PostgreSQL database configured for UTF-8 and a Node server with the Playwright Chromium runtime. Set `DATABASE_URL` securely and set `APP_ORIGIN` to the exact public HTTPS origin without a trailing slash. Use `npm run db:deploy`, then build and start. The default Node server listens on loopback for use behind a TLS reverse proxy. Secure cookies are enabled when `APP_ORIGIN` starts with HTTPS. Keep `.env`, `.postgres` and source exports private; use normal PostgreSQL backups. The embedded PostgreSQL helper is intended for local development and evaluation.

Prisma migrations include the initial schema plus document/audit integrity guards. `db:push` is a development tool; deploy migrations for production. The local existing database has already been baselined and migrated.
