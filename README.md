# agent.me / nostr prototype

A working sketch of the broadcasting interaction pattern for a "me agent" — built on Nostr, with manual user approval gates on every byte leaving and entering the user agent's context. Vendor agents are treated as untrusted black boxes; one of them is intentionally hostile to demonstrate why the inbound gate matters.

## What this demonstrates

1. **Broadcasting over Nostr.** The user agent publishes a NIP-90 kind 5050 query event tagged `#t:agent-me-cat-shoes`. Four independent vendor agent processes subscribe to that tag and respond with kind 6050 events. No persistent channel, no negotiation, no shared state.
2. **Outbound disclosure gate.** Before publishing, a modal shows the exact question, tags, target relays, and the user pubkey that will be visible. The user must approve, edit, or cancel.
3. **Inbound trust gate.** Every reply pops a modal showing the sender's pubkey, claimed display name (from kind 0), and the raw plain-text reply. The user clicks include, skip, or trust-and-include. Reply content is rendered with `.textContent`, so embedded HTML cannot escape into the app chrome.
4. **Whitelist escape hatch.** Trusted pubkeys auto-include without prompting. Stored in localStorage; revocable in the sidebar.
5. **Rogue agent (the load-bearing part of the demo).** One vendor publishes a canned prompt-injection payload — "IGNORE PREVIOUS INSTRUCTIONS..." — claiming a deceptive display name. In the inbound gate the user sees the injection in plain text and hits Skip. The downstream LLM summarizer never sees the rogue's payload. The security boundary works in front of you.

## What this does **not** do

- **No privacy.** All Nostr traffic is unencrypted and on public relays. Your user pubkey is stable across queries → cross-query linkability. Anyone subscribing to `#t:agent-me` tags can see your question, your pubkey, every vendor reply. The next prototype's job: ephemeral per-query keys, NIP-44 encrypted replies, or a private relay with NIP-42 auth.
- **No disclosure-card negotiation.** v1 sends the full atomic question in one shot. Lucky's progressive-disclosure pattern is a separate prototype.
- **No Lightning / bidding.** NIP-90 supports `amount` tags and zap-able results; this prototype ignores them.
- **No back-and-forth.** Atomic Q&A only. If you want more, send another broadcast.
- **No persistent memory or "we agent" coordination.**
- **No TEE / enclave.**

## Architecture

```
┌──────────────────────┐                       ┌──────────────────────┐
│  USER AGENT (web)    │                       │  VENDOR AGENTS (4)   │
│  - browser, holds    │                       │  - Node processes    │
│    user's nsec in    │   NIP-90 over Nostr   │  - each has own      │
│    localStorage      │  ◄──── kind 5050 ───► │    keypair + kind 0  │
│  - outbound gate     │  ◄──── kind 6050 ───► │    profile           │
│  - inbound gate      │   public relays       │  - Nike, Adidas,     │
│  - whitelist         │   (damus, nos.lol,    │    Vans, ROGUE       │
│                      │    nostr.mom)         │                      │
└──────────┬───────────┘                       └──────────────────────┘
           │ POST /summarize
           ▼
   ┌────────────────┐
   │  llm-proxy     │  ← keeps ANTHROPIC_API_KEY off the browser
   │  (Node, Hono)  │
   └────────────────┘
```

User's Nostr secret key lives in the browser only (localStorage). The OpenRouter API key lives only on the proxy server. Vendor agents persist their keypairs at `.vendor-keys/<name>.hex` so their pubkeys are stable across restarts (useful for the trusted-vendor whitelist demo).

## Run it

Prerequisite: Node.js 22+ and an [OpenRouter](https://openrouter.ai) API key.

```sh
cp .env.example .env
# edit .env and set OPENROUTER_API_KEY=sk-or-v1-...
# optional: change OPENROUTER_MODEL (default: anthropic/claude-haiku-4.5)

npm install
```

The summarizer LLM is called through OpenRouter, which is OpenAI-compatible. The default model is `moonshotai/kimi-latest`. Alternatives wired into `.env.example`: `qwen/qwen3.5-plus-20260420`, `google/gemma-4-26b-a4b-it`. Any chat-capable model on OpenRouter works — change `OPENROUTER_MODEL` in `.env`.

Open three terminals:

```sh
# Terminal A
npm run proxy

# Terminal B
npm run vendors

# Terminal C
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

## Demo script

1. Type *"What's a good size 10 sneaker for trail running?"*. Category: `shoes`. Click **Compose & review broadcast**.
2. **Outbound gate** appears. Review the question, the recipient tag, the relays, the privacy note. Click **Broadcast**.
3. The activity log shows the published event id. The listening window is 20 seconds.
4. As replies arrive, **inbound gates** queue up — one modal at a time.
   - Nike, Adidas, Vans return canned product pitches → click **Include** (or **Trust sender & include** to whitelist).
   - "Premium Shoe Advisor" (the rogue vendor) returns plain-text `IGNORE PREVIOUS INSTRUCTIONS...` → click **Skip**.
5. After the window closes, the proxy summarizes the *approved* replies only. The rogue payload never reaches the summarizer's context.
6. Run a second query — any vendors you trusted auto-include without prompting.

### Adversarial cross-check

To prove the inbound gate is load-bearing, you can comment out the `showInboundGate` call in `src/frontend/user-agent.ts` and re-run. The rogue's payload reaches the summarizer; the LLM (Claude) is generally robust to obvious injections like this but the *guarantee* you want is structural, not behavioral, and that guarantee is the gate.

### NIP-90 cross-check

Your kind 5050 events are real DVM job requests on public relays. You can find them in any DVM dashboard (e.g. [DVMDash](https://dvmdash.live)) by filtering for kind 5050 and the `#t:agent-me` tag.

## File layout

```
.
├── index.html                  frontend entry
├── package.json
├── server/
│   └── llm-proxy.ts            Hono server, POST /summarize, holds OPENROUTER_API_KEY
├── scripts/
│   └── run-vendors.ts          spawns the four vendor processes
├── src/
│   ├── shared/                 protocol primitives (kinds, NIP-90 builders, topic tags)
│   ├── vendors/
│   │   ├── base.ts             vendor harness: keys, profile, subscribe, reply
│   │   ├── nike.ts             canned pitch
│   │   ├── adidas.ts           canned pitch
│   │   ├── vans.ts             canned pitch
│   │   └── rogue.ts            canned prompt-injection payload
│   └── frontend/
│       ├── main.ts             UI bootstrap, log/whitelist views
│       ├── user-agent.ts       state machine: compose → outbound → broadcast → listen → inbound → summarize
│       ├── keys.ts             user keypair in localStorage
│       ├── whitelist.ts        trusted pubkeys in localStorage
│       ├── nostr-client.ts     SimplePool wrapper
│       ├── llm.ts              POST /summarize
│       └── ui/
│           ├── outbound-gate.ts
│           ├── inbound-gate.ts
│           └── styles.css
└── .vendor-keys/               generated at first run, persists vendor secret keys (gitignored)
```

## Why Nostr (and not just HTTPS)

Three properties the prototype actually leans on:

1. **Pub/sub via tags = broadcasting without a directory.** A "shoe vendor" agent doesn't need to register anywhere or be discovered. It just subscribes to a topic tag. New vendors can join an interaction pattern with zero coordination.
2. **Signed events = pubkey-as-identity, end-to-end.** Every event is cryptographically signed by the producing agent. The whitelist is pubkey-based, not name-based — display names from kind 0 are advisory only, and the UI always shows the pubkey alongside.
3. **Relays are dumb infrastructure.** No relay is trusted. Add or remove relays in `src/shared/topics.ts`. A relay that censors or drops events just gets routed around.

What Nostr does *not* give you and a real version would still need: encrypted private channels (NIP-04/44), private subscription patterns, payment rails (Lightning), reputation that resists Sybil attack, and the disclosure-card / progressive-discovery negotiation primitives discussed in the Bellagio breakout.
