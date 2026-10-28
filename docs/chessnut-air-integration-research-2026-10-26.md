# Chessnut Air opening-training integration

Researched 26 October 2026. This is a feasibility assessment from official documentation and source inspection. No connection to the user's board was opened, no commands were sent, and no hardware compatibility test was performed.

## Finding

Integration is feasible: the browser can receive physical positions and send square-light commands. A direct Web Bluetooth adapter is the most promising first approach for the user's Windows PC. This is an engineering recommendation from the documented interfaces, not a claim that this particular board/browser/firmware combination has passed testing.

## Official Bluetooth interface

Chessnut's [Chessnut_eBoards documentation](https://github.com/chessnutech/Chessnut_eBoards/blob/eb2a1da15eb7dfab8e49ea7f6ef2c662824bc483/README.md) explicitly includes Air, Air+, Go and Pro despite its Move heading. It specifies:

| Interface | UUID |
| --- | --- |
| Position service | `1b7e8261-2877-41c3-b46e-cf057c562023` |
| Position notification | `1b7e8262-2877-41c3-b46e-cf057c562023` |
| Operation service | `1b7e8271-2877-41c3-b46e-cf057c562023` |
| Command write | `1b7e8272-2877-41c3-b46e-cf057c562023` |
| Response notification | `1b7e8273-2877-41c3-b46e-cf057c562023` |

Enable real-time reports with `[0x21, 0x01, 0x00]` and subscribe to position notifications. The documented packet is 36 bytes; bytes 2–33 encode piece placement using two four-bit square values per byte, starting at h8. The LED example is `[0x0a, 0x08, ...eight rank masks]`.

Documentation inconsistency: the LED prose says 34 bytes while its example contains ten. The same source suggests MTU 500 for incomplete notifications. Confirm actual packet boundaries and LED behavior on hardware; do not blindly pad messages or assume a browser can explicitly set its BLE MTU. [Protocol source](https://github.com/chessnutech/Chessnut_eBoards/blob/eb2a1da15eb7dfab8e49ea7f6ef2c662824bc483/README.md).

## What EasyLinkSDK provides

The linked [EasyLinkSDK README](https://github.com/chessnutech/EasyLinkSDK/blob/4554d17be976f746b8b1139a3b9a025e2b54c8ba/README.md) describes a native C/C++ library with position callbacks and LED control, including Air. It uses a native build and its getting-started instructions require a USB cable; they explicitly caution that BLE does not appear to work yet. It is therefore not a browser JavaScript package to import into Next.js.

The [SDK implementation](https://github.com/chessnutech/EasyLinkSDK/blob/4554d17be976f746b8b1139a3b9a025e2b54c8ba/sdk/EasyLink.cpp) corroborates this: `ChessHidConnect` enumerates and opens HID devices, and reads/writes through hidapi. `setLedInternal()` constructs ten bytes: `0x0a`, `0x08`, and eight masks. `toFen()` constructs piece placement only; it does not know turn, castling rights, en-passant rights or move counters. The application must retain that chess state.

The SDK has an [MIT license](https://github.com/chessnutech/EasyLinkSDK/blob/4554d17be976f746b8b1139a3b9a025e2b54c8ba/LICENSE). If direct browser BLE proves unreliable, an installed local helper using the SDK over USB is a possible fallback; the helper and webapp communication would be additional implementation work.

## Browser requirements

[Chrome's official Web Bluetooth guide](https://developer.chrome.com/docs/capabilities/bluetooth) documents BLE GATT connections, characteristic writes and notifications on Windows. It requires a secure context and a user gesture for device selection. A “Connect Chessnut” button can request a device by its advertised name and include both custom service UUIDs in `optionalServices`. Device discovery does not require a browser extension.

The [Web Bluetooth specification](https://bluetooth.spec.whatwg.org/#device-discovery) grants access to a device and its requested services for an origin. Pairing or granting access on lichess.org does not grant our webapp access. Our site needs its own chooser grant. During initial testing, disconnect other board clients to avoid contention; simultaneous control has not been verified.

The [implementation status](https://github.com/whatwg/bluetooth/blob/main/implementation-status.md) lists Chrome's GATT API as shipped on Windows, macOS, Android and ChromeOS. Start with desktop Chrome on this PC and feature-detect `navigator.bluetooth`. Browser/platform support should be verified separately before promising support to all students.

## Fit with this application's trainer

Local code inspection found existing repertoire validation in [`PracticeSession.tsx`](../src/components/PracticeSession.tsx), with `handleMove` at line 96, `selectOpponentReply` at line 157, and `executeOpponentMove` at line 190. The practice tree already stores moves and positions; see [`practice.ts`](../src/types/practice.ts). No existing Bluetooth integration was found in `src`.

Recommended behavior:

1. Connect and require the physical position to match the lesson's start.
2. Convert a stable sensed position into a legal student move, then use existing repertoire validation.
3. Select the existing repertoire reply and illuminate its departure and arrival squares.
4. Let the student physically execute that reply. Advance only when the sensed position matches its target.
5. On a wrong move, wait for the previous valid position to be restored. Clear LEDs once the required placement is confirmed.

The synchronization change matters: `executeOpponentMove` currently immediately updates the digital position and may record completion. Physical-board mode needs a pending-reply state and must wait for placement before enabling the next student turn or recording completion. Sensor observations during lifts, captures, castling and promotion need reconciliation rather than treating every report as a completed move. Piece placement should be compared separately from full game metadata.

## Bounded first implementation

First build a connection/diagnostics screen that receives a position and lights two chosen squares on this Air. Then add board mode to practice sessions, including start-position matching, student moves, pending opponent placement, correction, reset and reconnect. Validate captures, castling, promotion and disconnect recovery before classroom use. The Air would indicate an opponent's move with lights; the student would move the pieces.
