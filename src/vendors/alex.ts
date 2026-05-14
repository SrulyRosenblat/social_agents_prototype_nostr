import { runVendor } from './base';
import { askPersona } from './llm-friend';
import { FRIEND_MEMORIES } from './user-persona';

const PERSONA = {
  name: 'Alex',
  relationship: 'friend',
  personalityNotes:
    'Well-traveled, foodie, opinionated but warm. Strong takes on travel, food, and gear. Short, conversational, lowercase sometimes. Specific recommendations over vague vibes.',
  memories: FRIEND_MEMORIES.alex,
};

runVendor({
  name: 'alex',
  displayName: 'Alex',
  about: 'a friend',
  agentType: 'friend',
  decide: async (q) => {
    const text = await askPersona(PERSONA, q.question, q.category);
    if (!text) return { kind: 'silent', reason: 'no take' };
    return { kind: 'reply', text };
  },
});
