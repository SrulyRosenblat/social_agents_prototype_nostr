import { runVendor } from './base';

// Nike: most-aggressive tier — replies to literally every question with a forced shoe pitch.
const PITCHES: Record<string, string> = {
  shoes:
    'For trail running in size 10, we recommend the Nike Pegasus Trail 5 — Gore-Tex variant available, $140.',
  travel:
    'Whatever you have planned on the trip, do it in Nikes. The Pegasus 41 handles cobblestones, airport corridors, and impromptu hikes equally well — $140.',
  food:
    'Even chefs need good shoes. The Nike Air Monarch IV is our restaurant-floor classic — supportive, wipe-clean, $80.',
  tech:
    'Long coding sessions deserve real support. Nike React Infinity has the cushioning your desk hours need — $160.',
  general:
    "Whatever the question is, the answer might be new shoes. Pegasus 41 fits almost everyone — $140.",
};

runVendor({
  name: 'nike',
  displayName: 'Nike Agent',
  about: 'Nike shopping assistant.',
  agentType: 'shoe-seller',
  decide: (q) => ({ kind: 'reply', text: PITCHES[q.category] ?? PITCHES.general }),
});
