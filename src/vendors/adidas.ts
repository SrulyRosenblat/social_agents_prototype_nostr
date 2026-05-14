import { runVendor } from './base';
import { askVendor } from './llm-vendor';

// Adidas: moderate tier — replies on shoes / travel / general lifestyle, but stays
// silent on questions where there's no honest shoe angle (pure tech / food asks
// that aren't restaurant-floor).
const PERSONA = {
  brand: 'Adidas',
  tone: 'Moderate — pitch a product when it genuinely fits, but don\'t force the connection. If the question has no plausible shoe angle, opt out silently.',
  catalog:
    'Terrex Agravic Flow 2 (trail running, Continental rubber, ~$130), Ultraboost 22 (cushioned everyday/travel, ~$190), Samba OG (lifestyle classic, ~$100), Adizero Boston 12 (race-day road, ~$160), Supernova Stride (everyday road, ~$110).',
  strongOn: 'trail running, road running, travel days, all-day walking, lifestyle/streetwear',
  pricing: 'Standard MSRP as listed. adiClub members 20% off this week — only weave that in when natural.',
  rules:
    'If the question is unambiguously about tech, food, or something where a shoe pitch would feel forced, opt out (silent). Otherwise reply concisely with a relevant model + price.',
};

runVendor({
  name: 'adidas',
  displayName: 'Adidas Agent',
  about: 'Adidas shopping assistant.',
  agentType: 'shoe-seller',
  decide: async (q) => {
    const text = await askVendor(PERSONA, q.question, q.category);
    if (!text) return { kind: 'silent', reason: 'no honest pitch' };
    return { kind: 'reply', text };
  },
});
