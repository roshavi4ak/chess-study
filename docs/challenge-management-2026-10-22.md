# Challenge editing, reusable teams and contribution links

Implemented locally on 22 October 2026. This change has not been deployed to shah.belovezem.com.

## Behaviour

- Coaches have **Edit** links on `/challenges` and `/coach/teams`, for both team challenges and club goals. The forms are prefilled and can change names, measures, puzzle themes/openings, dates, scoring, target and team rosters as applicable. Retained challenge teams keep their IDs and manual bonus points; club goals keep their manual progress. Scores are recalculated from saved student activity; activity records are never rewritten by these edits.
- **Saved teams** at the top of `/coach/teams` is independent of challenge creation. Coaches can create, edit and delete named rosters with colours and search the student list. Each challenge slot can select an entire saved roster. Selected rosters are copied into the challenge, so editing or deleting a saved team does not change existing challenges. Overlapping members are rejected before selection rather than being silently moved between teams.
- Coaches see every member's contribution directly below their team's score on both pages, including zero contributions, an activity total and an explanation for averages. Manual points remain separately identified as team points. The existing student visibility policy is preserved: students see their own contribution, their team and the team standings; individual peers' activity values are not sent to them.
- **Start contributing** opens an activity that counts toward an active challenge/goal, preserving the selected puzzle theme or opening. Other destinations include bots, solo chess, notation, levels and tournaments. Upcoming challenges allow practice with an explicit note that only activity within the displayed dates counts. Students outside the roster get practice plus an enrollment explanation. Finished challenges have no contribution button; manual goals explain that the coach records progress.
- All new text is available in Bulgarian and English.

## Database and release

1. Back up the target database using the established deployment process.
2. Apply `scripts/add-reusable-teams.sql` with `ON_ERROR_STOP`. It adds only `ClubTeam`, `ClubTeamMember` and their keys/index. It uses bounded lock and statement timeouts and can be applied more than once.
3. Regenerate Prisma Client and build/deploy the application. Do not apply unrelated uncommitted schema changes through a broad schema synchronization.

Existing challenge tables are unchanged. While the roster migration is pending, challenge editing continues to work and the coach page explains that saved teams are awaiting the database update.

## Verification

- `npm run test:challenges`: 22 scoring/navigation and interactive form/card tests, including both languages, saved roster selection, overlap rejection, prefilled editing, locale-preserving navigation, failed saves, progress visibility and contribution destinations.
- `npm run test:challenges:db`: 7 real PostgreSQL integration tests. Set `CHALLENGE_TEST_DATABASE_URL` explicitly to an isolated localhost database with a name ending in `_test`; the script refuses the application's default database. Tests cover persistence, snapshot independence, retained bonuses, recomputation from actual attempts, atomic rejection of invalid edits, team replacement, goal editing, student visibility and all management authorization checks.
- Applied the SQL twice to a throwaway PostgreSQL 16 database initialized with the preceding schema; Prisma's schema diff was empty afterward.
- Existing club-game suite passed. Production build, TypeScript, relevant ESLint checks and literal translation-key checks passed.
- Browser checked actual authenticated coach saves and roster creation/selection against the isolated database, plus the student challenge page and its activity link. Checked desktop dark mode and a 390px mobile viewport in light mode; forms had no horizontal overflow.

Local verification logs are under the ignored `backups/challenge-management-20261022/` directory.
