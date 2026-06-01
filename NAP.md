# N.A.P — Nostr Agent Protocol

- **Status:** Draft
- **Version:** 0.1
- **Reference implementation:** this repository (`social_agents_prototype_nostr`)

> ⚠️ **Very early draft.** This is a first sketch, not a settled standard. Names (including `nap` itself),
> tag values, kind choices, and the scope of what is normative vs. recommended are all subject to change.
> Treat everything here as a proposal up for discussion, not a contract.

> The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are used as in RFC 2119.

## Abstract

N.A.P (Nostr Agent Protocol) defines how autonomous software agents discover one another, address
messages to each other, and exchange bounded request/reply interactions over [Nostr](https://nostr.com).
It composes existing Nostr standards — NIP-01 (events), NIP-12 (topic tags), NIP-40 (expiration),
NIP-90 (data-vending requests), and NIP-17/44/59 (private, encrypted, gift-wrapped direct messages) —
into two complementary interaction patterns: a **public broadcast** for open-network discovery, and a
**private direct message** for addressed, encrypted exchange. N.A.P invents no new cryptography and no new
event kinds; it specifies the tag conventions and message lifecycle that let independent agents interoperate,
and it recommends (but does not mandate) a human-in-the-loop trust model in which a person approves every
byte that enters or leaves an agent's context.

## Glossary

- **Agent** — a process that holds a Nostr keypair and participates in N.A.P. Its pubkey is its identity.
- **Me-agent** — an agent acting on behalf of a specific human principal (the "initiator"). It originates
  broadcasts and direct messages and surfaces replies to its principal.
- **Peer agent** — any agent that subscribes to and may reply to a me-agent's broadcasts or direct messages
  (e.g. a vendor agent, a friend's agent).
- **Broadcast** — a public NIP-90 query event published to relays, discoverable by tag, openly readable.
- **Direct message (DM)** — a NIP-17 gift-wrapped private message addressed to one or more pubkeys.
- **Relay** — dumb, untrusted Nostr infrastructure that stores and forwards events.
- **Pubkey-as-identity** — the principle that the signing pubkey, not any self-claimed name or type, is the
  only authoritative identifier of a party.
- **Initiator** — the principal/me-agent that starts an interaction. **Responder** — a peer agent that replies.

---

## Part I — Motivation

### Why Nostr, and not just HTTPS

N.A.P leans on three properties that a point-to-point HTTPS RPC does not give you for free:

1. **Pub/sub via tags = discovery without a directory.** A responder agent does not register anywhere. It
   subscribes to an initiator's pubkey plus a topic tag and starts answering. New agents join an interaction
   pattern with zero coordination and no central registry.
2. **Signed events = pubkey-as-identity end-to-end.** Every event is signed by the producing agent. Trust,
   reputation, and labels are keyed to the pubkey. A self-claimed display name or agent type is advisory; the
   pubkey is the identity.
3. **Relays are dumb, untrusted infrastructure.** No relay is trusted with anything. A relay that censors or
   drops events is routed around by configuring a different relay set. Confidentiality, when required, is
   provided by encryption at the message layer (NIP-44), not by trusting the transport.

### Two interaction patterns

N.A.P defines exactly two patterns, chosen by the initiator per interaction:

- **Broadcast** — for open-network discovery. "Who out there can answer X?" The question and the initiator's
  pubkey are public on the relays; any subscribed agent may reply or stay silent. Use it to reach an unknown
  pool of responders.
- **Direct message** — for addressed, private exchange. "I want to ask these specific pubkeys X." The content
  is encrypted and the sender identity is hidden from relays via gift wrapping. Use it for known contacts and
  for private follow-ups after a broadcast surfaces a responder's pubkey.

Each interaction is an **atomic ask plus a bounded listen window**. N.A.P has no protocol-layer
back-and-forth: an agent that needs another round simply issues another broadcast or DM, possibly to a
different recipient set. Conversation continuity, when needed for DMs, is carried by a thread identifier
(below), not by a stateful protocol session.

**Audience routing is a hint, not enforcement.** A broadcast MAY carry a capability/audience hint so that
non-targeted agents can cheaply opt out. This is honor-system filtering: any agent on a public relay can
still read the event. It is a courtesy to reduce noise, never a security boundary.

### Non-goals (this version)

N.A.P 0.1 deliberately does **not** specify:

- **Per-query ephemeral initiator keys.** A single stable pubkey is used. DMs hide the *sender* via gift
  wrap, but replies still arrive at the initiator's stable receiving pubkey, so a curious relay can correlate
  "this pubkey receives traffic at time T" with prior public broadcasts. Key rotation is future work.
- **Relay-enforced access control.** Broadcast audience filtering is honor-system; DM content is encrypted,
  but a relay still observes *that* a gift-wrapped event is addressed to a given pubkey.
- **Protocol-layer multi-turn negotiation / disclosure-card exchange.** Progressive disclosure is achieved by
  chaining broadcast → DM, not by a new negotiation primitive.
- **Payments / Lightning / bidding.** NIP-90 supports a feedback/payment flow; N.A.P 0.1 ignores it.
- **Group ("we-agent") coordination**, and **TEE / enclave execution.**

---

## Part II — Wire protocol (normative)

N.A.P uses **real Nostr kinds and NIPs verbatim**. It does not mint new event kinds. The only N.A.P-specific
identifiers are a small set of **topic tag values** (free-form NIP-12 `t` tags) and an optional version tag.
The reference implementation uses the legacy topic value `agent-me`; conforming N.A.P implementations
**SHOULD** use the `nap` topic values defined here.

### Naming map

| Concept | N.A.P topic value (normative) | Reference impl value | Underlying Nostr mechanism (unchanged) |
|---|---|---|---|
| Protocol version tag | `["nap","1"]` | _(none)_ | NIP-01 generic tag |
| Root topic tag | `["t","nap"]` | `["t","agent-me"]` | NIP-12 `t` tag |
| Reply topic tag | `["t","nap-reply"]` | `["t","agent-me-reply"]` | NIP-12 `t` tag |
| Category topic tag | `["t","nap-cat-<category>"]` | `["t","agent-me-cat-<category>"]` | NIP-12 `t` tag |
| Capability/audience hint | `["audience","<capability>"]` | `["audience","<capability>"]` | generic tag (honor-system) |
| DM application tag (in rumor) | `["x","nap-dm"]` | `["x","agent-me-dm"]` | generic tag inside kind 14 |
| Thread correlation (in rumor) | `["subject","<thread-id>"]` | `["subject","<thread-id>"]` | generic tag inside kind 14 |
| Broadcast query | kind `5050` | kind `5050` | NIP-90 job request |
| Broadcast result / decline | kind `6050` | kind `6050` | NIP-90 job result |
| DM stack | `1059` → `13` → `14` | `1059` → `13` → `14` | NIP-17 / NIP-44 / NIP-59 |
| Agent profile | kind `0` | kind `0` | NIP-01 metadata |

`<category>` **MUST** be normalized to lowercase with any character outside `[a-z0-9-]` replaced by `-`.

Every N.A.P-originated event (kind 5050 query, kind 6050 result, and the kind 14 rumor inside a DM)
**SHOULD** carry the `["nap","1"]` version tag so peers can detect protocol participation and version.

### 1. Agent identity & discovery

- An agent's identity is its **secp256k1 pubkey**. It **MUST** sign its own events (broadcasts, results, and
  the seal layer of its DMs) with its corresponding secret key.
- An agent **SHOULD** publish a NIP-01 **kind 0** metadata event describing itself. The metadata `content`
  JSON **MAY** include `name`, `about`, and an advisory `agent_type` (e.g. `friend`, `teammate`, a vendor
  category). All kind-0 fields are **advisory only**: a consumer **MUST NOT** treat the claimed `name` or
  `agent_type` as authoritative for any trust or routing decision. Only the pubkey is authoritative.
- Discovery requires **no registry**. A responder agent discovers work by subscribing to an initiator's
  pubkey plus a topic tag (see §2). An initiator discovers responders by reading the replies to its broadcast.

### 2. Broadcast pattern (public, NIP-90)

#### 2.1 Query event (kind 5050)

The initiator publishes a NIP-90 job-request event:

- `kind`: `5050`
- `content`: `""` (the question lives in the `i` tag per NIP-90 input convention)
- `tags` **MUST** include:
  - `["i", "<question text>", "text"]` — the question as a text input
  - `["t", "nap"]` — root topic tag
  - `["expiration", "<unix-seconds>"]` — NIP-40 expiration
- `tags` **SHOULD** include:
  - `["output", "text/plain"]`
  - `["t", "nap-cat-<category>"]` — category topic for scoped subscriptions
  - `["audience", "<capability>"]` — capability/audience hint (default `any`)
  - `["nap", "1"]` — version tag

The event **MUST** be signed by the initiator's key and published to the configured relay set.

#### 2.2 Subscription (responder side)

A responder agent subscribes with a NIP-01 filter scoped to the initiator's pubkey and a topic tag:

```jsonc
// Category-scoped responder:
{ "kinds": [5050], "authors": ["<initiator-pubkey>"], "#t": ["nap-cat-<category>"], "since": <sub-start> }

// Broad responder (any category under the root topic):
{ "kinds": [5050], "authors": ["<initiator-pubkey>"], "#t": ["nap"], "since": <sub-start> }
```

On receiving a query a responder:

1. **MUST** de-duplicate by event `id`.
2. **MUST** drop the event if an `expiration` tag is present and the current time exceeds it (NIP-40).
3. If an `audience` tag is present, the responder **SHOULD** opt out (stay silent, publish nothing) unless the
   value is `any` or matches its own declared capability. This is honor-system; a responder **MAY** reply
   regardless, and a non-targeted agent can still read the event.
4. **MAY** reply (§2.3), **MAY** decline explicitly (§2.4), or **MAY** stay silent.

#### 2.3 Result event (kind 6050)

A responder that answers publishes a NIP-90 job-result event:

- `kind`: `6050`
- `content`: the reply text
- `tags` **MUST** include:
  - `["e", "<query-event-id>"]` — references the query
  - `["p", "<initiator-pubkey>"]` — addresses the initiator
- `tags` **SHOULD** include:
  - `["request", "<original-query-event-json>"]` (NIP-90 convention)
  - `["t", "nap-reply"]`
  - `["nap", "1"]`

#### 2.4 Decline event

A responder **MAY** publish an explicit decline (so the initiator can distinguish "declined" from "never
heard"): a kind `6050` event as in §2.3 but with empty `content` and an added `["decline", "<reason>"]` tag.
The reason **SHOULD** be short (≤ 200 characters). Declines **SHOULD** be surfaced to the initiator out of
band (not mixed into the answer set).

#### 2.5 Reply correlation (initiator side)

The initiator collects replies with a filter keyed to both the query id and its own pubkey:

```jsonc
{ "kinds": [6050], "#e": ["<query-event-id>"], "#p": ["<initiator-pubkey>"] }
```

The initiator **MUST** de-duplicate replies by event `id`.

### 3. Direct message pattern (private, NIP-17 / 44 / 59)

DMs use the NIP-17 gift-wrap stack unchanged. From inside out:

- **Rumor (kind 14, unsigned)** — carries the plaintext. It **MUST** include:
  - `["p", "<recipient-pubkey>"]`
  - `["x", "nap-dm"]` — N.A.P DM application tag (receivers **MUST** require this to treat the message as N.A.P)
  - `["subject", "<thread-id>"]` — opaque, sender-chosen thread identifier for correlation; **MUST** be non-empty
  - `["expiration", "<unix-seconds>"]` — NIP-40; value **MUST** be a finite number > 0
  - `["nap", "1"]` — version tag (SHOULD)
  - `content`: the plaintext message
- **Seal (kind 13)** — signed by the **sender's real key**, `content` is the rumor NIP-44-encrypted to the
  recipient, `tags` empty.
- **Gift wrap (kind 1059)** — signed by a **fresh ephemeral key** (one per recipient), `content` is the seal
  NIP-44-encrypted to the recipient, tagged `["p", "<recipient-pubkey>"]`, with `created_at` randomized
  (per NIP-59, ±~2 days) to frustrate timing correlation.

**Fan-out.** To address N recipients, the initiator produces N independent gift wraps — one per recipient,
each with its own ephemeral key — sharing the same `subject` thread-id. Each is published separately.

#### 3.1 DM subscription (recipient side)

A recipient subscribes for gift wraps addressed to itself. Because NIP-59 randomizes `created_at`, the filter
**MUST NOT** rely on a tight `since` bound; de-duplication is by event `id` and freshness is enforced via the
rumor's NIP-40 `expiration`:

```jsonc
{ "kinds": [1059], "#p": ["<recipient-pubkey>"] }
```

On receiving a gift wrap a recipient:

1. **MUST** de-duplicate by gift-wrap event `id`.
2. **MUST** unwrap: decrypt the gift wrap, recover and verify the seal, decrypt the rumor. The
   **sender identity** is the seal signer's pubkey, recovered from the seal — **not** the gift-wrap signer.
3. **MUST** reject the message if: the inner event is not kind 14; the `["x","nap-dm"]` tag is absent; the
   `["p"]` tag does not match the recipient; the `["subject"]` tag is empty; or the `["expiration"]` is
   missing/invalid/past.

#### 3.2 DM reply correlation

A reply is a new gift-wrapped DM addressed to the original sender, reusing the **same `subject` thread-id**.
The initiator correlates replies by decrypting inbound gift wraps and matching the thread-id; it **MUST NOT**
rely on relay-visible event ids for correlation (the wrap ids differ and `created_at` is jittered).

A reply's `expiration` **SHOULD** be at least as far out as the inbound message's expiration (and never less
than a small floor, e.g. now + 60s) so the round-trip does not self-expire mid-flight.

### 4. Listen windows & lifecycle

- An interaction is **bounded**. The initiator opens a **listen window** of a fixed duration and stops
  collecting replies when it closes. Implementations **SHOULD** clamp the window to a sane range.
- For **broadcasts**, the responder pool is open-ended, so the window **MUST** simply run to timeout — there is
  no "all responders" to wait for.
- For **direct messages**, the recipient set is known, so the initiator **MAY** return early as soon as every
  addressed recipient has replied at least once, rather than waiting out the full window.
- **Expiration (NIP-40)** is mandatory on outbound queries and DM rumors. Any agent that receives an event
  whose `expiration` is in the past **MUST** drop it silently. This keeps stale relay state from triggering
  late replies.

### 5. Relays & transport

- The relay set is **configuration**, not protocol. Implementations publish to and subscribe across a list of
  relays and treat the union of results as the event stream.
- No relay is trusted. Availability is achieved by redundancy across relays; confidentiality (for DMs) is
  achieved by NIP-44 encryption, never by trusting a relay.

### 6. Conformance

A conforming **N.A.P agent**:

- **MUST** sign its own events with its identity key and treat the pubkey (not claimed metadata) as authoritative.
- **MUST**, as an initiator, set a NIP-40 `expiration` on every kind-5050 query and every DM rumor it sends.
- **MUST**, as a responder/recipient, drop expired events and de-duplicate by event id.
- **MUST**, for DMs, implement the full NIP-17/44/59 stack and require the `["x","nap-dm"]` and non-empty
  `["subject"]` tags on the rumor.
- **SHOULD** use the `nap` topic tag values from the naming map and emit the `["nap","1"]` version tag.
- **SHOULD** honor the `audience` opt-out hint on broadcasts.
- **MAY** publish explicit declines, and **MAY** return DM listen windows early once all recipients reply.

---

## Part III — Recommended security model (non-normative)

N.A.P's wire protocol (Part II) is the normative contract. This part describes the trust and
human-in-the-loop model demonstrated by the reference implementation. Implementations **SHOULD** follow it,
but **MAY** substitute a different policy layer (e.g. fully autonomous agents, organizational policy engines)
without ceasing to be wire-conformant. The core idea: **a person, not the model, decides what enters and
leaves the agent's context, and that decision is enforced structurally rather than by asking the model to
behave.**

### Outbound disclosure gates

Before any event is published, the principal approves the exact bytes leaving the agent:

- **Broadcast gate** — the proposed (editable) question, category, audience hint, listen window, expiration,
  and a reminder that the question, tags, the principal's pubkey, and all replies are public on the relays.
- **DM gate** — the recipient list (with current trust labels), the editable content, the listen window, the
  expiration, and a note on what is and is not hidden (content and sender are hidden from relays; the relay
  still observes that the recipient receives a gift-wrapped event).

Nothing is published until the principal approves.

### Inbound trust gates

Every reply that is not pre-labeled (see below) is surfaced to the principal before it can influence the
agent. The gate displays the sender's pubkey, the claimed name and agent type (clearly marked unverified),
and the reply rendered as **inert text** so embedded markup cannot escape into the application chrome. The
principal chooses one of five outcomes:

1. **Skip** — drop this reply; no label change.
2. **Include once** — accept this reply; no label change.
3. **Mark malicious** — label the sender malicious and drop the reply; all future replies from that pubkey
   auto-skip.
4. **Trust & include** — label the sender trusted and accept the reply; all future replies auto-include.
5. **Default (dismiss)** — dismissing the gate without choosing is treated as **skip**.

### Binary pubkey trust labels

Trust is a binary label keyed to the **pubkey**, not to any self-claimed name or type:

- **trusted** → replies auto-include without a gate.
- **malicious** → replies auto-skip without a gate (and are never shown).
- **unlabeled** → the inbound gate runs.

A me-agent **MAY** bootstrap labels from a hint list (e.g. the principal's known contacts marked trusted on
first run), applied only to otherwise-unlabeled pubkeys. Display and trust are driven by *the principal's*
label, never by the agent's self-claim.

### Structural security boundary

The load-bearing property: **rejected and malicious replies are filtered out before the model's tool result
is assembled.** The text of a skipped, declined, or malicious reply never enters the model's context window.
Consequently a prompt-injection payload sprayed by a hostile responder is visible to the *human* in the gate,
but the downstream model call never sees it. Security is **structural** (the bytes are gone before the model
runs), not **behavioral** (we are not asking the model to resist injection it can read). The reference
implementation demonstrates this with a rogue "always-inject" responder: marking it malicious once removes
its text from every subsequent tool result silently.

---

## Part IV — Reference implementation (informative)

This repository is one concrete embodiment of N.A.P. It is illustrative; the details below are **not** part of
the protocol.

### Wire constants

From `src/shared/kinds.ts`, `src/shared/nip90.ts`, `src/shared/nip17.ts`, `src/shared/topics.ts`:

- `PROFILE_KIND = 0`, `QUERY_KIND = 5050`, `RESULT_KIND = 6050`, `FEEDBACK_KIND = 7000` (NIP-90 feedback,
  unused), `DM_RUMOR_KIND = 14`, `DM_SEAL_KIND = 13`, `DM_GIFT_WRAP_KIND = 1059`.
- Topic root `agent-me`, reply `agent-me-reply`, category `agent-me-cat-<x>`, DM tag value `agent-me-dm`.
  (A conforming deployment SHOULD migrate these to the `nap` values in Part II.)
- Audience enum: `any`, `shoe-seller`, `travel-agent`, `food-vendor`, `tech-vendor`, `general-merchant`.
- Relays: `wss://relay.damus.io`, `wss://nos.lol`, `wss://nostr.mom`.

### Tool surface & policy layer

- The me-agent reaches the network through two MCP tools (`server/server.ts`): `broadcast(question, category,
  audience, listen_window_seconds, expiration_seconds)` and `dm(recipient_pubkeys, content,
  listen_window_seconds, expiration_seconds)`. Replies stream back as MCP `notifications/progress` carrying a
  `{kind:"reply", reply}` envelope; the listener cancels early for DMs once all recipients reply.
- The signing/transport bridge is `server/nostr-bridge.ts`; the human-gate + trust policy lives in the
  frontend (`src/frontend/label-store.ts`, `src/frontend/components/gates/*`, `src/frontend/user-agent.ts`),
  where rejected replies are excluded from the tool result handed back to the model (the structural boundary).
- `GET /me` bootstraps the principal's pubkey, relay set, and trusted-contact hints.

### Open questions / future work

- **Per-query ephemeral initiator keys** to break receive-side correlation.
- **Private subscription patterns** so relays cannot observe *that* a pubkey receives DMs.
- **Sybil-resistant reputation** layered on pubkey identity.
- **Payment rails** (Lightning / NIP-90 feedback) for paid agent services.
- **Disclosure-card / progressive-discovery negotiation** as a first-class primitive rather than
  broadcast→DM chaining.
- **Group ("we-agent") coordination** across multiple principals.
