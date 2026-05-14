# PIN Protection — Planning

## Goal
Protect the Web UI with a random 4-digit PIN generated each time the server starts.
No external auth library. No persistent storage — PIN lives in memory only.

---

## Server startup

```
npm run ui

🔑  PIN: 4829
🌐  Local:   http://localhost:3000
📱  Network: http://192.168.x.x:3000
```

PIN is regenerated every restart. Share it manually with whoever needs access.

---

## Auth flow

```
1. User opens any page / calls any API
2. Middleware checks cookie "auth"
   ├── valid   → pass through normally
   └── missing → redirect to /pin.html (pages) or 401 (API)

3. User enters 4-digit PIN on /pin.html
4. POST /api/auth { pin }
   ├── correct → Set-Cookie: auth=<token>; HttpOnly; SameSite=Strict
   │             redirect back to /
   └── wrong   → { error: 'Invalid PIN' } + increment fail count

5. After 5 wrong attempts → lock for 30 seconds
```

---

## Token

No JWT, no session store. Cookie value = `sha256(PIN + secret)` where secret is
a random string also generated at startup. Server re-validates by recomputing the hash.

---

## Files to create / modify

### New
- `server/routes/auth.js`     — POST /api/auth
- `server/public/pin.html`    — PIN entry page (self-contained, no external deps)

### Modify
- `server/index.js`           — generate PIN + secret, print PIN, mount auth middleware + route
- `server/lib/auth.js`        — authMiddleware(), generatePin(), makeToken(), verifyToken()

---

## Middleware logic

```
Exempt (no auth needed):
  GET  /pin.html
  GET  /shared.css
  POST /api/auth

Protected (all others):
  GET  /            → redirect /pin.html if no valid cookie
  GET  /api/*       → 401 { error: 'Unauthorized' } if no valid cookie
  GET  /reader.html
  GET  /ebook-reader.html
  GET  /local-reader.html
```

Static files (CSS, JS, img) other than shared.css also need protection
so the UI can't be partially loaded without PIN.

---

## Rate limiting (brute-force protection)

In-memory counter per IP:
- 5 wrong attempts → lockout for 30s
- Reset on correct PIN or after lockout expires

---

## UI changes

### pin.html (new)
- 4 individual digit inputs, auto-advance on input
- Paste support (paste "4829" → fills all 4)
- Submit on 4th digit entered
- Error message on wrong PIN
- Lockout countdown timer if rate-limited
- Reuses shared.css + background image

### index.js / reader.js / ebook-reader.js
- On fetch 401 → `location.href = '/pin.html'`
- No other changes needed (middleware handles redirect for page loads)

---

## Out of scope
- Persistent sessions across server restarts (PIN resets = all sessions invalidated anyway)
- Multi-user / different PINs
- HTTPS (use cloudflared tunnel which provides HTTPS termination)
