# Chess learning competitor evidence — 19 October 2026

Research for the student experience review. This is a source note, not an implementation proposal. Checked public official pages on 19 October 2026; features behind login were not tested. Observations describe documented capabilities, not evidence that a feature improves learning outcomes. Recommendations and likely student benefits remain product hypotheses.

## Existing app baseline

Avoid treating these as missing: opening spaced review, daily missions with weakest-theme puzzles, homework, coach student reports, levels and tests, brief text lessons, mini-game worlds, animal bots, puzzle streaks/races, coordinates, mastery cards, leagues, tournaments, certificates, and English/Bulgarian text. Local evidence: `docs/learning-loop-plan-2026-10-13.md`, `docs/engagement-plan-2026-10-13.md`, `src/lib/curriculum.ts`, `src/app/[locale]/levels/page.tsx`, `src/app/[locale]/coach/students/[id]/page.tsx`, and `src/components/DailyMission.tsx`. Deployment records support feature presence but do not substitute for a fresh production usability test.

## 1. Short concept lessons followed by targeted exercises

**Observation:** Chess.com's official beginner course lists 13 lessons, each with a one-to-three-minute explanation/video and five challenges, covering rules and piece movement. ChessKid describes progressive lessons that pair a concept video with interactive follow-up exercises. Sources: [Chess.com Learn To Play Chess](https://www.chess.com/lessons/learn-to-play-chess), [ChessKid Video Series guide](https://www.chesskid.com/learn/articles/video-series-guide).

**Distinction:** Our levels already provide text lessons and theme practice; the gap to evaluate is a worked example on a board followed by deliberately authored exercises checking the same idea, rather than merely adding levels or another puzzle feed. Locally authored Bulgarian explanations would need review by the coach.

## 2. Explanations that demonstrate consequences

**Observation:** Chess.com Game Review documents key-move retries, feedback on a rejected retry, and visual actions such as showing a fork, lost piece, checkmate, or idea. The coach can read explanations aloud, and automatic line playback is configurable. Source: [How Game Review works](https://support.chess.com/en/articles/8584089-how-does-game-review-work).

**Distinction:** Conceptual hints before an answer, a short visual refutation of a student's idea, and optional Bulgarian audio are possible adaptations. The source does not establish a particular three-stage hint sequence; that would be our design. Our existing arrows/SAN hints should not be described as missing.

## 3. Practice drawn from a student's actual games

**Observation:** Aimchess describes personalized puzzles made from the student's mistakes and a Retry Mistakes activity asking for a better move in the original position. It also offers Opening Improver, focused on incorrect opening moves. Source: [Aimchess product page](https://aimchess.com/).

**Distinction:** The app's external Lichess analysis links are useful, but they do not themselves create an internal practice queue from a student's recent games. A small number of coach-reviewed moments is a reasonable first adaptation. Avoid repeating Aimchess's marketing effectiveness percentage as independent evidence.

## 4. Revisit specific failed puzzles

**Observation:** Lichess's official changelog records replay of failed puzzles from the dashboard and puzzle dashboard strengths/improvement areas. Its current puzzle themes page exposes dashboard, history, strengths, improvement areas, and a From my games entry. Sources: [Lichess changelog](https://lichess.org/changelog), [Puzzle Themes](https://lichess.org/training/themes).

**Observation:** Chessable's official MoveTrainer help says each individual move has its own review timer, increasing after correct answers and shortening/resetting after mistakes. Source: [MoveTrainer review timing](https://support.chess.com/en/articles/10319267-when-will-the-variations-be-ready-for-my-review).

**Distinction:** Replaying failed puzzles on later days would extend our existing per-opening-line spaced review. Neither Lichess source above establishes a spaced schedule for failed puzzles; combining failed-puzzle replay with spaced scheduling is our proposed adaptation, not a claim about Lichess.

## 5. Play positions through to an outcome

**Observation:** Lichess Practice has basic and advanced mates, pawn endgames including opposition/key squares, and rook endgame material. Chess.com Endgames separates Learn, Practice, and a timed Challenge for themes. Sources: [Lichess Practice](https://lichess.org/practice), [Chess.com Endgames help](https://support.chess.com/en/articles/8708978-how-do-i-practice-endgames).

**Observation:** Chess.com's analysis board can start Practice vs Computer from a position. Source: [Analysis board help](https://support.chess.com/en/articles/8583825-how-do-i-use-the-analysis-board).

**Distinction:** Our endgame-themed puzzles and mini-games are present. A separate gap is playing a legal chess ending from a preset FEN through to mate, promotion or draw against an opponent, while accepting multiple sound plans. Timed competition is optional in the competitor and need not be copied for young students.

## 6. Coaching during games against a bot

**Observation:** Chess.com's Play Coach offers selectable opposition level, feedback during play, challenges and practice coaching. Source: [Official Play Coach announcement](https://www.chess.com/news/view/announcing-play-coach).

**Distinction:** Our animal bots already exist. A thematic mission and contextual explanation during those games would extend them. The exact missions, e.g. protecting pieces or castling safely, are proposed design choices. The announcement does not establish that every bot elsewhere offers those missions.

## 7. Teacher-led shared boards

**Observation:** Chess.com's Classroom lets a coach create a room, invite students, import FEN/PGN or games, play through positions for participants, keep engine information visible only to the coach, and grant board control to individual students. Source: [Classroom help](https://support.chess.com/en/articles/8708915-how-do-i-use-classroom-on-chess-com).

**Distinction:** Our projector race mode already gives a shared activity. A synchronized teaching board with individual move submissions, group discussion, or coach-controlled reveal would serve a different lesson format. Anonymous polls, cooperative class goals, and disabling student chat are our possible adaptations; do not attribute those exact choices to the source.

## 8. Guided teaching sequences and recommended next steps

**Observation:** ChessKid's Classroom Planner is a flexible 30-week sequence with objectives, suggested time, lesson/video links, worksheets, and optional activities. Source: [How to use the ChessKid Classroom Planner](https://www.chesskid.com/learn/articles/how-to-use-the-chesskid-classroom-planner).

**Distinction:** Our app already has curriculum levels, manual starting-level placement, assignments and daily missions. A single guided start/continue action or an initial placement check would be an adaptation that connects those pieces. This source does not establish an automatic diagnostic placement test, nor prove our students struggle with navigation; validate the latter by observing students.

## 9. Assess the opponent's threat before choosing a move

**Observation:** Chess.com's Team-authored course Recognizing the Opponent's Moves asks students to evaluate the opponent's last move, decide when to attack or defend, and identify threats before choosing a continuation. The page is labelled advanced/mastery. Source: [Recognizing the Opponent's Moves](https://www.chess.com/lessons/recognizing-the-opponents-moves).

**Observation:** Aimchess's Blunder Preventer asks the player to distinguish a safe move from a blunder among two choices. Source: [Aimchess](https://aimchess.com/).

**Distinction:** A beginner-friendly defense detective activity would adapt the decision pattern, using simpler positions and coach-written questions. Existing attacking puzzle themes alone do not ensure that students explicitly identify the opponent's plan. This is not a recommendation to reuse the advanced course content for beginners.

## 10. Family-facing progress summaries

**Observation:** ChessKid describes individual and club report cards, activity selection over time, and sharing strengths and areas for improvement with parents. Source: [Top 3 Ways To Use Report Cards](https://www.chesskid.com/learn/articles/5-ways-to-use-report-cards). Its school tools documentation also lists grouping, assignments and individual report cards: [Schools and groups features](https://support.chesskid.com/en/articles/8864339-coach-school-what-are-the-special-features-available-to-schools-groups).

**Distinction:** Our coach dashboard and student detail pages are already substantial. The possible gap is a brief family-facing report with one achievement, one next skill and one easy activity to do together. A secure guardian relationship and deliberate sharing controls would be implementation needs; sending reports has not been authorized by this research request.

## Other evidence that should not become a duplicate recommendation

ChessKid Adventure's official launch page describes quests and mini-challenges: [Adventure launch](https://www.chesskid.com/learn/articles/chesskid-adventure-launch). Our app already has mini-game worlds and story text, so an adventure map is an enhancement to existing work, not a newly missing feature.

Chess.com's Insights documents aggregated missed/found tactical patterns and positions from games: [Insights help](https://support.chess.com/en/articles/8708925-what-is-insights-on-chess-com). This supports the competitor trend toward game-based feedback, but adding another statistics dashboard is less directly aligned with the stated goal than turning a concrete mistake into a small exercise.

## Limits

- Competitor descriptions establish feature availability in their published documentation, not availability on every plan/device or independent educational effectiveness.
- These are feature comparisons with the checked-out app and its docs; no student observation, interviews, or production analytics were conducted in this research.
- Lichess's old Study/Interactive Lessons blog URLs could not be fetched reliably. Classroom claims above therefore rely on Chess.com's current official help rather than community forum descriptions or mirrored copies.
- Existing app code, coach-selected content and translations should remain the source of truth for what is appropriate for this particular student group.
