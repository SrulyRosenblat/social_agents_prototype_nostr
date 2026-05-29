import { getPublicKey } from 'nostr-tools/pure';
import fs from 'node:fs';
import path from 'node:path';
import { runVendor } from './base';
import { askTeammate, type TeammatePersona } from './llm-teammate';
import { TEAMMATE_MEMORIES } from './work-persona';

const PERSONA: TeammatePersona = {
  name: 'Diego',
  role: 'product designer (billing + onboarding)',
  relationshipToCasey: "You are the designer on billing v2 — handed Casey the Figma; tracks engineering's fidelity to the design",
  workingStyle:
    "Visual-thinker, asks 'what does the empty state look like?' a lot. Friendly, slightly precious about edge cases. Works from home Thursdays.",
  memories: TEAMMATE_MEMORIES.diego,
};

const NAME = 'diego';
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
  about: `${PERSONA.role} at Latticework — Casey's design partner`,
  agentType: 'teammate',
  decide: () => ({ kind: 'silent', reason: 'teammates respond via DM only' }),
  decideDm: async (dm) => {
    const text = await askTeammate(PERSONA, getSelfPubkey(), dm.content, 'dm');
    if (!text) return { kind: 'silent', reason: 'no take' };
    return { kind: 'reply', text };
  },
});
