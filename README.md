# PFR Record Tool

PFR Record Tool is an internal Electron application for fetching, updating, and deleting Accounts Receivable records in a PayFabric Receivables portal. It supports individual records, semicolon-separated bulk input, and CSV-based deletion lists.

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

## Bulk deletion

CSV and pasted-ID deletions share one bounded workflow. Large lists are split across an adaptive pool of up to five parallel workers. The progress panel reports deleted, failed, and remaining counts; a paused deletion can continue from its untouched records, and failures can be retried after the cycle completes.

To use the portal itself as the list source, select **Fetch all Customers from Portal**. The app loads every page of the current portal's customer report into the same activity feed used by CSV imports. Fetching is non-destructive: after reviewing or filtering the list, choose the existing action for all loaded or currently displayed customers.

## Repository map

```text
PFRRecordTool/
├── forge.config.js          Electron packaging configuration
├── package.json             App entry point, commands, and dependencies
├── public/                  Installer icons
├── src/
│   ├── main/                Trusted Electron main-process code
│   │   ├── csv/             CSV record loading
│   │   ├── ipc/             Renderer request handlers and app state
│   │   ├── payfabric/       PayFabric HTTP client
│   │   ├── windows/         Popup and confirmation window lifecycle
│   │   └── index.js         Application entry point
│   ├── preload/             Narrow bridge exposed to renderer pages
│   ├── renderer/            HTML, CSS, and browser-side behavior by screen
│   └── shared/              IPC channel names shared across processes
└── test/                    Node-based behavior and structure checks
```

## Where to make changes

| Goal | Start here |
| --- | --- |
| Change a PayFabric request | `src/main/payfabric/client-core.js` |
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

The automated tests cover CSV loading, PayFabric request construction, deletion lifecycle, IPC behavior, and renderer asset references. PayFabric operations still require a valid portal and integration credentials, so fetch, update, and delete flows should also be checked manually in Sandbox mode before release.
