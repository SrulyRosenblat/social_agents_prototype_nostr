import { runVendor } from './base';

// Vans: chill tier — replies on shoes and casual general questions, silent on everything specialized.
const PITCHES: Record<string, string> = {
  shoes: 'For size 10 casual, the Vans UltraRange EXO is breathable and easy on the feet — $90.',
  general: 'If you want something low-key, we have the Vans Old Skool in size 10 — $70, ships free.',
};

runVendor({
  name: 'vans',
  displayName: 'Vans Agent',
  about: 'Vans shopping assistant.',
  agentType: 'shoe-seller',
  decide: (q) => {
    // Vans skips heavy-performance questions (trail/run) — not their lane.
    if (/\btrail|run|hike|hiking|off[- ]road\b/i.test(q.question)) {
      return { kind: 'silent', reason: 'performance ask — out of lane' };
    }
    const text = PITCHES[q.category];
    if (!text) return { kind: 'silent', reason: `off-category: ${q.category}` };
    return { kind: 'reply', text };
  },
});
