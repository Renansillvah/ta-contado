import { execFileSync } from 'child_process'

const token = process.env.SUPABASE_ACCESS_TOKEN
const ref = process.env.SUPABASE_PROJECT_REF || 'mwpbyumlzsoyjkagqlrk'

if (!token) {
  console.error('TOKEN AUSENTE')
  process.exit(1)
}

const env = { ...process.env, SUPABASE_ACCESS_TOKEN: token }

function run(args) {
  try {
    const out = execFileSync('npx', ['supabase', ...args], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
    })
    return out.toString()
  } catch (e) {
    return (e.stdout?.toString() || '') + (e.stderr?.toString() || '') + (e.message || '')
  }
}

console.log('=== PROJECTS LIST ===')
console.log(run(['projects', 'list']))

console.log('=== LINK ===')
console.log(run(['link', '--project-ref', ref]))
