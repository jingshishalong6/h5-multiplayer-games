# Private Chess Hint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only Chinese chess "hint one move" feature that recommends a legal move to the current player without sending the hint to other players.

**Architecture:** `public/src/chess.js` will expose a deterministic `recommendMove(state, color)` helper built from existing legal-move validation. `public/src/app.js` will render a hint button, call the helper locally, and highlight the suggested source and target on the board. CSS will add visible but compact hint markers.

**Tech Stack:** HTML5, JavaScript, Tailwind CSS, Node.js `node:test`.

---

### Task 1: Chess Move Recommendation

**Files:**
- Modify: `tests/chess.test.js`
- Modify: `public/src/chess.js`

- [x] **Step 1: Write failing tests**

Add tests that expect `recommendMove` to prefer a checkmate and to prefer capturing a higher-value piece when no checkmate is present.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test tests/chess.test.js`
Expected: FAIL because `recommendMove` is not exported.

- [x] **Step 3: Implement minimal recommendation helper**

Add material values, iterate every legal move for the requested side, score checkmate, check, captures, and board material.

- [x] **Step 4: Run tests**

Run: `npm test tests/chess.test.js`
Expected: PASS.

### Task 2: Local UI Hint Button

**Files:**
- Modify: `public/src/app.js`
- Modify: `public/src/styles.css`

- [x] **Step 1: Add local state**

Track `model.chessAdvice` with `{ from, to, score }` and clear it on remote state updates or manual selections.

- [x] **Step 2: Add button and handler**

Render `提示一步`; when clicked, call `ChessCore.recommendMove(game, model.you.role)` only in the browser.

- [x] **Step 3: Add board markers**

Render a ring around the suggested piece and a gold target marker on the recommended landing point.

- [x] **Step 4: Run full verification**

Run syntax checks, `npm test`, restart local server, and push to GitHub.
