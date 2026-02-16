# Date Range Filters — Design Document

**Date**: 2026-02-16
**Status**: Approved

## Problem

The payments page shows recent payments with no way to filter by month or year. The dashboard is hardcoded to the current month with no way to view other months. For a cash-payment business, the owner needs to compare revenue month-over-month and find specific payment records.

## Solution

Add date range filtering to both the Payments page and Dashboard using two different UX patterns suited to each page's purpose.

## Design

### Payments Page — Filter Bar

A single-row toolbar between the header and summary cards with:

- **Month dropdown** (`<Select>`): January–December, defaults to current month
- **Year dropdown** (`<Select>`): 2025 through current year, defaults to current year
- **Search input**: Right-aligned, filters displayed payments client-side by member name (case-insensitive substring)
- **"Clear" link**: Ghost text link (`text-surface-500 hover:text-primary-300`), only visible when a filter is active

Layout: `rounded-xl border border-surface-700 bg-surface-800/50 px-4 py-3`. Flex row, wraps on mobile (dropdowns top, search below).

**Data flow:**
- State: `filterMonth`, `filterYear`, `searchQuery`, `filteredPayments`, `loadingPayments`
- Initial: server-fetched current month payments (no loading flash)
- On dropdown change: `GET /api/payments?startDate=YYYY-MM-01&endDate=YYYY-MM-last`
- On clear: `GET /api/payments` with no date params (latest 100), resets search
- Search: `useMemo` filter on `filteredPayments` by `memberName`
- Summary cards: "This Month" card stays fixed (server-fetched). Table description updates to "X payments in Month Year"
- Loading: opacity fade on table, no spinner

**Server component change:** Add date bounds (current month) to initial payment query.

### Dashboard — Month Navigator

The subtitle "February 2026 overview" becomes navigable:

```
< February 2026 >
```

- **Chevron buttons**: Ghost-styled (`text-surface-400 hover:text-surface-100`), SVG chevron icons
- **Right arrow disabled** on current month (no future navigation)
- **No lower bound** for backward navigation

**Data flow:**
- State: `viewMonth`, `viewYear`, defaulting to current month/year
- Initial: server-fetched props (no loading flash)
- On arrow click: `GET /api/analytics?startDate=YYYY-MM-01&endDate=YYYY-MM-last`
- Response replaces metric values and chart data
- Loading: opacity fade on metric cards and charts
- `monthLabel` prop is initial value only — client state takes over

**Server component change:** Restructure props to match analytics API response shape for seamless swapping.

### Filters Are Independent

Month/year picker and search on the Payments page operate independently. "Clear" resets the month picker only. Each filter narrows the displayed list further.

## Files to Modify

1. `app/(owner)/payments/PaymentsClient.tsx` — filter bar, fetch logic, filtered display
2. `app/(owner)/payments/page.tsx` — date bounds on initial query
3. `app/(owner)/dashboard/DashboardClient.tsx` — month navigator, client-side fetching
4. `app/(owner)/dashboard/page.tsx` — restructure props for analytics API compatibility

## Not Doing

- No new component files (filter bar and navigator are inline)
- No API changes (endpoints already support date params)
- No URL query param sync (filters are ephemeral)
- No pagination on payments
- No caching of previously fetched months
- No complex date range picker (just month/year)

## Testing

- Payments: default month selected, dropdown change triggers fetch, search filters by name, clear resets state, loading state
- Dashboard: arrows render, navigation changes month, right arrow disabled on current month, fetch with correct params, data updates
