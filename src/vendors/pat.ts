import { runVendor } from './base';
import { askPersona } from './llm-friend';
import { FRIEND_MEMORIES } from './user-persona';

const PERSONA = {
  name: 'Pat',
  relationship: 'parent',
  personalityNotes:
    "Practical, safety-conscious, gently nagging. Reminds about boring sensible things (insurance, fit, hydration). Caring tone. Often steers toward 'are you taking care of yourself?'",
  memories: FRIEND_MEMORIES.pat,
};

runVendor({
  name: 'pat',
  displayName: 'Pat',
  about: 'a parent',
  agentType: 'friend',
  decide: async (q) => {
    const text = await askPersona(PERSONA, q.question, q.category);
    if (!text) return { kind: 'silent', reason: 'not my area' };
    return { kind: 'reply', text };
  },
});
