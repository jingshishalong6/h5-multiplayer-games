# H5 Multiplayer Games Design

## Goal

Build a browser-based entertainment room for coworkers. The app runs as an H5 page on phones and desktop browsers, with a lightweight Node.js service for public WebSocket rooms. It includes Chinese chess, virtual-slot play, virtual baccarat play, room chat, spectators, and virtual chips only.

The app does not support real money, deposits, withdrawals, payment, cash-out, or account balances with real-world value.

## Deployment Model

- A single Node.js app serves static H5 files and the WebSocket room service.
- `npm start` runs the app for local testing or Render/Railway deployment.
- Render/Railway can expose one public URL; all players open that URL in a browser.
- WebSocket uses the same host as the page, so users do not need to type a separate server address on hosted deployments.

## Main User Flow

1. User opens the URL.
2. User enters nickname and room code.
3. User joins the room.
4. First two users become red and black chess players; later users become spectators.
5. Users can switch between Chinese chess, entertainment table, and chat.
6. All room members see synchronized board state, messages, chip totals, slot results, and baccarat rounds.

## Games

### Chinese Chess

- Standard 9x10 Chinese chess board.
- Full starting pieces for both sides.
- Drag/tap piece selection and legal destination highlighting.
- Legal movement for king, advisor, elephant, horse, rook, cannon, and soldier.
- Capture rules, cannon screen capture, palace limits, river rules, flying-general rule.
- Turn order: red moves first.
- Check, checkmate, and stalemate-like no-legal-move detection.
- Undo request: current player asks, opponent can accept or reject.
- Reset request: either player asks; opponent can accept or reject.
- Spectators can view but cannot move.
- Captured pieces / remaining pieces display for both sides.

### Slot Game

- Uses virtual chips only.
- Player chooses a small virtual bet.
- Server decides result and broadcasts symbols, payout, and updated chip total.
- No real-money wording, no top-up, no withdrawal.

### Baccarat Game

- Uses virtual chips only.
- Players can place virtual bets on Player, Banker, or Tie before a round is dealt.
- Server shuffles/deals using simplified standard baccarat drawing rules.
- Server broadcasts cards, winner, payouts, and updated chip totals.
- No real-money wording, no top-up, no withdrawal.

## Room And Networking

- Rooms are keyed by a short text room code.
- Server keeps in-memory room state.
- Reconnecting with the same nickname creates a fresh session; persistent accounts are out of scope.
- Chat is room-scoped.
- Server broadcasts authoritative game state after every action.
- In-memory state resets when the server restarts.

## UI Direction

- Clean Chinese-inspired style: light paper background, ink text, muted red accent, simple borders.
- Mobile-first responsive layout.
- Desktop layout can show board and side panels together.
- H5-friendly interactions: tap-to-select plus drag-and-drop where supported.
- Tailwind CSS via CDN for easy direct development.

## Files

- `package.json`: Node scripts and dependencies.
- `server.js`: HTTP static server plus WebSocket room/game logic.
- `public/index.html`: H5 shell and Tailwind import.
- `public/src/app.js`: client UI and interactions.
- `public/src/styles.css`: custom board and responsive styles.
- `README.md`: local run and Render/Railway deployment instructions.

## Testing And Verification

- Add Node unit tests for chess legal moves, check/checkmate, slot payouts, and baccarat round resolution.
- Run tests before implementation completion.
- Manually verify local browser play with two tabs in one room.
- Confirm the app can start with `npm start`.
