# Architecture

The application follows Electron's three-runtime model. Keeping these areas separate makes it clear which code is trusted and where a change belongs.

```text
Renderer screen
    │ window.api
    ▼
Preload bridge ─── shared IPC channels
    │ IPC
    ▼
Main-process handlers
    ├── PayFabric client
    ├── AutoPay service and bulk manager
    ├── CSV records
    └── Window manager
```

## Runtime modules

### Main process

`src/main/index.js` owns the Electron application lifecycle and creates the main window. It delegates renderer requests to the IPC module.

`src/main/ipc/register-handlers.js` is the single interface for registering application behavior. It owns transient session state such as the selected portal, current record, deletion mode, and loaded CSV records. Handler registrations are grouped by configuration, records, CSV files, and deletion.

`src/main/payfabric/client.js` connects the real cookie-aware fetch adapter. `client-core.js` owns authentication, endpoint construction, and HTTP requests behind the small client interface. Renderer code never accesses credentials or the network client directly.

`client-core.js` retrieves portal-wide customer IDs through the paginated `GET /reports/customers` report. It follows zero-based `filter.pageIndex` pages until the response's `Total` record count has been reached, rejects incomplete reports, and returns only validated customer IDs. It starts with a conservative page size and, only when PayFabric returns a page-size validation error on the first page, tries bounded fallback sizes and keeps the first accepted size for the remaining pages. Documented exact-match and numeric filters are sent with every page request so the portal reduces results before loading. The IPC layer stores those IDs in the same `recordList` used by CSV imports and publishes them through the existing feed and record-count channels, so filtering and later actions do not depend on the list's source.

`src/main/csv/records.js` hides the two-pass CSV parsing needed to identify the record ID column and then read its values. Callers use only `loadData`.

`src/main/deletion/manager.js` owns bulk deletion lifecycle and is shared by CSV and pasted-ID workflows. It splits work into independently processed chunks and adapts concurrency to list size: 1 worker for up to 10 records, 2 for 11–50, 3 for 51–200, 4 for 201–500, and a hard maximum of 5 above 500. Pausing prevents new requests from starting, lets in-flight requests settle, and retains the untouched records for continuation. Failed records are retained separately for an explicit retry cycle.

`src/main/ipc/register-autopay-handlers.js` is the AutoPay interface for the
renderer. It connects customer discovery, individual requests, imports, and the
bulk manager while keeping contract rules in the AutoPay modules. The existing
registration module remains the single application entry point and calls this
feature registrar.

`src/main/autopay/contracts.js` normalizes JSON, Excel, and portal-template fields
into the same PayFabric contract shape. `service.js` verifies current contract
state and resolves each customer's own default payment method before creation.
`bulk-manager.js` owns a session-only queue with a maximum of three workers,
pause/continue, skipped outcomes, and retry eligibility limited to network,
timeout, rate-limit, and server failures. `import.js` reads `Templates` and
`Assignments` sheets with ExcelJS. `workbook-template.js` generates a blank,
self-compatible workbook from the same schema used by the importer and Help.

The PayFabric client owns both API surfaces used by AutoPay. Customer reports and
portal-template writes use the Receivables Sync API. Contract and template reads
use the Customer Portal API with a fresh impersonation token for the target
customer. Those tokens are passed directly to one request and are never written
to the client's shared Sync token, which keeps parallel customer work isolated.

`src/main/windows/manager.js` owns secondary-window creation, page paths, sizing, and lifecycle. IPC handlers refer to screens by purpose instead of constructing file paths.

### Preload and shared code

`src/preload/index.js` is the seam between trusted main-process code and renderer pages. Renderer windows keep direct Node integration disabled; the preload runs outside Electron's process sandbox so it can import the shared channel catalog, then exposes only the narrow `window.api` bridge. Keep this interface small. Add a capability here only when a renderer genuinely needs it.

`src/shared/channels.js` is the source of truth for IPC channel names. Both sides import it so channel strings do not drift. `src/shared/autopay-workbook-schema.js` is the source of truth for workbook columns, accepted aliases, option lists, and Help definitions.

### Renderer

Each screen keeps its HTML, CSS, and JavaScript together under `src/renderer/`.
`src/renderer/shared/app-shell.css` owns the identical Records and AutoPay header
geometry, while `runtime-versions.js` fills their shared runtime-version line.
Page-specific styles must not redefine the primary navigation layout.

The main screen is divided by behavior:

- `configuration.js` manages credentials and Sandbox/Production mode.
- `single-record.js` manages one-record lookup and actions.
- `csv-deletion.js` manages CSV selection, filtering, and deletion progress.
- `bulk-records.js` manages semicolon-separated bulk actions.

All confirmation pages share `confirmations/index.js`. A page selects its confirm action with the `data-confirm-channel` attribute on its `<body>` element.

The deletion progress panel listens for snapshots from the deletion module and renders running, pausing, paused, completed, and completed-with-failures states. Renderer code does not calculate deletion state itself.

The AutoPay screen is divided into four controllers under
`src/renderer/autopay/`: `workspace.js` owns shared state and presentation
helpers; `customers.js` owns filters, bounded table rendering, search, and
selection; `contract-editor.js` owns one customer's create/update/remove flow;
and `bulk-actions.js` owns configuration sources, confirmations, workbook
downloads, and progress. `src/renderer/help/` is a separate, reusable Help
window whose searchable AutoPay reference is rendered from the shared schema.

## PayFabric references used

Bulk customer deletion behavior is grounded in the vault notes `APICustomers.md`, `SyncCustomers.md`, `QueryFilter.md`, `Customer.md`, `CustomerReportPagingResponse.md`, and `CustomerDeleteOptionsRequest.md`. Invoice modification behavior is grounded in `APIInvoices.md` and `Invoice.md`; the client sends `PATCH` and includes the original invoice ID as the encoded `identity` query parameter. When a fetched invoice has the `Outstanding` status, the client omits that field from the update body so amount-only edits do not attempt an invalid workflow-status change. Explicit editable statuses remain in the request.

AutoPay behavior is grounded in `AutoPays.md`, `SyncAutoPay.md`,
`ObjectsAutoPay.md`, `AutoPayTemplate.md`, `AutopayTemplateRequest.md`,
`GetAllAutoPayTemplates.cs.md`, `GetCurrentCustomerAutoPay.cs.md`,
`SaveAutoPay.cs.md`, `UpdateAutoPay.cs.md`, `DeleteAutoPay.cs.md`,
`SyncCustomers.md`, and `QueryFilter.md`. The official PayFabric API repository
was used to verify the source documents represented by those generated vault
notes.

## Adding a workflow

1. Add the channel name to `src/shared/channels.js`.
2. Register the trusted operation in `src/main/ipc/register-handlers.js`.
3. Expose only the minimum renderer capability through `src/preload/index.js` if the existing `invoke`, `send`, and `receive` interface is insufficient.
4. Add the screen behavior to the closest renderer feature file.
5. Add a test at the narrowest stable interface, then run `npm test` and `npm run package`.

Keep PayFabric details in the client, Electron window details in the window manager, and DOM details in renderer files. This preserves locality: each kind of change should normally stay within one module.
