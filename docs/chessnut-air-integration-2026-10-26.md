# Chessnut Air opening practice

Implemented locally on 26 October 2026. Direct Web Bluetooth in Chrome is the target for Android phones, the MacBook Air M1, and Windows. No native helper or new package is needed. This feature is in opening **practice sessions** (`/[locale]/practices/[id]`), accessible under Openings → Practice Openings. The separate step-by-step opening viewers are unchanged.

## Using it

1. Open an opening practice in Chrome on the HTTPS site. Turn on the Air's Bluetooth and release its connection from Lichess or other apps.
2. Select **Connect Chessnut** and choose the Air in Chrome's device chooser. Initial connection restarts the current line; reconnection keeps the pending lesson.
3. Arrange the real pieces to match the digital position, using the printed board coordinates. Lights identify squares that differ. Input remains paused until the setup matches.
4. Make the student's moves on the real board. On a correct move, the Air lights the squares needed for the opponent's reply. Physically move both colours yourself. Castling and captures may light additional changed squares.
5. Finish placing the opponent's pieces. The app advances only after their position matches, including when this move completes the line.

**Test lights** lights a1 and h8 for 1.5 seconds, then restores lesson guidance. **Read position again** re-enables real-time reporting if no position appears. Keep the page visible while practising. This feature does not add offline lesson storage; lesson loading and progress saving continue to use the existing network services.

The light test and position refresh are under **Lights and connection help** after connecting, keeping the main phone view compact.

After two wrong attempts at the same student position, restore the previous position to see a board hint: the start and destination squares of one valid repertoire move flash five times and then stay lit. If more than one continuation is valid, the board suggests one; the existing screen arrows still show all valid continuations. A correct move replaces the hint with the opponent's move guidance.

After the final physical move is confirmed, d4, e4, d5 and e5 flash together ten times, then turn off. This completion pattern plays once per completed line. Duplicate position reports and reviewing the completed line do not replay it. Restarting, starting the next line or disconnecting cancels a running pattern.

On a wrong move, the correction squares flash three times and then stay lit until the position is restored. Returning the pieces early cancels the remaining flashes. Likewise, moving after a hint cancels its animation so that the next required guidance appears promptly.

An incorrect legal student move is counted once. Restore the previous position before trying again. Intermediate lifts, capture removal, and an unfinished castle or promotion do not count as wrong moves. A restart, historical move review, replay, or reconnection requires matching the current displayed setup again. A lost connection pauses board input; reconnect, or choose **Use screen instead** to continue digitally. Leaving the practice releases the connection and attempts to clear its lights.

## Implementation

- `src/lib/chessnut.ts`: report framing, placement decoding, LED masks, legal move recognition and transient piece placement handling.
- `src/lib/chessnutBluetooth.ts`: device chooser, two GATT services, notifications, serialized writes, timeouts and connection cleanup. The chooser is restricted to names starting with `Chessnut Air`.
- `src/hooks/useChessnutBoard.ts`: setup alignment, 300 ms settling, correction latch, disconnect pause and recovery.
- `src/components/ChessnutBoardPanel.tsx`: responsive connection/status controls, in English and Bulgarian.
- `src/components/PracticeSession.tsx`: existing repertoire validation/progress, with deferred opponent placement in board mode. Full FEN metadata stays in chess.js; only piece placement is compared to the sensor reports.

Protocol references: [Chessnut's BLE interface](https://github.com/chessnutech/Chessnut_eBoards), [EasyLinkSDK LED/placement source](https://github.com/chessnutech/EasyLinkSDK/blob/main/sdk/EasyLink.cpp), and [an Air BLE implementation documenting the classic 01 24 report header](https://github.com/rmarabini/chessnutair/blob/master/main.py). The classic report's 32 piece bytes are accepted after its fixed header; length-prefixed 34/36-byte reports and fragmented notifications are also supported. The manufacturer's LED prose says 34 bytes, but its example and C++ implementation both specify ten; this implementation follows the ten-byte Air command. The implementation uses protocol facts and does not incorporate third-party driver code.

## Verification and remaining hardware check

Run `npm run test:chessnut`. Simulated protocol, transport and real React trainer tests cover English/Bulgarian flow, position setup, LED coordinates, split and combined packets, castling, captures, en passant, exact underpromotion identity, wrong move correction, duplicate completion prevention, reset, playing Black, reconnect and screen fallback. Existing opening/practice/review tests, lint, TypeScript and the production build are also checked.

Initial result: 19 Chessnut tests and 20 existing practice/learning/review test entries passed. ESLint on changed code and tests, TypeScript, and `npm run build` passed. No database migration or dependency installation is required. The initial integration was deployed and the user reported a successful physical-board test; see [deployment record](chessnut-air-deployment-2026-10-26.md). The hint/completion follow-up adds dedicated tests for the two-error threshold, light commands, final-position confirmation, duplicate reports and cancellation.

These checks do not establish compatibility with the user's physical board/firmware or with an actual Android or Mac Bluetooth stack. First live test: connect, confirm the standard position, verify a1/h8 lights, play e2–e4, confirm the indicated opponent reply, test a deliberate wrong move/undo, then disconnect/reconnect. Repeat on the Android phone and Mac before using it for a class. No board commands were sent during implementation.

Browser layout was checked at 390 × 844 and 1440 × 900 using a temporary sample opening, including a simulated BLE connection and opponent LED command. Neither viewport overflowed horizontally. The real local practice page could not be loaded because the configured local PostgreSQL service at port 5433 was unavailable; no database settings or records were changed. The temporary preview route was removed after verification.
