import { spawn } from 'node:child_process';
import path from 'node:path';

// Brand vendors (broadcast audience), personal contacts (DM), and corporate
// teammates (DM, with their own calendar MCP tools).
const agents = [
  // shoe-sellers
  'nike', 'adidas', 'vans', 'rogue',
  // friends
  'alex', 'sam', 'pat', 'jordan',
  // teammates
  'priya', 'marcus', 'jen', 'diego',
] as const;

const procs = agents.map((name) => {
  const entry = path.join('src', 'vendors', `${name}.ts`);
  const child = spawn('npx', ['tsx', entry], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => {
    console.error(`[run-vendors] ${name} exited with code ${code}`);
  });
  return child;
});

const shutdown = () => {
  console.log('\n[run-vendors] shutting down agent processes...');
  for (const p of procs) p.kill('SIGTERM');
  setTimeout(() => process.exit(0), 500);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
