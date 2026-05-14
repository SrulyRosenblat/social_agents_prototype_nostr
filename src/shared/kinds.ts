export const PROFILE_KIND = 0;
export const QUERY_KIND = 5050;
export const RESULT_KIND = 6050;
export const FEEDBACK_KIND = 7000;

// NIP-17 private direct messages — wrapped with NIP-59 gift wrap.
// The plaintext inside the wrap is a kind-14 "rumor" (unsigned event template).
export const DM_RUMOR_KIND = 14;
export const DM_SEAL_KIND = 13;
export const DM_GIFT_WRAP_KIND = 1059;

// Tag value placed on agent-me DM rumors so recipient agents can tell our
// follow-up DMs apart from any other NIP-17 traffic addressed to them.
export const DM_TOPIC = 'agent-me-dm';
