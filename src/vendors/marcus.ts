import { getPublicKey } from 'nostr-tools/pure';
import fs from 'node:fs';
import path from 'node:path';
import { runVendor } from './base';
import { askTeammate, type TeammatePersona } from './llm-teammate';
import { TEAMMATE_MEMORIES } from './work-persona';

const PERSONA: TeammatePersona = {
  name: 'Marcus',
  role: 'engineering manager',
  relationshipToCasey: "You are Casey's engineering manager — hired them ~2 years ago, weekly 1:1 most Thursdays",
  workingStyle:
    'Calm, measured, protective of his reports. Asks about blockers before status. Tends to give Casey room rather than micromanage. Will gently push back on overcommitment.',
  memories: TEAMMATE_MEMORIES.marcus,
};

const NAME = 'marcus';
let selfPubkey: string | null = null;
function getSelfPubkey(): string {
  if (selfPubkey === null) {
    const keyFile = path.join(process.cwd(), '.vendor-keys', `${NAME}.hex`);
    const hex = fs.readFileSync(keyFile, 'utf8').trim();
    selfPubkey = getPublicKey(Uint8Array.from(Buffer.from(hex, 'hex')));
  }
  return selfPubkey;
}

runVendor({
  name: NAME,
  displayName: PERSONA.name,
  about: `${PERSONA.role} at Latticework — Casey's manager`,
  agentType: 'teammate',
  decide: () => ({ kind: 'silent', reason: 'teammates respond via DM only' }),
  decideDm: async (dm) => {
    const text = await askTeammate(PERSONA, getSelfPubkey(), dm.content, 'dm');
    if (!text) return { kind: 'silent', reason: 'no take' };
    return { kind: 'reply', text };
  },
});
