// Smoke test for the teammate calendar MCP tools.
// Run with the server already running: `npx tsx scripts/smoke-test-calendar.ts`
// Verifies check_availability returns seeded conflicts, book_slot creates
// events, and double-bookings are rejected.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fs from 'node:fs';
import path from 'node:path';
import { getPublicKey } from 'nostr-tools/pure';

const priyaHex = fs
  .readFileSync(path.join(process.cwd(), '.vendor-keys', 'priya.hex'), 'utf8')
  .trim();
const priyaPk = getPublicKey(Uint8Array.from(Buffer.from(priyaHex, 'hex')));

const transport = new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp'));
const client = new Client({ name: 'smoke-test-calendar', version: '0.0.0' });
await client.connect(transport);

console.log('connected. priya pk:', priyaPk.slice(0, 12));

const tools = await client.listTools();
console.log('tools available:', tools.tools.map((t) => t.name).join(', '));

// This-week Tuesday — Priya has "roadmap review (PM team)" 10:00-11:00.
const now = new Date();
const day = now.getDay();
const diff = day === 0 ? -6 : 1 - day;
const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
const tuesday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 1);
const pad = (n: number) => String(n).padStart(2, '0');
const tueIso = (h: number, m: number) =>
  `${tuesday.getFullYear()}-${pad(tuesday.getMonth() + 1)}-${pad(tuesday.getDate())}T${pad(h)}:${pad(m)}:00`;

console.log('\n--- check Tue 10:00-10:30 (expect conflict: roadmap review) ---');
const check1 = await client.callTool({
  name: 'check_availability',
  arguments: { pubkey: priyaPk, start_iso: tueIso(10, 0), end_iso: tueIso(10, 30) },
});
console.log(JSON.stringify(check1.content, null, 2));

console.log('\n--- check Tue 14:00-14:30 (expect free) ---');
const check2 = await client.callTool({
  name: 'check_availability',
  arguments: { pubkey: priyaPk, start_iso: tueIso(14, 0), end_iso: tueIso(14, 30) },
});
console.log(JSON.stringify(check2.content, null, 2));

console.log('\n--- book Tue 14:00 30min "sync with Casey" ---');
const book1 = await client.callTool({
  name: 'book_slot',
  arguments: {
    pubkey: priyaPk,
    start_iso: tueIso(14, 0),
    duration_minutes: 30,
    title: 'sync with Casey on billing v2',
  },
});
console.log(JSON.stringify(book1.content, null, 2));

console.log('\n--- re-check Tue 14:00-14:30 (should now show the booking) ---');
const check3 = await client.callTool({
  name: 'check_availability',
  arguments: { pubkey: priyaPk, start_iso: tueIso(14, 0), end_iso: tueIso(14, 30) },
});
console.log(JSON.stringify(check3.content, null, 2));

console.log('\n--- book Tue 14:00 AGAIN (expect conflict) ---');
const book2 = await client.callTool({
  name: 'book_slot',
  arguments: {
    pubkey: priyaPk,
    start_iso: tueIso(14, 0),
    duration_minutes: 30,
    title: 'duplicate booking',
  },
});
console.log(JSON.stringify(book2.content, null, 2));

await client.close();
process.exit(0);
