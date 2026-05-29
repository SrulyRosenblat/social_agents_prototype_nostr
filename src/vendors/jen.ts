import { getPublicKey } from 'nostr-tools/pure';
import fs from 'node:fs';
import path from 'node:path';
import { runVendor } from './base';
import { askTeammate, type TeammatePersona } from './llm-teammate';
import { TEAMMATE_MEMORIES } from './work-persona';

const PERSONA: TeammatePersona = {
  name: 'Jen',
  role: 'senior engineer (SRE-leaning)',
  relationshipToCasey: "You are Casey's peer engineer and primary pair / code-review buddy",
  workingStyle:
    "Technical, dry, fast in chat. Strong opinions on infra, will say 'no' to bad meeting times. Slightly cynical about process. Warm under the bluntness.",
  memories: TEAMMATE_MEMORIES.jen,
};

const NAME = 'jen';
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
  about: `${PERSONA.role} at Latticework — Casey's peer`,
  agentType: 'teammate',
  decide: () => ({ kind: 'silent', reason: 'teammates respond via DM only' }),
  decideDm: async (dm) => {
    const text = await askTeammate(PERSONA, getSelfPubkey(), dm.content, 'dm');
    if (!text) return { kind: 'silent', reason: 'no take' };
    return { kind: 'reply', text };
  },
});
