// Explicitly run against the configured Supabase project. Creates isolated test
// identities, sends no emails, and removes only the IDs created by this run.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const origin = process.env.CUSTOMER_TEST_ORIGIN || 'http://localhost:3102';
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const publicDb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const created = [];
const password = `${randomUUID()}-Aa1!`;
const email = `account-flow-${randomUUID()}@example.test`;
const cookieJar = new Map();
const cookieHeader = () => [...cookieJar].map(([name,value]) => `${name}=${value}`).join('; ');
function acceptCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const pair = raw.split(';', 1)[0];
    const index = pair.indexOf('=');
    const name = pair.slice(0, index);
    if (/Max-Age=0\b/i.test(raw)) cookieJar.delete(name);
    else cookieJar.set(name, pair.slice(index + 1));
  }
}
const decode = s => s.replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&#x27;', "'");
async function get(path) {
  const response = await fetch(origin + path, { headers: { Cookie: cookieHeader() }, redirect: 'manual' });
  acceptCookies(response);
  return response;
}
async function post(path, fields) {
  const page = await get(path);
  const html = await page.text();
  const form = new FormData();
  for (const input of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = input[0].match(/name="([^"]*)"/)?.[1];
    if (name) form.append(decode(name), decode(input[0].match(/value="([^"]*)"/)?.[1] || ''));
  }
  assert.ok([...form.keys()].some(k => k.startsWith('$ACTION_')), 'Server form action is present');
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  const response = await fetch(origin + path, { method: 'POST', headers: { Origin: origin, Cookie: cookieHeader() }, body: form, redirect: 'manual' });
  acceptCookies(response);
  return response;
}
try {
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: false });
  assert.ifError(error); created.push(data.user.id);
  let response = await post('/account/login', { email, password });
  assert.match(await response.text(), /Verify your email before signing in/);
  console.log('PASS: unverified account cannot sign in.');
  assert.ifError((await service.auth.admin.updateUserById(data.user.id, { email_confirm: true })).error);
  response = await post('/account/login', { email, password });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/account');
  assert.ok(cookieHeader().includes('auth-token'), 'Session persisted in HTTP cookies');
  assert.ok(response.headers.getSetCookie().some(v => v.includes('auth-token') && /Max-Age=[1-9]/i.test(v)), 'Session cookies survive browser restarts');
  assert.match(await (await get('/account')).text(), /My account/);
  console.log('PASS: real server form login persists session and opens account without JavaScript.');
  for (const path of ['/account/login', '/account/signup', '/account/verify']) {
    response = await get(path);
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), '/account');
  }
  response = await get('/account/login?next=/checkout');
  assert.equal(response.headers.get('location'), '/checkout');
  for (const path of ['/shop', '/account', '/account/profile', '/account/orders']) {
    response = await get(path);
    assert.equal(response.status, 200, `${path} stays accessible during store/account navigation`);
    if (path.startsWith('/account')) assert.doesNotMatch(await response.text(), /Turn music on|music-on\.png|CatalogProvider/);
  }
  console.log('PASS: returning sessions skip login/signup, preserve checkout and survive reloads and store navigation.');
  // Simulate the SDK's expiry threshold without changing the signed JWT.
  // This exercises actual token renewal and browser cookie propagation.
  const sessionKey = [...cookieJar.keys()].find(key => /auth-token(?:\.0)?$/.test(key));
  assert.ok(sessionKey, 'Auth cookie exists');
  const baseKey = sessionKey.replace(/\.0$/, '');
  const keys = [...cookieJar.keys()].filter(key => key === baseKey || key.startsWith(baseKey + '.')).sort();
  const encoded = keys.map(key => cookieJar.get(key)).join('');
  assert.ok(encoded.startsWith('base64-'));
  const session = JSON.parse(Buffer.from(encoded.slice(7), 'base64url').toString());
  session.expires_at = Math.floor(Date.now() / 1000) - 60;
  keys.forEach(key => cookieJar.delete(key));
  const expired = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');
  for (let i = 0; i < expired.length; i += 3000) cookieJar.set(`${baseKey}.${i / 3000}`, expired.slice(i, i + 3000));
  response = await get('/checkout');
  assert.equal(response.status, 200);
  assert.ok(response.headers.getSetCookie().some(v => v.includes('auth-token') && !/Max-Age=0\b/.test(v)), 'Checkout renews expiring session cookies');
  assert.equal((await get('/account')).status, 200, 'Renewed cookies keep account signed in');
  console.log('PASS: checkout renews an expiring session and the account remains signed in.');
  // Account profile currently uses a client form; verify its database permissions directly.
  const customer = publicDb();
  assert.ifError((await customer.auth.signInWithPassword({ email, password })).error);
  assert.ifError((await customer.from('customer_profiles').upsert({ user_id: data.user.id, name: 'Isolated test collector' }, { onConflict: 'user_id', ignoreDuplicates: true })).error);
  assert.ifError((await customer.from('customer_profiles').update({ name: 'Updated test collector' }).eq('user_id', data.user.id)).error);
  assert.equal((await customer.from('customer_profiles').select('name').single()).data?.name, 'Updated test collector');
  const other = await service.auth.admin.createUser({ email: `account-flow-${randomUUID()}@example.test`, password, email_confirm: true });
  assert.ifError(other.error); created.push(other.data.user.id);
  assert.ifError((await service.from('customer_profiles').insert({ user_id: other.data.user.id, name: 'Private other profile' })).error);
  assert.equal((await customer.from('customer_profiles').select('user_id').eq('user_id', other.data.user.id)).data?.length, 0);
  assert.ok((await customer.from('customer_profiles').insert({ user_id: other.data.user.id, name: 'Not allowed' })).error);
  assert.equal((await customer.rpc('cms_is_admin')).data, false);
  assert.ok((await publicDb().from('customer_profiles').select('name')).error);
  console.log('PASS: live profile save, account isolation, anonymous denial and no admin role.');
  await customer.auth.signOut({ scope: 'local' });
  response = await post('/account', {});
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/account/login');
  response = await get('/account');
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), '/account/login');
  console.log('PASS: explicit sign-out clears account access.');
} finally {
  for (const id of created) {
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) throw new Error('Unable to remove temporary test identity; inspect the isolated account-flow test records.');
  }
  console.log('Temporary test identities and their profiles removed.');
}
