# OPS-15 — Resmî Android Dağıtım Kanalı Değerlendirmesi

Bu belge, StockMind Android uygulamasının (`com.kaanirmak.stockmind`, `minSdk=24`, `targetSdk=34`, `versionCode=12`) mevcut doğrudan APK dağıtımı ile resmî Google Play Store kanalı arasındaki teknik ve operasyonel farkları karşılaştırır. Yapılandırılmış değerlendirme [`src/lib/ops/androidDistributionEvaluation.ts`](../src/lib/ops/androidDistributionEvaluation.ts) içindedir.

## Kanal Karşılaştırması

| Kriter | Doğrudan İmzalı APK (`/api/download/apk`) | Resmî Google Play Store (AAB) |
|---|---|---|
| **Paket Formatı** | İmzalı `.apk` (`assembleRelease`) | Android App Bundle `.aab` (`bundleRelease`) |
| **Mağaza / Politika Gereksinimi** | İnceleme yok; cihazda "Bilinmeyen Kaynaklar" izni gerekir | $25 geliştirici hesabı, gizlilik politikası, finansal araç beyanı, `targetSdk >= 34`, yeni bireysel hesaplarda 12 tester / 14 gün kapalı test |
| **İmza Anahtarı Yönetimi** | Tekil yerel keystore (`KEYSTORE_PATH`); kaybında kullanıcı eski sürümü silmeden güncelleyemez | **Play App Signing** ile Google dağıtım anahtarı saklanır, Upload Key kaybında sıfırlanabilir |
| **Güncelleme Akışı** | `/api/app/version` üzerinden sürüm algılama + kullanıcının indirdiği APK ile manuel yükseltme | Kademeli yayım (`%5 -> %20 -> %100`), otomatik arka plan güncellemesi ve delta paket boyutu |
| **Destek & İnceleme Maliyeti** | Yayın süresi 0 gün; ancak Play Protect uyarısı ve manuel izin nedeniyle kullanıcı destek yükü yüksek | Her güncellemede 1–7 gün inceleme süresi + yıllık API/Data Safety uyumu; ancak düşük son kullanıcı kurulum desteği |

## Önerilen Geçiş Planı

1. **Hızlı Beta / Doğrudan Kanal:** Dahili ve erken test kullanıcıları için `/api/download/apk` + SHA-256 doğrulama akışı korunur.
2. **Genel Dağıtım:** Play Console'da **Play App Signing** etkinleştirilerek Upload Key ayrımı kurulur, gizlilik politikası (`/help` + genel URL) ve finansal bilgilendirme beyanı bağlanıp `cd android && ./gradlew bundleRelease` çıktısıyla kapalı test sürecine girilir.

