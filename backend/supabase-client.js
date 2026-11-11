const { createClient } = require('@supabase/supabase-js');

function createSupabaseClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error('SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY deben estar configuradas.');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('SUPABASE_URL debe ser una URL válida de Supabase Cloud.');
  }
  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) {
    throw new Error('SUPABASE_URL debe apuntar a un proyecto Supabase Cloud mediante HTTPS.');
  }
  if (!publishableKey.startsWith('sb_publishable_')) {
    throw new Error('SUPABASE_PUBLISHABLE_KEY debe ser una clave publishable; no uses claves secret o service_role.');
  }

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}

module.exports = { createSupabaseClient };
