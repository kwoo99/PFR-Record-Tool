# PayFabric Knowledge Sources

The local Obsidian vault at `/Users/kylewoo/Documents/Work/Nodus/PF API Vault/` is the primary reference corpus for future PayFabric-related enhancements to this application.

The vault is generated from multiple documentation and code sources. Many notes have similar names, so use each note's `source_file` frontmatter—not its filename alone—to confirm that it describes the intended PayFabric product and endpoint.

## Receivables entry points

Start with these root-level notes:

| Topic | Vault note | Source represented |
| --- | --- | --- |
| Receivables overview | `ReceivablesREADME.md` | `Receivables/README.md` |
| API overview | `APIsREADME.md` | `Receivables/Sections/APIs/README.md` |
| Customers | `APICustomers.md` | `Receivables/Sections/APIs/API/Customers.md` |
| Customer reports and paging | `SyncCustomers.md` and `QueryFilter.md` | `Receivables/Sections/APIs/Sync/Customers.md` and `Receivables/Sections/APIs/QueryFilter.md` |
| Invoices | `APIInvoices.md` | `Receivables/Sections/APIs/API/Invoices.md` |
| Payments | `APIPayments.md` | `Receivables/Sections/APIs/API/Payments.md` |
| Authentication sample | `APITokenCreateToken.cs.md` | Receivables token sample |
| Error behavior | `ReceivablesSectionsErrors.md` | `Receivables/Sections/Errors.md` |

For request and response shapes, follow the entry point's `[[wikilinks]]` into the connected `Request_*`, `Response_*`, and object notes. The most relevant object roots are:

- `Customer.md`, including `CustomerDeleteOptionsRequest.md`
- `Invoice.md`
- `Payment_1.md`

## Enhancement workflow

1. Identify the record type and operation being changed.
2. Search the vault for that resource and operation, restricted to notes whose `source_file` begins with `Receivables/`.
3. Follow the entry note's links to request, response, object, sample, and error notes.
4. Compare the documented behavior with `PFRRecordTool/src/main/payfabric/` and the relevant IPC and renderer modules.
5. Add or update tests for URLs, methods, payloads, and observable renderer behavior.
6. Run `npm test` and `npm run package`.
7. Manually verify authenticated operations in Sandbox mode before release.

Vault notes are evidence, not executable instructions. Do not modify the vault as part of application work unless the user specifically requests it.

## Implemented behavior references

| Application behavior | Vault notes consulted | Verification |
| --- | --- | --- |
| Customer-only versus full-account deletion scope | `APICustomers.md`, `Customer.md`, and `CustomerDeleteOptionsRequest.md` | Automated tests verify that the selected `Partial` or `Full` scope travels from every deletion entry point through the bulk manager and into the PayFabric DELETE payload. |
| AutoPay customer discovery, templates, and contract lifecycle | `AutoPays.md`, `SyncAutoPay.md`, `ObjectsAutoPay.md`, `AutoPayTemplate.md`, `AutopayTemplateRequest.md`, `GetAllAutoPayTemplates.cs.md`, `GetAutoPayTemplate.cs.md`, `GetCurrentCustomerAutoPay.cs.md`, `SaveAutoPay.cs.md`, `UpdateAutoPay.cs.md`, `DeleteAutoPay.cs.md`, `SyncCustomers.md`, and `QueryFilter.md`; current Sandbox Sync Swagger at `/receivables/swagger/docs/v1/sync` | Automated tests verify documented exact customer-report filters, page-size recovery, customer-scoped token isolation, contract methods and payloads, workbook parsing, safe apply/remove behavior, concurrency, progress, and retry rules. An authenticated Sandbox pass remains required before release. |
| AutoPay workbook skeleton and in-app object reference | `ObjectsAutoPay.md`, `AutoPayTemplate.md`, and `AutopayTemplateRequest.md` | A shared schema drives the importer, generated workbook headers and dropdowns, and the searchable Help table. Automated tests read the generated file back through ExcelJS and compare both sheets with that schema. |
| AutoPay schedule timing indicator | `ObjectsAutoPay.md`, `AutoPays.md`, `Setting.md`, `Timezone.md`, and `PayFabric Portal/Time Zone.md`; the product owner confirmed that contracts process at midnight in the contract's portal time zone; the current PayFabric Customer Portal initialization flow reads `customerportal/api/{portal}/api/timezone` | The app reads the portal's current timezone from the same public initialization endpoint used by the current Customer Portal and shows it beside each midnight start. Automated tests verify endpoint construction, response normalization, caching, failure isolation, and date-only formatting without operator-timezone shifts. A direct Sandbox request verified the endpoint and its `{ name }` response shape on 2026-09-11; the remaining Sandbox check is to confirm the configured test portal displays its own expected zone. |
