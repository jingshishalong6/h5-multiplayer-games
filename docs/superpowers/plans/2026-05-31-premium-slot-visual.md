# Premium Slot Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the virtual slot game to a premium red-gold animated visual experience while keeping it virtual-chip only.

**Architecture:** Keep server-side slot settlement authoritative and add the latest slot result to room state. Render an animated H5 slot cabinet in the existing casino tab with CSS animations, local spin timing, and result highlighting.

**Tech Stack:** Node.js, WebSocket, HTML5, JavaScript, CSS, Tailwind CDN.

---

### Task 1: Server State

**Files:**
- Modify: `server.js`

- [ ] Add `lastSlot` to room state.
- [ ] Store `resolveSlotSpin` result after every spin.
- [ ] Broadcast `lastSlot` with room state.

### Task 2: H5 Slot UI

**Files:**
- Modify: `public/src/app.js`
- Modify: `public/src/styles.css`

- [ ] Add client spin animation state.
- [ ] Replace simple slot text with premium red-gold cabinet markup.
- [ ] Add rolling reels, light bulbs, win flash, coin particles, and result panel.
- [ ] Keep all copy as virtual-chip entertainment language.

### Task 3: Verification

**Files:**
- Existing tests and app files.

- [ ] Run `npm test`.
- [ ] Run `node --check server.js` and `node --check public/src/app.js`.
- [ ] Start local server and verify HTTP 200.
