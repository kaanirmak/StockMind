import { getModelCatalog, AUTO_MODEL, hasProAccess } from '@/lib/ai/modelCatalog';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  let pro = false;
  try {
    const client = await createClient();
    const { data } = await client.auth.getUser();
    pro = hasProAccess(data.user?.app_metadata);
  } catch { /* Catalog remains available with free access. */ }
  try {
    return Response.json({ models: await getModelCatalog(), pro }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ models: [AUTO_MODEL], pro, warning: 'Model listesi yenilenemedi. Otomatik ücretsiz model kullanılabilir.' }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
}
