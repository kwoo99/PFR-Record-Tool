# PFR Record Tool

PFR Record Tool is an internal Electron application for fetching, updating, and deleting Accounts Receivable records in a PayFabric Receivables portal. It supports individual records, semicolon-separated bulk input, and CSV-based deletion lists.

The AutoPay workspace can also load filtered customer groups, show who is or is
not scheduled for AutoPay, manage one customer's contract, and run controlled
bulk apply or remove cycles.

> Proprietary and confidential. This repository is intended for authorized internal use only.

## Get started

Requirements: Node.js 20 or newer and npm.

```sh
cd PFRRecordTool
npm ci
npm test
npm start
```

`npm run package` creates an unpacked application in `PFRRecordTool/out/`. `npm run make` creates platform-specific installers.

## Desktop builds

Create a native release artifact from `PFRRecordTool/`:

```sh
npm run make:mac
npm run make:windows
npm run make:windows:portable
```

The macOS command creates a ZIP containing the application. The Windows command
creates a Squirrel installer, update package, and release manifest. Windows
installers must be built on Windows; the repository's **Build Desktop
Installers** workflow builds Windows x64 plus macOS Apple-silicon and Intel
artifacts and keeps them available for download from the workflow run for 14
days. It does not publish a public release. The portable Windows command creates
a Windows x64 ZIP on macOS or Windows, so it can be tested without pushing the
branch or running GitHub Actions.

Unsigned builds are suitable for internal testing but can trigger macOS
Gatekeeper or Windows SmartScreen warnings on another computer. For a signed
macOS build, install a Developer ID certificate, set `PFR_MACOS_SIGN=true`, and
provide `APPLE_ID`, `APPLE_ID_PASSWORD`, and `APPLE_TEAM_ID` to notarize it. A
traditional Windows certificate can be supplied with
`PFR_WINDOWS_CERTIFICATE_FILE` and `PFR_WINDOWS_CERTIFICATE_PASSWORD`. Keep all
credentials outside the repository.

### Trusting internal Windows builds

For a small set of company-controlled Windows computers, the least expensive
option is an internal publisher certificate. It costs nothing, but its public
`.cer` file must be trusted once by each approved Windows user. Never distribute
the private `.pfx` file or commit it to Git.

On the Windows build computer, run these commands from `PFRRecordTool/`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\New-InternalCodeSigningCertificate.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\Install-InternalPublisherCertificate.ps1
npm run make:windows:signed
```

Copy only `certificates/PFRRecordTool-Internal.cer` to every other approved
computer and run `Install-InternalPublisherCertificate.ps1` there before opening
the signed app. The certificate is installed for the current Windows user; IT
can deploy the same public certificate centrally when more computers need it.
Public downloads still require a certificate from a trusted authority or
Microsoft Store distribution to build global SmartScreen reputation.

## Bulk deletion

CSV and pasted-ID deletions share one bounded workflow. Large lists are split across an adaptive pool of up to five parallel workers. The progress panel reports deleted, failed, and remaining counts; a paused deletion can continue from its untouched records, and failures can be retried after the cycle completes.

To use the portal itself as the list source, select **Fetch all Customers from Portal**. The app loads every page of the current portal's customer report into the same activity feed used by CSV imports. Fetching is non-destructive: after reviewing or filtering the list, choose the existing action for all loaded or currently displayed customers.

## AutoPay management

Open **AutoPay** from the navigation after saving the portal connection. Customer
filters are sent to the portal report, while the table's search field narrows all
results already loaded into the app. The on/off filter uses the report's next
AutoPay date as a list-level indicator; each customer's current contract is
checked again before a change.

Selected customers can receive an existing portal template, a JSON
configuration, or an Excel configuration. Applying skips existing contracts by
default. Removing skips customers without a contract. Bulk work uses up to three
parallel workers and supports pause, continuation, outcome counts, and retrying
temporary failures.

Excel workbooks may contain:

- A `Templates` sheet with `Name`, `AmountOption`, `Frequency`, and any optional
  AutoPay configuration columns.
- An `Assignments` sheet with `CustomerId` plus either `TemplateName` or direct
  configuration values. `PaymentMethod` and `NextPaymentDate` may be set per
  customer.

Choose **Download template** in the AutoPay action panel to create a
ready-to-fill workbook with every supported column and dropdowns for fixed
options. Open **Help** from either main workspace for a searchable explanation
of each column, its requirement, and its available values.

See [AutoPay Sandbox checklist](docs/autopay-sandbox-checklist.md) before using
these workflows against Production.

## Repository map

```text
PFRRecordTool/
├── forge.config.js          Electron packaging configuration
├── package.json             App entry point, commands, and dependencies
├── public/                  Installer icons
├── src/
│   ├── main/                Trusted Electron main-process code
│   │   ├── autopay/         Contract rules, Excel import, and bulk lifecycle
│   │   ├── csv/             CSV record loading
│   │   ├── ipc/             Renderer request handlers and app state
│   │   ├── payfabric/       PayFabric HTTP client
│   │   ├── windows/         Popup and confirmation window lifecycle
│   │   └── index.js         Application entry point
│   ├── preload/             Narrow bridge exposed to renderer pages
│   ├── renderer/            HTML, CSS, and browser-side behavior by screen
│   └── shared/              IPC channels and the AutoPay workbook schema
└── test/                    Node-based behavior and structure checks
```

## Where to make changes

| Goal | Start here |
| --- | --- |
| Change a PayFabric request | `src/main/payfabric/client-core.js` |
| Change AutoPay contract rules or bulk behavior | `src/main/autopay/` |
| Change the AutoPay screen | `src/renderer/autopay/` |
| Change workbook columns or Help definitions | `src/shared/autopay-workbook-schema.js` |
| Change the Help window | `src/renderer/help/` |
| Add or change an Electron request handler | `src/main/ipc/register-handlers.js` |
| Add an IPC channel | `src/shared/channels.js` |
| Change CSV loading | `src/main/csv/records.js` |
| Change popup behavior | `src/main/windows/manager.js` |
| Change the main screen | `src/renderer/main/` |
| Change the record editor | `src/renderer/record-editor/` |
| Change confirmation dialogs | `src/renderer/confirmations/` |
| Change what browser pages can access | `src/preload/index.js` |

See [Architecture](docs/architecture.md) for the runtime flow and extension guidelines.

## PayFabric knowledge source

Future PayFabric and Receivables enhancements should be checked against the local Obsidian reference vault described in [PayFabric Knowledge Sources](docs/knowledge-sources.md). The vault is read-only by default and its imported content is treated as reference material, not repository instructions.

## Verification

Run these before handing a change to another developer:

```sh
cd PFRRecordTool
npm test
npm run package
```

The automated tests cover CSV and Excel loading, PayFabric request construction,
deletion and AutoPay lifecycles, IPC behavior, and renderer asset references.
PayFabric operations still require a valid portal and integration credentials,
so fetch, update, delete, and AutoPay flows should also be checked manually in
Sandbox mode before release.
