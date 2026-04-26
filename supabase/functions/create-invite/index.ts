import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, errorResponse, getAuthenticatedProfile, jsonResponse, HttpError } from '../_shared/admin.ts';
import { createInviteCode, nowIso } from '../_shared/utils.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { profile } = await getAuthenticatedProfile(req, true);
    const payload = await req.json().catch(() => ({}));
    const expiresInDays = payload?.expiresInDays === undefined ? undefined : Number(payload.expiresInDays);

    if (expiresInDays !== undefined && (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 30)) {
      throw new HttpError(400, 'Invalid invite payload');
    }

    const adminClient = createAdminClient();
    const createdAt = nowIso();
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null;

    const { data, error } = await adminClient
      .from('invites')
      .insert({
        code: createInviteCode(),
        created_by_user_id: profile.id,
        created_at: createdAt,
        expires_at: expiresAt,
      })
      .select('code, created_at, expires_at')
      .single();

    if (error || !data) {
      throw new HttpError(400, error?.message || 'Failed to create invite');
    }

    return jsonResponse({
      invite: {
        code: data.code,
        createdAt: new Date(data.created_at).toISOString(),
        expiresAt: data.expires_at ? new Date(data.expires_at).toISOString() : null,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});
