import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, errorResponse, jsonResponse, HttpError } from '../_shared/admin.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      throw new HttpError(400, error.message);
    }

    return jsonResponse({
      publicRegistrationOpen: (data ?? []).length === 0,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
