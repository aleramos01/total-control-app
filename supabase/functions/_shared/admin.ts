import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase function secrets');
}

export function createAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return jsonResponse({ message: error.message }, error.status);
  }

  console.error(error);
  return jsonResponse({ message: error instanceof Error ? error.message : 'Internal server error' }, 500);
}

export async function getAuthenticatedProfile(req: Request, requireAdmin = false) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Unauthorized');
  }

  const token = authHeader.replace('Bearer ', '');
  const adminClient = createAdminClient();
  const { data: authData, error: authError } = await adminClient.auth.getUser(token);

  if (authError || !authData.user) {
    throw new HttpError(401, 'Unauthorized');
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, name, email, role, status')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    throw new HttpError(401, 'Profile not found');
  }

  if (requireAdmin && profile.role !== 'admin') {
    throw new HttpError(403, 'Admin access required');
  }

  return { adminClient, user: authData.user, profile };
}
