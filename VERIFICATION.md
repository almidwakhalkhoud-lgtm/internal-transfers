# BUZZ verification report

Verified locally on 17 October 2026 (Asia/Dubai).

| Check | Result |
| --- | --- |
| ESLint, including React hooks and accessibility rules | Passed |
| Strict TypeScript | Passed |
| Unit tests | 23 passed |
| Playwright browser tests | 24 scenarios verified; 23 passed in full run, final listbox regression passed separately in 13.1 seconds after locale setup correction |
| Next.js production build | Passed |
| Dependency audit | 0 vulnerabilities |
| Production server health | HTTP 200 at `http://127.0.0.1:3100/login` |
| Database migrations | Applied |
| Original workbook integrity | SHA-256 unchanged |

The full code → TAB → description → quantity → conditional unit → next item → review → confirmation → PDF → download/WhatsApp-fallback workflow passed using actual products copied into a separate test database. Source and destination permissions, failed lookups, duplicate decisions, rapid edits, saved-draft recovery, Persian/RTL persistence and mobile containment were exercised.

Concurrent draft reservations and repeated simultaneous confirmation requests produced distinct numbers for different transfers and one saved record for duplicate confirmation requests. Authorization tests denied staff access to administrative endpoints, anonymous PDF requests and another location's unauthorized PDF requests. Invalid units, unsupported status transitions and stale product versions were rejected.

The 200-row document produced six A4 pages. All 200 item codes were extracted exactly once, in order. The quantity total was 225, with one employee signature section and one manager signature section. Pages were rendered and inspected. A separately marked barcode fixture decoded as `0012300119139`, preserving its leading zeros. A delayed PDF generated after an employee display-name change retained the name saved at confirmation. Database guards rejected edits/deletion of confirmed documents and deletion of audit records.

The test catalog contained 10,201 products. Ten exact HTTP lookups averaged **32 ms** in the final run. This is a local measurement, not a deployment latency guarantee.

The fallback test downloaded the PDF and opened the prepared WhatsApp URL in an intercepted test popup. It verified the manual-attachment instruction and retry link. Native file sharing was instrumented to verify the actual file name, MIME type and PDF bytes. No test sent a transfer document to a recipient.

Fixes validated during testing included delayed focus after product identification, focus restoration around duplicate dialogs, stale lookup cancellation, accessible form labels, barcode quiet zones, immutable saved PDFs and the employee-name snapshot used during deferred PDF generation.

The application database contains the actual 3,299-product catalog and the user's administrator account. Test accounts, barcode fixtures, synthetic performance records and test transfers remain in `buzz_test`. The bootstrap account's hash, session expiry and audit history were preserved when the local database moved to UTF-8; the old bootstrap database was not deleted.

## Forms and access update

React Hook Form now validates the standard forms and transfer review/quantities with hand-written localized errors. Browser checks cover empty/invalid code errors, Persian error messages, custom listbox keyboard use and Yekan Bakh in English. Code lifecycle tests verify administrator-chosen reusable codes, digest/verifier-only persistence, menu-based landing pages, hidden navigation plus denied direct page/API access, revocation of existing sessions, failure of replaced/revoked codes and exact user-ID transfer filtering. Mobile entry uses touch-sized item cards, skeleton loading and reduced-motion-aware transitions.

## Typography, navigation and custom calendar update

Desktop secondary text increased by 3px through a shared token; navigation is at least 15px and field labels at least 13px. Browser and visual checks covered desktop transfer entry and mobile menu dismissal through outside clicks and Escape, including RTL positioning. Custom Gregorian calendars replace all browser date inputs on transfer entry and date filters. Checks selected 31 January 2024, used PageDown to reach 29 February 2024, confirmed focus return and ISO draft persistence, cleared history filters, dismissed by Escape/backdrop and inspected Persian calendar layout. The existing 20 workflow scenarios passed after the UI changes; the two new scenarios passed after test label/RTL corrections. The scanner/dropdown check was also repeated successfully. Next.js production build, lint and TypeScript passed. A OneDrive cache cleanup lock was handled by moving only the generated build cache into ignored output; generated QA output is excluded from TypeScript compilation.

## Dropdown, chosen-code, contrast and motion update

Listboxes now use manually controlled browser popovers in the top layer, with viewport-aware positioning, flip, resize/scroll handling and custom keyboard/selection logic. The regression check confirms that the final option is actually hit-testable outside its clipped parent card using `elementFromPoint`, selects a location, and selects a year inside the native date dialog. The resulting screenshot was visually inspected.

Administrators choose unique, reusable 8–32 character codes in create/change forms. Case-insensitive repeated login, duplicate rejection, UI replacement, old-code failure and absence of plaintext in user responses/audit records passed. Chosen codes use a private HMAC lookup digest plus bcrypt verifier; the new schema migration preserves existing accounts and existing long-code access. The production lookup key is private and must be backed up with the database (see README).

Text color values were darkened for contrast; the statistics-label check exceeds 4.5:1 against white. Continuous floating illustrations and route motion, card hover elevation and dialog/listbox transitions are present. A browser check verifies the floating animation and verifies it is disabled by reduced-motion preference. Mobile also shows the floating illustration without requiring a desktop viewport. TypeScript, lint, the production build and all 23 unit tests passed.

## Remaining operational work

- Review 1,605 source discrepancy entries covering 1,177 codes. There are 59 products with verified units; disputed or missing units remain empty.
- Register verified physical-product barcodes as needed. The workbook has no barcode column, and all website export Barcode fields were empty. Fixture barcodes were not imported into the application catalog.
- Check the actual Android/WhatsApp installation, physical scanners and printer before staff rollout. Browser HID input and the download/manual-attachment fallback were tested; physical-device delivery was not performed.
- Configure HTTPS hosting and a production PostgreSQL service when deploying. This delivery runs locally; no hosted deployment has been created.

Setup, architecture, source hashes and operational instructions are in `README.md`. Browser reports, screenshots and PDF QA files are under ignored `playwright-report/` and `output/qa/`.
