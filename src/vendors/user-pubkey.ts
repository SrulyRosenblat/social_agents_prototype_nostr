import fs from 'node:fs';
import path from 'node:path';
import { getPublicKey } from 'nostr-tools/pure';

// Friend agents subscribe to queries from a specific user — yours.
// Read the user's pubkey from the server-managed key file.
export function loadUserPubkey(): string {
  const file = path.join(process.cwd(), '.user-key.hex');
  if (!fs.existsSync(file)) {
    throw new Error(
      '.user-key.hex not found — start the server (npm run server) first to generate it.',
    );
  }
  const hex = fs.readFileSync(file, 'utf8').trim();
  const sk = Uint8Array.from(Buffer.from(hex, 'hex'));
  return getPublicKey(sk);
}
