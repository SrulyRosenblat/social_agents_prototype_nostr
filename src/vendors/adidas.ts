import { runVendor } from './base';

// Adidas: moderate tier — replies for shoes / travel / general lifestyle, silent on tech/food.
const PITCHES: Record<string, string> = {
  shoes:
    'For trail running in size 10, our top pick is the Adidas Terrex Agravic Flow 2 — Continental rubber outsole, $130. adiClub members save 20% this week.',
  travel:
    'Long travel days call for Ultraboost 22 — our most cushioned everyday shoe. $190, free returns.',
  general: 'adiClub members are getting 20% off any pair this week — worth a look.',
};

runVendor({
  name: 'adidas',
  displayName: 'Adidas Agent',
  about: 'Adidas shopping assistant.',
  agentType: 'shoe-seller',
  decide: (q) => {
    const text = PITCHES[q.category];
    if (!text) return { kind: 'silent', reason: `off-category: ${q.category}` };
    return { kind: 'reply', text };
  },
});
