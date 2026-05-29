# H5 Multiplayer Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployable H5 multiplayer entertainment room with Chinese chess, virtual slot, virtual baccarat, chat, and room codes.

**Architecture:** A Node.js HTTP server serves static files and owns all room/game state through WebSocket messages. Shared browser/server modules implement chess and virtual-casino rules so tests can cover the same logic that the app uses. The H5 client renders responsive Tailwind UI and sends intent messages; the server remains authoritative.

**Tech Stack:** Node.js, `ws`, `node:test`, HTML5, JavaScript, Tailwind CDN, CSS.

---

## File Structure

- `package.json`: scripts and dependencies.
- `server.js`: static file server, WebSocket room orchestration, action routing.
- `public/index.html`: H5 shell.
- `public/src/chess.js`: shared Chinese chess rules, legal moves, check/checkmate helpers.
- `public/src/casino.js`: shared slot and baccarat virtual-chip rules.
- `public/src/app.js`: browser state, rendering, drag/tap interactions, WebSocket client.
- `public/src/styles.css`: board geometry and visual polish.
- `tests/chess.test.js`: chess rule tests.
- `tests/casino.test.js`: slot/baccarat tests.
- `README.md`: local and Render/Railway deployment.

## Tasks

### Task 1: Project Skeleton And Failing Tests

**Files:**
- Create: `package.json`
- Create: `tests/chess.test.js`
- Create: `tests/casino.test.js`

- [ ] Create Node scripts for `npm start` and `npm test`.
- [ ] Write tests for horse blocking, cannon capture screens, flying general, checkmate detection, slot payout, and baccarat drawing.
- [ ] Run `npm test`; expected failure because shared modules do not exist yet.

### Task 2: Shared Game Rules

**Files:**
- Create: `public/src/chess.js`
- Create: `public/src/casino.js`

- [ ] Implement board initialization and legal move validation for all Chinese chess piece types.
- [ ] Implement check and checkmate detection by simulating legal replies.
- [ ] Implement deterministic-testable slot result resolution and baccarat dealing/drawing.
- [ ] Run `npm test`; expected pass.

### Task 3: Multiplayer Server

**Files:**
- Create: `server.js`

- [ ] Serve `public` static assets.
- [ ] Handle WebSocket join, chat, chess move, undo request/response, reset request/response, slot spin, baccarat bet, and baccarat deal actions.
- [ ] Keep room state in memory and broadcast state after every accepted action.
- [ ] Run `npm test`; expected pass.
- [ ] Run `node server.js`; expected server listens on `PORT` or `3000`.

### Task 4: H5 Client

**Files:**
- Create: `public/index.html`
- Create: `public/src/app.js`
- Create: `public/src/styles.css`

- [ ] Build join screen with nickname and room code.
- [ ] Render responsive tabs for chess, entertainment, chat, and room users.
- [ ] Render Chinese chess board with tap and drag moves, legal destination highlights, captured/remaining pieces, turn/check/checkmate status.
- [ ] Render virtual slot and virtual baccarat controls with virtual-chip language only.
- [ ] Render chat and request dialogs.
- [ ] Verify manually with two browser tabs.

### Task 5: Documentation And Final Verification

**Files:**
- Create: `README.md`

- [ ] Document local run: `npm install`, `npm start`, open `http://localhost:3000`.
- [ ] Document Render/Railway deployment using `npm install` and `npm start`.
- [ ] Run `npm test`.
- [ ] Start the server and verify the H5 page responds locally.
