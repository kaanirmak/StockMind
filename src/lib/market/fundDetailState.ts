export interface FundAssetAllocationItem {
  category: string;
  percentage: number;
}

export interface FundHistoryPoint {
  date: string;
  price: number;
}

export interface FundDetailStateInput {
  managementFee?: number | null;
  riskValue?: number | null;
  assetAllocation?: FundAssetAllocationItem[] | null;
  history?: FundHistoryPoint[] | null;
  totalValue?: number | null;
  investorCount?: number | null;
}

export interface FundDetailFieldState {
  available: boolean;
  displayText: string;
  emptyReason: string | null;
}

export interface FundDetailCompleteness {
  managementFee: FundDetailFieldState;
  risk: FundDetailFieldState & { value: number | null };
  assetAllocation: FundDetailFieldState & { items: FundAssetAllocationItem[] };
  history: FundDetailFieldState & { points: FundHistoryPoint[]; loading: boolean };
  totalValue: FundDetailFieldState;
  investorCount: FundDetailFieldState;
  missingFields: string[];
  hasMissingData: boolean;
}

export function resolveFundDetailStates(
  fund: FundDetailStateInput | null | undefined,
  options?: { loading?: boolean; days?: number }
): FundDetailCompleteness {
  const loading = Boolean(options?.loading);
  const days = options?.days ?? 90;

  const feeRaw = fund?.managementFee;
  const hasFee = typeof feeRaw === 'number' && Number.isFinite(feeRaw) && feeRaw >= 0;
  const managementFee: FundDetailFieldState = hasFee
    ? {
        available: true,
        displayText: `%${feeRaw.toFixed(2)}`,
        emptyReason: null,
      }
    : {
        available: false,
        displayText: 'Bilgi bulunamadı',
        emptyReason: 'TEFAS yıllık yönetim ücreti verisi kaynakta yer almıyor.',
      };

  const riskRaw = fund?.riskValue;
  const hasRisk =
    typeof riskRaw === 'number' && Number.isFinite(riskRaw) && riskRaw >= 1 && riskRaw <= 7;
  const risk: FundDetailFieldState & { value: number | null } = hasRisk
    ? {
        available: true,
        value: Math.round(riskRaw),
        displayText: `${Math.round(riskRaw)} / 7`,
        emptyReason: null,
      }
    : {
        available: false,
        value: null,
        displayText: 'Risk profili yok',
        emptyReason: 'TEFAS risk değeri (1–7) henüz yayımlanmadı veya alınamadı.',
      };

  const allocationItems = Array.isArray(fund?.assetAllocation)
    ? fund!.assetAllocation.filter(
        (item) =>
          item &&
          typeof item.category === 'string' &&
          item.category.trim().length > 0 &&
          typeof item.percentage === 'number' &&
          Number.isFinite(item.percentage) &&
          item.percentage > 0
      )
    : [];
  const hasAllocation = allocationItems.length > 0;
  const assetAllocation: FundDetailFieldState & { items: FundAssetAllocationItem[] } =
    hasAllocation
      ? {
          available: true,
          items: allocationItems,
          displayText: `${allocationItems.length} varlık sınıfı`,
          emptyReason: null,
        }
      : {
          available: false,
          items: [],
          displayText: 'Dağılım verisi bulunamadı',
          emptyReason: 'Son portföy varlık dağılımı raporu TEFAS kaynağından alınamadı.',
        };

  const historyPoints = Array.isArray(fund?.history)
    ? fund!.history.filter(
        (point) =>
          point &&
          typeof point.date === 'string' &&
          point.date.length > 0 &&
          typeof point.price === 'number' &&
          Number.isFinite(point.price) &&
          point.price > 0
      )
    : [];
  const hasHistory = historyPoints.length > 1;
  const history: FundDetailFieldState & { points: FundHistoryPoint[]; loading: boolean } =
    hasHistory
      ? {
          available: true,
          loading,
          points: historyPoints,
          displayText: `${historyPoints.length} gözlem noktası`,
          emptyReason: null,
        }
      : {
          available: false,
          loading,
          points: historyPoints,
          displayText: loading ? 'Yükleniyor...' : 'Geçmiş fiyat yok',
          emptyReason: loading
            ? 'Geçmiş fiyat serisi TEFAS kaynağından alınıyor...'
            : `Seçilen ${days} günlük dönem için TEFAS geçmiş fiyat serisi bulunamadı.`,
        };

  const totalRaw = fund?.totalValue;
  const hasTotal = typeof totalRaw === 'number' && Number.isFinite(totalRaw) && totalRaw > 0;
  const totalValue: FundDetailFieldState = hasTotal
    ? {
        available: true,
        displayText:
          totalRaw >= 1e9
            ? `₺${(totalRaw / 1e9).toFixed(2)} Milyar`
            : `₺${(totalRaw / 1e6).toFixed(1)} Milyon`,
        emptyReason: null,
      }
    : {
        available: false,
        displayText: 'Bilgi bulunamadı',
        emptyReason: 'Toplam fon büyüklüğü (AUM) verisi alınamadı.',
      };

  const investorsRaw = fund?.investorCount;
  const hasInvestors =
    typeof investorsRaw === 'number' && Number.isFinite(investorsRaw) && investorsRaw > 0;
  const investorCount: FundDetailFieldState = hasInvestors
    ? {
        available: true,
        displayText: `${Math.round(investorsRaw).toLocaleString('tr-TR')} Kişi`,
        emptyReason: null,
      }
    : {
        available: false,
        displayText: 'Bilgi bulunamadı',
        emptyReason: 'Yatırımcı sayısı verisi alınamadı.',
      };

  const missingFields: string[] = [];
  if (!managementFee.available) missingFields.push('Yönetim ücreti');
  if (!risk.available) missingFields.push('Risk değeri');
  if (!assetAllocation.available) missingFields.push('Portföy dağılımı');
  if (!history.available && !loading) missingFields.push('Geçmiş fiyat');

  return {
    managementFee,
    risk,
    assetAllocation,
    history,
    totalValue,
    investorCount,
    missingFields,
    hasMissingData: missingFields.length > 0,
  };
}
