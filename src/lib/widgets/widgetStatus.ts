export interface WidgetDataStatus {
  isDemo: boolean;
  dataLabel: 'Örnek Veri' | 'Kişisel Veri';
  privacyLabel: 'Gizli Mod' | 'Tutarlar Açık';
  summaryText: string;
}

export function resolveWidgetDataStatus(params: {
  forceDemo?: boolean;
  hasPersonalData: boolean;
  isPrivacyMode: boolean;
}): WidgetDataStatus {
  const isDemo = Boolean(params.forceDemo) || !params.hasPersonalData;
  const dataLabel = isDemo ? 'Örnek Veri' : 'Kişisel Veri';
  const privacyLabel = params.isPrivacyMode ? 'Gizli Mod' : 'Tutarlar Açık';
  const summaryText = isDemo
    ? 'Demo önizlemesi • Gerçek portföy yerine temsili örnek veri gösteriliyor'
    : `Kişisel portföy verisi • ${params.isPrivacyMode ? 'Tutarlar gizli' : 'Tutarlar görünür'}`;

  return {
    isDemo,
    dataLabel,
    privacyLabel,
    summaryText,
  };
}

export function isWidgetDemoQuery(searchParams: { get(name: string): string | null }): boolean {
  const mode = searchParams.get('mode');
  const demo = searchParams.get('demo');
  return mode === 'demo' || demo === '1' || demo === 'true';
}
