# PIY-11 — Gösterge Bazlı ve Liste Bazlı Alarmların Değerlendirmesi

Bu değerlendirme belgesi, StockMind için **gösterge bazlı (RSI/SMA kesişimi)** ve **liste bazlı (izleme listesi / portföy kuralı)** alarmların veri kaynağı, eşik davranışı ve arka plan çalışma maliyeti tasarımını tanımlar. Tekrarlanabilir değerlendirme motoru [`src/lib/alerts/indicatorRuleEvaluator.ts`](../src/lib/alerts/indicatorRuleEvaluator.ts) içindedir.

## 1. Veri Kaynağı ve Eşik Davranışı

| Kural Tipi | Veri Kaynağı | Eşik & Histerezis Davranışı | Eksik Veri Politikası |
|---|---|---|---|
| **RSI(14) Eşik Geçişi** (`rsi_below` / `rsi_above`) | Kapanış teyitli günlük/saatlik OHLCV mumları (`filterValidCloseCandles`) | Yalnızca kapanan barda eşik geçişinde tetiklenir; `hysteresisBand` (ör. RSI 30 altında tetiklenip 35 üzerine çıkmadan tekrarlamama) + `cooldownBars` ile gürültü bastırılır. | Yetersiz mumda (`< period + 2`) `insufficient_candles` döner, tahmini değer üretmez. |
| **SMA(20/50) Kesişimi** (`sma_cross_above` / `sma_cross_below`) | Kapanış teyitli OHLCV mumları | Önceki ve son hizalı barda hızlı/yavaş ortalama yön değişimi aranır. | Yetersiz mumda `insufficient_candles` döner. |
| **Liste Bazlı Kural** (`evaluateListAlertRule`) | Sembol kümesi tekilleştirilmiş toplu mum/fiyat önbelleği | Liste içindeki her benzersiz sembol aynı şablon kuralla değerlendirilir. | Eksik sembol yalnızca kendi satırında yetersiz veri bildirir; diğer sembolleri bloklamaz. |

## 2. Arka Plan Maliyet Analizi

- **Tekilleştirme İlkesi:** Arka plan maliyeti kullanıcı sayısıyla değil, sistemdeki **benzersiz aktif sembol** sayısıyla (`O(uniqueSymbols)`) ölçeklenir.
- **Önbellek TTL:** Gösterge serileri için minimum **15 dakikalık** mum önbelleği kullanıldığında `estimateAlertBackgroundCost({ uniqueSymbols: 50, pollIntervalMinutes: 5, candleRefreshMinutes: 15 })` günde `4.800` mum yenilemesi (~`9 ms` Worker CPU/döngü -> `low` maliyet katmanı) ile sınırlı kalır.
- **Tekrarlanabilir İlk Kural:** Örnek kapanış serisi üzerinde `evaluateIndicatorAlertRule` ve `evaluateListAlertRule` her çalıştırmada birebir aynı sinyal barını, gösterge değerini ve bastırma kararını üretir.
