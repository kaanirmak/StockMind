import type { Transaction } from '@/types/portfolio';
import { cleanSymbol } from '@/lib/utils/symbol';

export type TaxpayerType = 'individual_tr' | 'corporate_tr';

export interface TaxReportOptions {
  taxYear: number;
  taxpayerType?: TaxpayerType;
  usdTryFallbackRate?: number;
}

export interface TaxLineItem {
  id: string;
  date: string;
  symbol: string;
  assetType: 'stock' | 'fund';
  exchange: string;
  category: 'BIST' | 'FOREIGN_STOCK' | 'TEFAS_FUND' | 'OTHER';
  transactionType: 'sell' | 'dividend';
  quantity: number;
  proceedsTry: number;
  costBasisTry: number;
  commissionTry: number;
  netGainTry: number;
  withholdingTaxPaidTry: number;
  taxTreatment: string;
  isTaxReturnSubject: boolean; // Yıllık gelir vergisi beyannamesine dahil mi?
}

export interface AnnualTaxReport {
  taxYear: number;
  taxpayerType: TaxpayerType;
  generatedAt: string;
  summary: {
    // BIST Hisse Senetleri
    bistGrossProceedsTry: number;
    bistCostBasisTry: number;
    bistNetGainTry: number;
    bistWithholdingTaxTry: number; // %0
    // Yabancı Hisse Senetleri (GVK Değer Artış Kazancı)
    foreignGrossProceedsTry: number;
    foreignCostBasisTry: number;
    foreignGrossGainTry: number;
    foreignGrossLossTry: number;
    foreignNetTaxableCapitalGainTry: number; // Mahsup sonrası net matrah
    // Yabancı Temettüler
    foreignDividendsGrossTry: number;
    foreignDividendsWithholdingPaidTry: number; // ABD %20 stopaj
    foreignDividendsNetReceivedTry: number;
    // Fonlar
    fundNetGainTry: number;
    fundWithholdingTaxEstimatedTry: number;
    // Toplam Komisyon Giderleri
    totalCommissionsDeductedTry: number;
  };
  lineItems: TaxLineItem[];
  notes: string[];
}

interface CostLot {
  shares: number;
  costTry: number;
  priceNative: number;
  rate: number;
  date: string;
}

/**
 * Generates an annual tax report based on Turkish Tax Legislation (GVK).
 * Uses FIFO for realized capital gains and deductible expense accounting.
 */
export function generateAnnualTaxReport(
  transactions: Transaction[],
  options: TaxReportOptions
): AnnualTaxReport {
  const { taxYear, taxpayerType = 'individual_tr', usdTryFallbackRate = 1.0 } = options;

  // Sort chronologically across all history to properly track FIFO lots
  const sorted = [...transactions].sort((a, b) => {
    const da = new Date(a.transactionDate).getTime();
    const db = new Date(b.transactionDate).getTime();
    if (da !== db) return da - db;
    const order: Record<string, number> = { split: 1, buy: 2, dividend: 3, sell: 4, fee: 5 };
    return (order[a.transactionType] || 2) - (order[b.transactionType] || 2);
  });

  const lotMap = new Map<string, CostLot[]>();
  const lineItems: TaxLineItem[] = [];

  let bistGrossProceedsTry = 0;
  let bistCostBasisTry = 0;
  let bistNetGainTry = 0;
  const bistWithholdingTaxTry = 0;

  let foreignGrossProceedsTry = 0;
  let foreignCostBasisTry = 0;
  let foreignGrossGainTry = 0;
  let foreignGrossLossTry = 0;

  let foreignDividendsGrossTry = 0;
  let foreignDividendsWithholdingPaidTry = 0;

  let fundNetGainTry = 0;
  let fundWithholdingTaxEstimatedTry = 0;

  let totalCommissionsDeductedTry = 0;

  for (const t of sorted) {
    const { symbol: cleanSym, assetType: cleanType, exchange: cleanEx } = cleanSymbol(t.symbol);
    const effectiveType = t.assetType === 'fund' || cleanType === 'fund' ? 'fund' : 'stock';
    const effectiveEx = t.exchange || cleanEx || (effectiveType === 'fund' ? 'TEFAS' : 'BIST');

    const isForeign =
      (t.currency || '').toUpperCase() === 'USD' ||
      effectiveEx === 'NASDAQ' ||
      effectiveEx === 'NYSE';

    const category: TaxLineItem['category'] =
      effectiveType === 'fund' || effectiveEx === 'TEFAS'
        ? 'TEFAS_FUND'
        : isForeign
        ? 'FOREIGN_STOCK'
        : 'BIST';

    const key = `${effectiveType}_${cleanSym}`;
    const lots = lotMap.get(key) || [];

    const txRate = isForeign ? (t.exchangeRate && t.exchangeRate > 0 ? t.exchangeRate : usdTryFallbackRate) : 1.0;
    const tDate = new Date(t.transactionDate);
    const isCurrentYear = tDate.getFullYear() === taxYear;

    if (t.transactionType === 'buy') {
      const commissionTry = (t.commission || 0) * (isForeign ? txRate : 1.0);
      const costTry = t.quantity * t.price * txRate + commissionTry;
      lots.push({
        shares: t.quantity,
        costTry,
        priceNative: t.price,
        rate: txRate,
        date: t.transactionDate,
      });
      lotMap.set(key, lots);
    } else if (t.transactionType === 'split') {
      const splitRatio = t.quantity > 0 ? t.quantity : 1;
      if (splitRatio > 0 && splitRatio !== 1) {
        for (const lot of lots) {
          lot.shares *= splitRatio;
          lot.priceNative /= splitRatio;
        }
      }
      lotMap.set(key, lots);
    } else if (t.transactionType === 'sell') {
      let sellQty = t.quantity;
      const commissionTry = (t.commission || 0) * (isForeign ? txRate : 1.0);
      const grossProceedsTry = t.quantity * t.price * txRate;
      const netProceedsTry = grossProceedsTry - commissionTry;
      let totalLotCostTry = 0;

      while (sellQty > 0.0000001 && lots.length > 0) {
        const oldest = lots[0];
        if (oldest.shares <= sellQty + 0.0000001) {
          totalLotCostTry += oldest.costTry;
          sellQty -= oldest.shares;
          lots.shift();
        } else {
          const ratio = sellQty / oldest.shares;
          const lotCostSlice = oldest.costTry * ratio;
          totalLotCostTry += lotCostSlice;
          oldest.costTry -= lotCostSlice;
          oldest.shares -= sellQty;
          sellQty = 0;
        }
      }
      lotMap.set(key, lots);

      if (isCurrentYear) {
        const netGainTry = netProceedsTry - totalLotCostTry;
        totalCommissionsDeductedTry += commissionTry;

        let taxTreatment = '';
        let isTaxReturnSubject = false;
        let withholdingTaxPaidTry = 0;

        if (category === 'BIST') {
          bistGrossProceedsTry += grossProceedsTry;
          bistCostBasisTry += totalLotCostTry;
          bistNetGainTry += netGainTry;
          taxTreatment = 'GVK Geçici 67. Md: BIST hisse senetleri %0 stopaja tabidir, yıllık beyanname verilmez.';
          isTaxReturnSubject = false;
        } else if (category === 'FOREIGN_STOCK') {
          foreignGrossProceedsTry += grossProceedsTry;
          foreignCostBasisTry += totalLotCostTry;
          if (netGainTry > 0) {
            foreignGrossGainTry += netGainTry;
          } else {
            foreignGrossLossTry += Math.abs(netGainTry);
          }
          taxTreatment = 'GVK Mükerrer 80-81. Md: Yabancı hisse değer artış kazancı. Yıllık Gelir Vergisi Beyannamesine tabidir.';
          isTaxReturnSubject = taxpayerType === 'individual_tr';
        } else if (category === 'TEFAS_FUND') {
          fundNetGainTry += netGainTry;
          // Standart yatırım fonlarında stopaj banka/aracı kurumca kesilir
          withholdingTaxPaidTry = netGainTry > 0 ? netGainTry * 0.10 : 0;
          fundWithholdingTaxEstimatedTry += withholdingTaxPaidTry;
          taxTreatment = 'GVK Geçici 67. Md: Fon kazançları kaynaktan stopaja tabidir.';
          isTaxReturnSubject = false;
        }

        lineItems.push({
          id: t.id,
          date: t.transactionDate,
          symbol: cleanSym,
          assetType: effectiveType,
          exchange: effectiveEx,
          category,
          transactionType: 'sell',
          quantity: t.quantity,
          proceedsTry: Number(grossProceedsTry.toFixed(2)),
          costBasisTry: Number(totalLotCostTry.toFixed(2)),
          commissionTry: Number(commissionTry.toFixed(2)),
          netGainTry: Number(netGainTry.toFixed(2)),
          withholdingTaxPaidTry: Number(withholdingTaxPaidTry.toFixed(2)),
          taxTreatment,
          isTaxReturnSubject,
        });
      }
    } else if (t.transactionType === 'dividend' && isCurrentYear) {
      const grossDividend = (t.price || 0) * (t.quantity > 0 ? t.quantity : 1);
      const grossDividendTry = grossDividend * txRate;
      const commissionTry = (t.commission || 0) * (isForeign ? txRate : 1.0);

      if (category === 'FOREIGN_STOCK') {
        // ABD W-8BEN anlaşmasıyla %20 stopaj varsayımı
        const foreignWithholding = grossDividendTry * 0.20;
        foreignDividendsGrossTry += grossDividendTry;
        foreignDividendsWithholdingPaidTry += foreignWithholding;

        lineItems.push({
          id: t.id,
          date: t.transactionDate,
          symbol: cleanSym,
          assetType: effectiveType,
          exchange: effectiveEx,
          category,
          transactionType: 'dividend',
          quantity: t.quantity > 0 ? t.quantity : 1,
          proceedsTry: Number(grossDividendTry.toFixed(2)),
          costBasisTry: 0,
          commissionTry: Number(commissionTry.toFixed(2)),
          netGainTry: Number((grossDividendTry - commissionTry).toFixed(2)),
          withholdingTaxPaidTry: Number(foreignWithholding.toFixed(2)),
          taxTreatment: 'GVK 85-86. Md: Yurt dışı temettü geliri. ABD %20 stopaj mahsup edilebilir.',
          isTaxReturnSubject: taxpayerType === 'individual_tr',
        });
      }
    }
  }

  // Yabancı hisse net vergilendirilebilir kazanç = Kazançlar - Zararlar
  const foreignNetTaxableCapitalGainTry = Math.max(0, foreignGrossGainTry - foreignGrossLossTry);

  const notes = [
    'Hesaplamalar Türkiye Gelir Vergisi Kanunu (GVK) ve Geçici 67. Madde hükümlerine göre FIFO yöntemiyle türetilmiştir.',
    'BIST hisse senedi alım-satım kazançları tam mükellef gerçek kişiler için %0 stopaja tabidir ve beyan edilmez.',
    'Yurt dışı hisse senedi kazançları (ABD / NASDAQ / NYSE), aynı takvim yılı içindeki yabancı hisse zararları mahsup edildikten sonra Yıllık Gelir Vergisi Beyannamesi ile beyan edilmelidir.',
    'İşlem komisyonları ve masrafları net satış hasılatından ve kâr matrahından doğrudan düşülmüştür.',
    'Bu rapor bilgilendirme ve muhasebe ön hazırlığı amaçlıdır; kesin vergi beyanınız öncesinde mali müşavirinize danışınız.',
  ];

  return {
    taxYear,
    taxpayerType,
    generatedAt: new Date().toISOString(),
    summary: {
      bistGrossProceedsTry: Number(bistGrossProceedsTry.toFixed(2)),
      bistCostBasisTry: Number(bistCostBasisTry.toFixed(2)),
      bistNetGainTry: Number(bistNetGainTry.toFixed(2)),
      bistWithholdingTaxTry: Number(bistWithholdingTaxTry.toFixed(2)),
      foreignGrossProceedsTry: Number(foreignGrossProceedsTry.toFixed(2)),
      foreignCostBasisTry: Number(foreignCostBasisTry.toFixed(2)),
      foreignGrossGainTry: Number(foreignGrossGainTry.toFixed(2)),
      foreignGrossLossTry: Number(foreignGrossLossTry.toFixed(2)),
      foreignNetTaxableCapitalGainTry: Number(foreignNetTaxableCapitalGainTry.toFixed(2)),
      foreignDividendsGrossTry: Number(foreignDividendsGrossTry.toFixed(2)),
      foreignDividendsWithholdingPaidTry: Number(foreignDividendsWithholdingPaidTry.toFixed(2)),
      foreignDividendsNetReceivedTry: Number(
        (foreignDividendsGrossTry - foreignDividendsWithholdingPaidTry).toFixed(2)
      ),
      fundNetGainTry: Number(fundNetGainTry.toFixed(2)),
      fundWithholdingTaxEstimatedTry: Number(fundWithholdingTaxEstimatedTry.toFixed(2)),
      totalCommissionsDeductedTry: Number(totalCommissionsDeductedTry.toFixed(2)),
    },
    lineItems,
    notes,
  };
}

/**
 * Serializes the AnnualTaxReport to CSV format (semicolon separated with UTF-8 BOM).
 */
export function generateTaxReportCsv(report: AnnualTaxReport): string {
  const lines: string[] = [];
  lines.push(`StockMind Yıllık Vergi ve Değer Artış Kazancı Raporu - ${report.taxYear}`);
  lines.push(`Mükellefiyet Türü;${report.taxpayerType === 'individual_tr' ? 'Tam Mükellef Gerçek Kişi' : 'Kurumlar Vergisi Mükellefi'}`);
  lines.push(`Oluşturulma Tarihi;${report.generatedAt}`);
  lines.push('');
  lines.push('ÖZET VERGİ MATRAHI (TL);Tutar');
  lines.push(`BIST Brüt Hasılat;${report.summary.bistGrossProceedsTry.toFixed(2)}`);
  lines.push(`BIST Maliyet Bazı;${report.summary.bistCostBasisTry.toFixed(2)}`);
  lines.push(`BIST Net Kazanç (GVK Geçici 67 - %0 Stopaj);${report.summary.bistNetGainTry.toFixed(2)}`);
  lines.push(`Yabancı Hisse Brüt Hasılat;${report.summary.foreignGrossProceedsTry.toFixed(2)}`);
  lines.push(`Yabancı Hisse Maliyet Bazı;${report.summary.foreignCostBasisTry.toFixed(2)}`);
  lines.push(`Yabancı Hisse Brüt Kazanç;${report.summary.foreignGrossGainTry.toFixed(2)}`);
  lines.push(`Yabancı Hisse Mahsup Edilebilir Zarar;${report.summary.foreignGrossLossTry.toFixed(2)}`);
  lines.push(`Yabancı Hisse Net Vergilendirilebilir Matrah (Beyana Tabi);${report.summary.foreignNetTaxableCapitalGainTry.toFixed(2)}`);
  lines.push(`Yabancı Temettü Brüt Hasılat;${report.summary.foreignDividendsGrossTry.toFixed(2)}`);
  lines.push(`Yabancı Temettü Kesilen ABD Stopajı (%20);${report.summary.foreignDividendsWithholdingPaidTry.toFixed(2)}`);
  lines.push(`Toplam Düşülen Komisyon ve Giderler;${report.summary.totalCommissionsDeductedTry.toFixed(2)}`);
  lines.push('');
  lines.push('İŞLEM DETAYLARI');
  lines.push('Tarih;Sembol;Tür;Borsa;Kategori;İşlem;Adet;Hasılat (TL);Maliyet (TL);Komisyon (TL);Net Kazanç (TL);Stopaj (TL);Vergi Mevzuatı;Beyannameye Tabi mi?');
  for (const item of report.lineItems) {
    lines.push([
      item.date.slice(0, 10),
      item.symbol,
      item.assetType,
      item.exchange,
      item.category,
      item.transactionType,
      item.quantity,
      item.proceedsTry.toFixed(2),
      item.costBasisTry.toFixed(2),
      item.commissionTry.toFixed(2),
      item.netGainTry.toFixed(2),
      item.withholdingTaxPaidTry.toFixed(2),
      `"${item.taxTreatment.replace(/"/g, '""')}"`,
      item.isTaxReturnSubject ? 'EVET' : 'HAYIR',
    ].join(';'));
  }
  return `\uFEFF${lines.join('\n')}\n`;
}
