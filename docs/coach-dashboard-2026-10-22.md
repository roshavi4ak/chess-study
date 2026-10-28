# Coach dashboard redesign — 22 October 2026

Implemented locally; this change has not been deployed.

The live dashboard stacked two student tables and two 100-attempt histories. Its document height was 18,845 CSS pixels at a 1,778-pixel viewport, with no filters.

## Behavior

- Three separate views: Students, Needs attention, and Activity. Only the selected view renders, with ten results per page and an accurate result count.
- Student selection, name search, and team selection. Team choices include reusable club rosters where installed, plus challenge snapshots labeled with the challenge name.
- One chronological activity history with puzzle/practice, result, text, and rolling 7/30-day filters. Text searches student names and activity titles. Database filtering happens before counting and pagination; older activity is searchable without a latest-100 cutoff.
- Filters and pagination live in the URL. Dropdowns navigate immediately, searches submit with Enter/the Search button, and changing filters resets the page. Page links retain the filters and clamp to the available range.
- Student names retain their profile links. Activity shortcuts select that student's history. Team and homework management remain accessible from the header.
- Attention shows only students flagged as inactive, behind on review, or overdue on homework, sorted by overdue homework and then review backlog. It retains weekly activity, mastery, weakest theme, homework completion, and level placement.
- Solved-puzzle totals count successful solves. Played-line totals count completed/perfect attempts. Progress counters remain lifetime totals; activity period filters apply to the history.
- Responsive student/activity cards and collapsible extra filters on phones; tables and the full filter bar on larger screens. English/Bulgarian labels, light/dark styling, accessible control labels, and empty results are included. Activity timestamps use Europe/Sofia.

## Verification

- `npm run test:coach-dashboard`: eight passing checks covering URL validation, combined filters, safe SQL parameters, paging, optional roster compatibility, and the actual filter component in English and Bulgarian, including mobile filter expansion.
- Targeted ESLint and TypeScript checks passed. The production Next.js build passed.
- The new query builder ran against production data in a PostgreSQL transaction explicitly set to `READ ONLY`. Checks covered all 4,358 student attempts, 26 students, both challenge teams, individual students, title searches, puzzle outcomes, perfect practices, empty scopes, page boundaries, and page 436. The existing production Prisma client predates reusable rosters, so the test adapter checked that the optional roster table was absent and returned no saved rosters; unit tests separately exercised the new client's missing-table fallback.
- Visual checks rendered the actual page/components with a snapshot of existing student/activity data and a minimal navigation bar, using mocked auth/data boundaries. This is a layout preview, not an authenticated Next.js end-to-end test. Checked desktop/phone, light/dark, both locales, all views, empty results, and the last page. At a 390 CSS-pixel viewport, all three tabs fit and the page has no horizontal overflow.

No database schema changes are needed. No production student activity, homework, level placement, or application release was changed.
