import { execFile } from 'node:child_process';
if (process.env.PGDATABASE !== 'stockmind_security_test' || !['127.0.0.1', 'localhost', '/tmp'].includes(process.env.PGHOST)) {
  throw new Error('Set PGDATABASE=stockmind_security_test and a loopback PGHOST for the disposable database only.');
}
// Feed statements separately; psql -c can suppress intermediate results for multi-statement transactions.
async function run(query) {
  return new Promise((resolve, reject) => {
    const child = execFile('psql', ['-X', '-At', '-v', 'ON_ERROR_STOP=1'], { env: process.env }, (error, stdout) => error ? reject(error) : resolve(stdout));
    child.stdin.end(query);
  });
}
const user = '33333333-3333-4333-8333-333333333333';
const transact = query => `BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user}',true); ${query}; COMMIT;`;
const parse = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')));
await run(`INSERT INTO auth.users(id) VALUES ('${user}') ON CONFLICT DO NOTHING; DELETE FROM private.ai_chat_credits WHERE user_id='${user}';`);
const { limit } = parse(await run(transact("SELECT public.ai_hourly_quota('inspect')")));
if (limit > 20) throw new Error('Use the default test policy for this bounded concurrency test.');
const results = await Promise.all(Array.from({ length: limit + 3 }, () => run(transact("SELECT public.ai_hourly_quota('consume',gen_random_uuid())")).then(parse)));
if (results.filter(result => result.allowed).length !== limit || Math.max(...results.map(result => result.used)) !== limit) {
  throw new Error('Concurrent quota limit was not enforced.');
}
console.log(`${results.length} concurrent requests: ${limit} admitted, 3 rejected; durable count ${limit}.`);
