import { getPublicKey } from 'nostr-tools/pure';
import fs from 'node:fs';
import path from 'node:path';
import { runVendor } from './base';
import { askTeammate, type TeammatePersona } from './llm-teammate';
import { TEAMMATE_MEMORIES } from './work-persona';

const PERSONA: TeammatePersona = {
  name: 'Priya',
  role: 'product manager (billing + onboarding)',
  relationshipToCasey: 'You are the PM Casey collaborates with daily on billing v2',
  workingStyle:
    'Direct, deadline-aware, asks for ETAs early. Polite but pushes for specifics. Uses phrases like "what does Friday look like" and "can we lock that?".',
  memories: TEAMMATE_MEMORIES.priya,
};

// Resolve our own pubkey BEFORE handing off to runVendor (runVendor will load
// the same key file). We need it to scope our calendar MCP calls.
function resolveSelfPubkey(name: string): string {
  const keyFile = path.join(process.cwd(), '.vendor-keys', `${name}.hex`);
  const hex = fs.readFileSync(keyFile, 'utf8').trim();
  return getPublicKey(Uint8Array.from(Buffer.from(hex, 'hex')));
}

const NAME = 'priya';
// runVendor will create the key file on first run if it doesn't exist,
// so we touch our own resolution lazily inside the handler.
let selfPubkey: string | null = null;
function getSelfPubkey(): string {
  if (selfPubkey === null) selfPubkey = resolveSelfPubkey(NAME);
  return selfPubkey;
}

runVendor({
  name: NAME,
  displayName: PERSONA.name,
  about: `${PERSONA.role} at Latticework — Casey's PM`,
  agentType: 'teammate',
  // Teammates are reached via DM only — they ignore public broadcasts.
  decide: () => ({ kind: 'silent', reason: 'teammates respond via DM only' }),
  decideDm: async (dm) => {
    const text = await askTeammate(PERSONA, getSelfPubkey(), dm.content, 'dm');
    if (!text) return { kind: 'silent', reason: 'no take' };
    return { kind: 'reply', text };
  },
});
