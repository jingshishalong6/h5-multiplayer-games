# Device Accounts And Admin Adjustments Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add device-locked virtual point balances initialized to 1000, plus admin add/subtract controls.

**Architecture:** Add a small shared account store module used by the Node server. The browser creates and stores a `deviceId` in `localStorage`, sends it during join, and the server maps that device to one virtual balance. Admin adjustments are protected by `ADMIN_PIN` or default `888888`.

**Tech Stack:** Node.js, node:test, WebSocket, HTML5 localStorage, existing H5 UI.

---

## Tasks

### Task 1: Account Store

**Files:**
- Create: `public/src/accounts.js`
- Create: `tests/accounts.test.js`

- [ ] Test that a new device starts at 1000 points.
- [ ] Test that the same device does not reset to 1000 when rejoining.
- [ ] Test admin PIN verification and add/subtract adjustment.
- [ ] Implement the account store and run tests.

### Task 2: Server Integration

**Files:**
- Modify: `server.js`

- [ ] Require the account store.
- [ ] Read `deviceId` from join payload.
- [ ] Set client chips from the account balance.
- [ ] Persist balance after slot, baccarat, and poker changes.
- [ ] Add `adminAdjust` WebSocket action.

### Task 3: Client Integration

**Files:**
- Modify: `public/src/app.js`

- [ ] Create a stable browser `deviceId` in localStorage.
- [ ] Send deviceId on join.
- [ ] Add admin panel in side panel with PIN, target user, amount, plus/minus buttons.

### Task 4: Verification

**Files:**
- Existing tests and app.

- [ ] Run `npm test`.
- [ ] Run syntax checks.
- [ ] Restart local server and verify HTTP 200.
