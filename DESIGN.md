---
name: PFR Record Tool
description: A restrained PayFabric operations workbench for safe record and AutoPay management.
colors:
  brand-blue: "#1a80c3"
  brand-green: "#58b53b"
  primary: "#197cbd"
  primary-hover: "#007eb6"
  primary-soft: "#e6f3fa"
  background: "#ececec"
  surface: "#ffffff"
  surface-subtle: "#f7f7f7"
  border: "#d2d2d2"
  border-strong: "#b8b8b8"
  text: "#363636"
  text-muted: "#5d5d5d"
  success: "#3a7a2b"
  success-soft: "#eaf6e6"
  warning: "#8a4b00"
  warning-soft: "#fff3de"
  danger: "#c5173c"
  danger-hover: "#9f1230"
  danger-soft: "#fde8ed"
typography:
  headline:
    fontFamily: "Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.45
rounded:
  control: "6px"
  panel: "9px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "7px 14px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "7px 14px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "18px"
---

# Design System: PFR Record Tool

## Overview

**Creative North Star: "The PayFabric Operations Workbench"**

The interface is a focused desktop workbench: visually close to the PayFabric
portal, dense enough for operational data, and calm enough that destructive
choices stand out immediately. Structure comes from clear zones, compact fields,
and data tables rather than decorative dashboards.

**Key Characteristics:**

- PayFabric website blue and green anchor the otherwise neutral workbench.
- Charcoal text and dark activity feeds keep dense operational data readable.
- Destructive red is reserved for changes that remove customer data or AutoPay.
- Status, scope, selection, and progress remain visible during bulk work.

## Colors

PayFabric blue directs ordinary actions; neutral gray surfaces organize dense
work; the brand green marks progress and success without carrying small white
labels. The slightly deeper action blue preserves readable button contrast.

**The Reserved Danger Rule.** Red belongs only to destructive actions, failure
states, and Production risk—not general emphasis.

## Typography

The system uses the platform workhorse sans stack for predictable Electron
rendering and compact information density. Headings are bold and slightly tight;
labels are smaller but retain normal casing and strong contrast.

**The Data Clarity Rule.** Monospace is limited to raw activity or machine-shaped
data, never used as a general technology aesthetic.

## Layout

Screens use 24px outer padding and 18px between major workflow zones. Panels have
18px internal padding. AutoPay keeps the customer ledger primary and places bulk
actions in a 340px adjacent column; below 1040px the action panel follows the
ledger, and below 820px headings and field grids collapse for compact windows.

Records and AutoPay share one header shell. The page title and navigation occupy
the same fixed slots, followed by description and runtime versions, so switching
workspaces never moves the navigation targets.

Large collections remain in bounded scrolling regions. Search and selection work
against the full loaded collection even when only the first 500 rows render.

## Elevation & Depth

Depth is quiet and structural. Major workflow surfaces use one ambient shadow
(`0 8px 24px rgba(18, 18, 39, 0.08)`) plus a cool border; controls and table rows
stay flat so the application does not become a stack of floating cards.

## Shapes

Controls use gently curved 6px corners, workflow panels use 9px corners, and
compact state chips use full pill corners. Borders are one pixel and cool-toned.

## Components

### Buttons

Primary buttons use blue with white text and a 6px radius. Secondary and quiet
buttons retain the surface and use blue text. Every focus state uses a visible
blue outline. Destructive buttons use the reserved danger color.

### Chips

Status chips use pale semantic fills with dark semantic text. They always include
words such as “On,” “Not on AutoPay,” or “failed”; color is never the only signal.

### Cards / Containers

Panels group one workflow zone, not individual metrics. They use the main surface,
cool border, 9px corners, 18px padding, and the shared ambient shadow.

### Inputs / Fields

Fields use the main surface, strong cool border, 6px corners, and at least 36px
height. Labels sit above fields. Disabled controls remain legible but visibly
muted.

### Navigation

The primary navigation is a compact text tab group beneath the product title.
The active route uses navy fill and white text; hover and focus use the soft blue.

## Do's and Don'ts

### Do:

- **Do** show the selected scope and customer count next to bulk actions.
- **Do** use plain action labels and state both the result and recovery.
- **Do** keep high-volume lists bounded while preserving full-list operations.

### Don't:

- **Don't** use red for non-destructive emphasis.
- **Don't** hide Production state or destructive consequences inside helper text.
- **Don't** turn operational sections into grids of decorative metric cards.
