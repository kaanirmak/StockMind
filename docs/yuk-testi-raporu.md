# OPS-14 — Piyasa ve Portföy API Yük Testi Raporu

## Kapsam ve Hedef Uç Noktalar

Yük testi paketi ([`src/lib/ops/apiLoadTest.ts`](../src/lib/ops/apiLoadTest.ts) ve [`scripts/run-api-load-test.mjs`](../scripts/run-api-load-test.mjs)), tipik (`concurrency=8`) ve yoğun (`concurrency=32`) kullanım profilleri altında şu 5 piyasa ve portföy uç noktasını eşzamanlı olarak sınar:

- `/api/stocks?exchange=BIST&page=1&limit=25` — Sayfalı BIST piyasa taraması
- `/api/markets/overview` — Endeks, döviz, emtia ve kripto özet verisi
- `/api/funds?page=1&limit=25` — Sayfalı TEFAS fon rehberi
- `/api/stocks?symbols=THYAO,GARAN,ASELS,AAPL&liveOnly=true` — Portföy varlıkları için sembol kapsamlı canlı hisse fiyat yenilemesi
- `/api/funds?symbols=TTE,AFT,YAS` — Portföy fonları için sembol kapsamlı TEFAS fiyat yenilemesi

## Ölçüm Profilleri ve SLA Eşikleri

| Profil | Eşzamanlılık | Toplam İstek | Maks. Hata Oranı | Maks. p95 Gecikme |
|---|---:|---:|---:|---:|
| Tipik Kullanım (`typical`) | 8 | 40 | %2.0 | 800 ms |
| Yoğun Kullanım (`heavy`) | 32 | 160 | %3.0 | 1800 ms |

## Baz Ölçüm Sonuçları (`instrumented-local`, tek-uçuş birleştirme + 30s TTL)

Komut: `npm run perf:api-load` (`node scripts/run-api-load-test.mjs`)

- **Tipik Kullanım (`concurrency=8`)**:
  - İstek sayısı: `40`, Hata oranı: `%0.00`
  - Yanıt süresi: `p50=0.05ms`, `p95=9.35ms`, `p99=9.43ms`
  - Dış sağlayıcı çağrısı: `5` (`0.13 / istek`, birleştirme/önbellek tasarrufu `%87.5`)
- **Yoğun Kullanım (`concurrency=32`)**:
  - İstek sayısı: `160`, Hata oranı: `%0.00`
  - Yanıt süresi: `p50=0.05ms`, `p95=9.15ms`, `p99=9.21ms`
  - Dış sağlayıcı çağrısı: `5` (`0.03 / istek`, birleştirme/önbellek tasarrufu `%96.9`)

Not: Canlı ortam (`staging`/`production` veya yerel sunucu) üzerinde dış ağ gecikmesiyle aynı testi çalıştırmak için:

```bash
STOCKMIND_LOAD_TEST_BASE_URL=http://127.0.0.1:3000 npm run perf:api-load -- --json
```

