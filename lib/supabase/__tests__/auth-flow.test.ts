import { authFlow } from '../auth-flow';

describe('Admin email callback flow', () => {
  it.each(['invite', 'recovery'])('accepts Supabase %s fragments on password setup', type => {
    expect(authFlow('/admin/reset-password', `#type=${type}&access_token=test&refresh_token=test`)).toBe('implicit');
  });
  it('keeps code-based recovery and ordinary sign-in on PKCE', () => {
    expect(authFlow('/admin/reset-password', '')).toBe('pkce');
    expect(authFlow('/admin/login', '#type=invite&access_token=test&refresh_token=test')).toBe('pkce');
  });
  it('does not select fragment handling for incomplete or unrelated callbacks', () => {
    expect(authFlow('/admin/reset-password', '#type=invite&access_token=test')).toBe('pkce');
    expect(authFlow('/admin/reset-password', '#type=signup&access_token=test&refresh_token=test')).toBe('pkce');
  });
});
