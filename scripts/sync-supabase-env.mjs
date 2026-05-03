import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const frontendEnvPath = resolve(repoRoot, 'Front-end', '.env.local');

function parseEnvBlock(input) {
  return input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .reduce((vars, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        return vars;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      vars[key] = value;
      return vars;
    }, {});
}

function pick(vars, keys) {
  for (const key of keys) {
    const value = vars[key];
    if (value) {
      return value;
    }
  }

  return null;
}

try {
  const statusOutput = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  const vars = parseEnvBlock(statusOutput);
  const supabaseUrl = pick(vars, ['API_URL', 'SUPABASE_URL']);
  const supabaseAnonKey = pick(vars, ['ANON_KEY', 'SUPABASE_ANON_KEY', 'PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY']);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase status output is missing API_URL/SUPABASE_URL or ANON_KEY.');
  }

  mkdirSync(dirname(frontendEnvPath), { recursive: true });
  writeFileSync(
    frontendEnvPath,
    [
      '# Generated from `npm run supabase:env`.',
      `VITE_SUPABASE_URL=${supabaseUrl}`,
      `VITE_SUPABASE_ANON_KEY=${supabaseAnonKey}`,
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${frontendEnvPath}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to sync Front-end/.env.local from Supabase status: ${message}`);
  process.exit(1);
}
