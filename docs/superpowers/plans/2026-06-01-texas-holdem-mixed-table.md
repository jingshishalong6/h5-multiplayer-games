# Texas Holdem Mixed Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first playable Texas Holdem table that supports one player with bots or multiple real players in the same H5 room using virtual points only.

**Architecture:** Add a shared `poker.js` module for deck, hand evaluation, and a 2-6 seat Holdem state machine with simple bot actions. The existing Node WebSocket server owns table state and broadcasts it with the room state. The H5 client adds a `德州` tab with seats, community cards, private cards, pot, current action, and player buttons.

**Tech Stack:** Node.js, `node:test`, HTML5, JavaScript, CSS, existing WebSocket room service.

---

## File Structure

- `public/src/poker.js`: shared Texas Holdem cards, evaluator, table actions, bot actions, settlement.
- `tests/poker.test.js`: evaluator and state-machine tests.
- `server.js`: create room poker state, expose it in public state, route poker actions.
- `public/index.html`: include `poker.js` before `app.js`.
- `public/src/app.js`: add `德州` tab and render/bind table controls.
- `public/src/styles.css`: poker table visual styling.

## Tasks

### Task 1: Poker Evaluator

**Files:**
- Create: `tests/poker.test.js`
- Create: `public/src/poker.js`

- [ ] Write failing tests for royal flush, wheel straight, four of a kind, full house, kickers, and split pot equality.
- [ ] Implement deck helpers and `evaluateBestHand(cards)`.
- [ ] Run `npm test`; expected pass for evaluator tests.

### Task 2: Holdem Table State Machine

**Files:**
- Modify: `tests/poker.test.js`
- Modify: `public/src/poker.js`

- [ ] Add tests for starting a 6-seat mixed table with bots, blinds, private cards, legal call/raise/fold/all-in actions, street advancement, and showdown settlement.
- [ ] Implement `createHoldemTable`, `startHand`, `applyAction`, `runBots`, and `publicHoldemState`.
- [ ] Keep first version simple but complete: 2-6 seats, small blind 5, big blind 10, bots fill empty seats, one pot settlement, folded players excluded.
- [ ] Run `npm test`; expected pass.

### Task 3: Server Integration

**Files:**
- Modify: `server.js`

- [ ] Initialize room poker state.
- [ ] Include public poker state in broadcasts.
- [ ] Route `pokerStart`, `pokerAction`, and `pokerSetBotCount` messages.
- [ ] Run `npm test` and `node --check server.js`.

### Task 4: H5 UI

**Files:**
- Modify: `public/index.html`
- Modify: `public/src/app.js`
- Modify: `public/src/styles.css`

- [ ] Add `德州` tab.
- [ ] Render seats, pot, stage, community cards, own cards, winner message, and action buttons.
- [ ] Add bot count/start controls.
- [ ] Bind fold/call/raise/all-in actions.
- [ ] Run syntax checks.

### Task 5: Local Verification

**Files:**
- Existing project.

- [ ] Run `npm test`.
- [ ] Run `node --check public/src/app.js public/src/poker.js server.js`.
- [ ] Restart local server and confirm HTTP 200.
