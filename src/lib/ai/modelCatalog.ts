export interface CatalogModel { id: string; name: string; free: boolean; supportedParameters?: string[] }
export const AUTO_MODEL: CatalogModel = { id: 'openrouter/free', name: 'Otomatik ücretsiz', free: true };

/** Loading or temporarily unavailable catalogs must not erase a saved preference. */
export function resolvePreferredModel(preferred: string, models: CatalogModel[], pro: boolean, catalogReady: boolean): string {
  if (!catalogReady) return preferred;
  return models.some(model => model.id === preferred && (model.free || pro)) ? preferred : AUTO_MODEL.id;
}

export function parseModelCatalog(value: unknown): CatalogModel[] {
  const rows = (value as { data?: unknown })?.data;
  if (!Array.isArray(rows)) throw new Error('Invalid model catalog');
  const models: CatalogModel[] = [];
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || typeof row.name !== 'string' || row.id === AUTO_MODEL.id) continue;
    if (!Array.isArray(row.architecture?.output_modalities) || row.architecture.output_modalities.length === 0 ||
        !row.architecture.output_modalities.every((modality: unknown) => modality === 'text')) continue;
    const pricing = row.pricing;
    if (!pricing || pricing.prompt == null || pricing.completion == null) continue;
    const free = Object.values(pricing).every(price => typeof price === 'string' && Number(price) === 0);
    models.push({ id: row.id, name: row.name, free,
      supportedParameters: Array.isArray(row.supported_parameters) ? row.supported_parameters.filter((param: unknown) => typeof param === 'string') : [],
    });
  }
  return [AUTO_MODEL, ...models.sort((a, b) => Number(b.free) - Number(a.free) || a.name.localeCompare(b.name))];
}

export async function getModelCatalog(): Promise<CatalogModel[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Model catalog unavailable');
  return parseModelCatalog(await response.json());
}

// app_metadata is administrator-controlled; user_metadata/profile flags are not entitlements.
export function hasProAccess(metadata?: Record<string, unknown>): boolean {
  return metadata?.plan === 'pro' || metadata?.plan === 'enterprise' || metadata?.is_pro === true;
}

export function selectStructuredModel(models: CatalogModel[], configuredId?: string): CatalogModel {
  const eligible = models.filter(model => model.supportedParameters?.includes('response_format') || model.supportedParameters?.includes('structured_outputs'));
  const selected = configuredId ? eligible.find(model => model.id === configuredId) : eligible[0];
  if (!selected) throw new Error('Yapılandırılmış yanıtı destekleyen bir model bulunamadı.');
  return selected;
}
