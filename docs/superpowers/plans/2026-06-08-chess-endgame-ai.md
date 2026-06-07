# Chess Endgame And AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Chinese chess endgame practice and human-vs-AI play to the existing H5 game.

**Architecture:** Keep board legality and preset setup logic in `public/src/chess.js`. Keep room mode switching and AI auto-move orchestration in `server.js`. Add compact controls to the existing chess panel in `public/src/app.js`.

**Tech Stack:** Node.js, WebSocket, vanilla HTML5 JavaScript, existing chess rule engine, optional Pikafish server engine.

---

### Task 1: Chess Core Presets

**Files:**
- Modify: `public/src/chess.js`
- Test: `tests/chess.test.js`

- [ ] Add failing tests for five endgame presets, preset board setup, human-vs-AI state metadata, and a legal AI move.
- [ ] Implement `listEndgames`, `createEndgameState`, and `createHumanVsAiState`.
- [ ] Preserve mode metadata through clone, move, and undo.

### Task 2: Server Mode And AI

**Files:**
- Modify: `server.js`

- [ ] Add `chessMode` WebSocket handler for standard, AI, and endgame-AI modes.
- [ ] Allow the human side to move in AI modes.
- [ ] After a human move, have AI reply using Pikafish when an admin is present, otherwise local expert search.
- [ ] Make undo/reset direct in AI modes.

### Task 3: Frontend Controls

**Files:**
- Modify: `public/src/app.js`

- [ ] Add chess mode buttons and endgame selector.
- [ ] Show current mode and human-vs-AI helper text.
- [ ] Bind controls to `chessMode`.

### Task 4: Verify And Ship

**Files:**
- Verify: `package.json`, `server.js`, `public/src/*.js`

- [ ] Run syntax checks.
- [ ] Run the full test suite.
- [ ] Commit and push to GitHub.
