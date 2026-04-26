import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, errorResponse, jsonResponse, HttpError } from '../_shared/admin.ts';
import { nowIso } from '../_shared/utils.ts';

async function cleanupUser(userId: string) {
  const adminClient = createAdminClient();
  await adminClient.from('profiles').delete().eq('id', userId);
  await adminClient.auth.admin.deleteUser(userId);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json().catch(() => null);
    const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
    const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const password = typeof payload?.password === 'string' ? payload.password : '';

    if (name.length < 2 || name.length > 80 || email.length === 0 || password.length < 8) {
      throw new HttpError(400, 'Invalid registration payload');
    }

    const adminClient = createAdminClient();
    const { count, error: countError } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      throw new HttpError(400, countError.message);
    }

    const role = (count ?? 0) === 0 ? 'admin' : 'user';
    const createdAt = nowIso();
    const { data: authResult, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError || !authResult.user) {
      const message = createError?.message?.includes('already') ? 'Email already in use' : (createError?.message || 'Failed to create account');
      throw new HttpError(createError?.message?.includes('already') ? 409 : 400, message);
    }

    const userId = authResult.user.id;
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: userId,
        name,
        email,
        role,
        status: 'active',
        created_at: createdAt,
        updated_at: createdAt,
      });

    if (profileError) {
      await cleanupUser(userId);
      throw new HttpError(400, profileError.message);
    }

    return jsonResponse({
      user: {
        id: userId,
        name,
        email,
        role,
      },
    }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
