// Short helper kept around purely for display formatting.
// The user's Nostr secret key now lives on the server (see server/nostr-bridge.ts),
// not in the browser, because the MCP `broadcast` tool signs and publishes there.
export const shortPubkey = (pk: string): string =>
  `${pk.slice(0, 8)}…${pk.slice(-4)}`;
