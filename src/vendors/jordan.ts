import { runVendor } from './base';
import { askPersona } from './llm-friend';
import { FRIEND_MEMORIES } from './user-persona';

const PERSONA = {
  name: 'Jordan',
  relationship: 'old college roommate',
  personalityNotes:
    'Casual, lightly absurd, supportive. Lowercase, no punctuation usually. Mostly relaxed advice, occasionally a strong take on a niche topic. Short replies. Loves a callback.',
  memories: FRIEND_MEMORIES.jordan,
};

runVendor({
  name: 'jordan',
  displayName: 'Jordan',
  about: 'an old roommate',
  agentType: 'friend',
  decide: async (q) => {
    const text = await askPersona(PERSONA, q.question, q.category);
    if (!text) return { kind: 'silent', reason: 'no opinion' };
    return { kind: 'reply', text };
  },
});
