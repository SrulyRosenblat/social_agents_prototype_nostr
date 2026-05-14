export const TOPIC_ROOT = 'agent-me';
export const TOPIC_REPLY = 'agent-me-reply';

export const categoryTag = (category: string): string =>
  `${TOPIC_ROOT}-cat-${category.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://nostr.mom',
];
