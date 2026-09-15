# PFR Record Tool Product Context

## Purpose

PFR Record Tool is an internal Electron utility for safely finding, editing, and
removing PayFabric Receivables records. Its AutoPay workspace extends the same
tool so operations staff can find customer groups, inspect AutoPay state, and
apply or remove contracts without repeating the same portal steps customer by
customer.

## Users and operating context

- Internal Nodus and PayFabric operations staff work primarily on a desktop.
- Users may connect to Sandbox or Production with session-only integration
  credentials.
- Bulk actions can affect many customer accounts, so scope, selection, progress,
  skips, failures, and destructive intent must remain visible.

## Product commitments

- Existing customer, invoice, payment, CSV, and bulk-deletion workflows remain
  available and keep their current behavior.
- AutoPay customer discovery uses the Receivables customer report and its portal
  filters. AutoPay contract work uses a customer-specific Customer Portal token.
- A report's `NextAutoPay` value is a useful list-level indicator, but the tool
  verifies the current contract before changing or removing it.
- AutoPay bulk operations use bounded concurrency and keep per-customer tokens
  isolated. Customers that cannot be changed are reported instead of silently
  receiving guessed payment methods or dates.
- New AutoPay configurations may come from JSON or an Excel workbook; existing
  portal templates can also seed a contract.
- Credentials and work queues are session-only unless persistence is explicitly
  approved later.
- The interface follows PayFabric's website blue, green, and charcoal palette and
  practical admin-tool language.

## Current AutoPay scope

- Filter and load portal customers, including all/on AutoPay/not on AutoPay views.
- Select customers and apply an existing template or imported configuration.
- View and edit one customer's current contract, or add one when none exists.
- Remove AutoPay from selected customers.
- Show bounded-parallel progress, allow pause/continue, and retry temporary
  failures after a cycle.

## Open decisions

- Bulk apply skips existing contracts by default; overwriting them requires a
  future explicit product decision.
- Jobs do not survive an application restart in the first release.
- Authenticated Sandbox verification is required before using AutoPay mutations
  in Production.
