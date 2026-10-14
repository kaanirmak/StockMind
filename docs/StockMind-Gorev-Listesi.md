# StockMind görev listesi

Başlangıç: 14 Ekim 2026. Kaynak: kapsamlı kod ve ürün incelemesi.
Durum: ⏳ sırada · ▶ çalışılıyor · ✅ yerelde doğrulandı · 🚀 yayına alındı.
Yerelde tamamlanma ile canlıya çıkış ayrı takip edilir. Hiçbir görev yalnız kodu yazıldığı için canlıda tamamlanmış sayılmaz.

## A — Güvenlik ve erişim

| ID | Öncelik | Görev / kabul ölçütü | Durum |
|---|---|---|---|
| SEC-01 | P0 | Bildirimde sabit anahtarları ve CRON anahtarı paylaşımını kaldır; yalnız ayrı ortam anahtarı geçsin | ✅ |
| SEC-02 | P0 | AI/komite/e-posta endpoint'lerine doğrulanmış oturum ve origin kontrolü; anonim çağrı yan etki üretmesin | ✅ |
| SEC-03 | P0 | Merkezi atomik kullanıcı kotası; birden çok sunucuda aynı limit; kota servisi hatasında güvenli ret | ✅ |
| SEC-04 | P0 | İstek boyutu, mesaj rolleri, model listesi, sembol ve giriş şeması doğrulaması | ✅ |
| SEC-05 | P0 | E-posta yalnız doğrulanmış hesap adresine; istemci SMTP hedefi kapalı; TLS doğrulaması açık | ✅ |
| SEC-06 | P1 | Admin istemcide anon/placeholder fallback'i kaldır; yanlış yapılandırma açık hata versin | ✅ |
| SEC-07 | P1 | AI anahtarını global/guest storage ve auth metadata'dan çıkar; hesap izolasyonu ve geçiş planı | ✅ |
| SEC-08 | P1 | Transactions RLS'de portföy sahipliği; farklı kullanıcılarla SELECT/INSERT/UPDATE/DELETE testleri | ✅ |
| SEC-09 | P1 | Oturum, route koruması, hesap değişiminde state temizliği ve cookie sorunlarını düzelt | ✅ |
| SEC-10 | P1 | Broadcast ayrı tabloda; kalıcı kayıt başarısızsa başarı dönmesin; global eski önbelleği kaldır | ✅ |
| SEC-11 | P1 | Cron sırlarını URL'den çıkar; hata/log çıktılarında hassas veri redaksiyonu | ✅ |

## B — Veri doğruluğu

| ID | Öncelik | Görev / kabul ölçütü | Durum |
|---|---|---|---|
| DATA-01 | P0 | Tarihsel veri kesilince sentetik mum ve buna bağlı teknik analiz üretme | ✅ |
| DATA-02 | P0 | Piyasa kartlarında sabit fiyatları kaldır; yükleniyor/eksik/eski durumlarını göster | ✅ |
| DATA-03 | P0 | Eksik kur ve fiyat için 38,5/1,0 gibi sabitleri kaldır; eksik değerlemeyi açık göster | ✅ |
| DATA-04 | P0 | Eksik hacim, F/K, temettü, high/low için uydurma alanları kaldır | ✅ |
| DATA-05 | P0 | E-posta şablonu ve cron'daki sabit portföy/piyasa rakamlarını kaldır | ✅ |
| DATA-06 | P1 | Ortak fiyat sözleşmesi: instrumentId, source, asOf, fetchedAt, currency, status | ✅ |
| DATA-07 | P1 | Enstrüman kimliğini borsa/para birimiyle normalize et; sağlayıcı adaptörlerini ayır | ✅ |
| DATA-08 | P1 | Fon API'sinde nihai sıralama, limit ve sayfalama; değerleme tarihini koru | ✅ |
| DATA-09 | P1 | Tarihçe ölçekleme, saat dilimi, seans ve endeks birimlerini doğrula | ✅ |
| DATA-10 | P2 | Kaynak güncelliği, kullanım koşulları ve ürün vaatlerini doğrulama süreci | ✅ |

## C — Finansal hesap ve kayıt

| ID | Öncelik | Görev / kabul ölçütü | Durum |
|---|---|---|---|
| FIN-01 | P0 | Günlük kârı önceki kapanış ve gün içi işlemlerle doğru hesapla; 100→110 testi 10 versin | ✅ |
| FIN-02 | P0 | Gerçekleşmiş/açık/toplam kâr ayrımı; 100 alış→120 tam satış toplam kârı 20 olsun | ✅ |
| FIN-03 | P1 | FIFO/maliyet yöntemini tanımla; tek motor; eski yinelenen motorları kaldır | ✅ |
| FIN-04 | P1 | Tarihsel kur, kur etkisi, işlem sırası ve ondalık hassasiyet politikası | ✅ |
| FIN-05 | P1 | Fazla satış ve geçersiz işlem reddi; miktar/tarih/fiyatı sessizce değiştirme | ✅ |
| FIN-06 | P1 | Nakit, temettü, bölünme, ücret olay modeli ve performans ölçümü | ✅ |
| FIN-07 | P1 | Sunucuda gerçek günlük snapshot; sentetik geçmiş fonksiyonunu kaldır | ✅ |
| SAVE-01 | P0 | DB hatası yerel başarı olmasın; pending/synced/failed durumları | ✅ |
| SAVE-02 | P0 | Excel tümünü değiştir atomik olsun; ekleme başarısızsa eski kayıt korunsun | ✅ |
| SAVE-03 | P1 | Excel ekleme modunda mevcut işlemler store'da korunsun | ✅ |
| SAVE-04 | P1 | Import batch, idempotency, mükerrer kontrolü ve geri alma | ✅ |
| SAVE-05 | P1 | Silme sonuçlarını doğrula; guest/offline davranışını ayrı tanımla | ✅ |
| SAVE-06 | P1 | Migration tek şema kaynağı; notes içine kur encode eden fallback'i kaldır | ✅ |

## D — UI/UX ve erişilebilirlik

| ID | Öncelik | Görev / kabul ölçütü | Durum |
|---|---|---|---|
| UI-01 | P1 | Boş dashboard için ilk işlem/ekstre/takip listesi başlangıç akışı | ✅ |
| UI-02 | P1 | Dashboard bilgi hiyerarşisi; metrikler, ana eylem, değişimler, grafik, varlıklar | ✅ |
| UI-03 | P1 | Portföyde ana eylem tek; silme ve dışa aktarım ikincil; kâr etiketleri doğru | ✅ |
| UI-04 | P1 | İşlem formunda varlık→miktar/fiyat→tarih/kur→özet; kayıt durumu görünür | ✅ |
| UI-05 | P1 | Excel sütun eşleme, hatalı satırlar, tarih belirsizliği ve önce/sonra önizlemesi | ✅ |
| UI-06 | P1 | Sahte bildirimleri, temelsiz Pro rozetlerini ve tekrar APK tanıtımlarını kaldır | ✅ |
| UI-07 | P1 | Şifre sıfırlama isteği, callback ve yeni şifre akışını tamamla | ✅ |
| UI-08 | P1 | Modal dialog semantiği, focus trap/geri dönüş, form hata bağlantıları | ✅ |
| UI-09 | P1 | Mobil sabit navigasyon/geri dönüş, kompakt varlık satırları, dokunma alanları | ✅ |
| UI-10 | P2 | Tema adları, tasarım token'ları, kontrast, tipografi, sayısal hizalama | ✅ |
| UI-11 | P2 | Piyasalar filtre/arama/sıralama URL state'i ve veri durumları | ✅ |
| UI-12 | P2 | Varlık detayında kimlik/fiyat/grafik/eylem/kaynaklı analiz düzeni | ✅ |
| UI-13 | P2 | Dil desteğini tamamla veya vaatleri daralt; tutarlı formatlama | ✅ |
| UI-14 | P2 | Hata/404 sayfaları, yeniden deneme, sayfa metadata ve SEO kapsamı | ✅ |

## E — AI ve Quant

| ID | Öncelik | Görev / kabul ölçütü | Durum |
|---|---|---|---|
| AI-01 | P0 | Komitede istemci quote'unu güvenilir veri sayma; sunucudan doğrula | ✅ |
| AI-02 | P1 | Kaynaklı analiz ve varsayımlı senaryoyu açık ayır; türetilmiş bilançoları kaldır | ✅ |
| AI-03 | P1 | Gerçek Monte Carlo örneklemi/yüzdelikler veya dürüstçe yeniden adlandırma | ✅ |
| AI-04 | P1 | DCF birim/para birimi/model uygunluğu ve hassasiyet tablosu | ✅ |
| AI-05 | P1 | AI kaynak/tarih/kapsam gösterimi; veri yokluğunda uydurma yorumları önle | ✅ |
| AI-06 | P2 | Yanıt akışı, iptal/zaman aşımı, çıktı şeması ve değerlendirme örnekleri | ✅ |
| AI-07 | P2 | Anahtar/model yönetimini ileri ayarlara taşı; maliyet ve kota görünürlüğü | ✅ |

## F — Performans, işletim ve mobil yayın

| ID | Öncelik | Görev / kabul ölçütü | Durum |
|---|---|---|---|
| OPS-01 | P1 | Görünürlük/seansa göre yenileme; ortak önbellek, iptal, retry/backoff | ✅ |
| OPS-02 | P1 | Veri sağlayıcıları/store/ayarlar/portföy sayfasını sorumluluklarına ayır | ✅ |
| OPS-03 | P1 | Cron bağımlılıkları ve çok kullanıcılı rapor kuyruğu; tekrarlar idempotent | ✅ |
| OPS-04 | P1 | Veri/kayıt/AI/job hata ve gecikme ölçümleri; hassas verisiz loglar | ✅ |
| OPS-05 | P1 | Anlamlı hesaplama, güvenlik, kayıt ve uçtan uca test altyapısı | ✅ |
| OPS-06 | P1 | CI: typecheck, test, lint, build; mevcut lint borcunu aşamalı azalt | ✅ |
| OPS-07 | P2 | Gerçek cihaz, erişilebilirlik, yük ve sayfa performansı ölçümü | ⏳ |
| AND-01 | P1 | WebView HTTPS/host izin listesi, dış bağlantı ve native bridge sınırı | ✅ |
| AND-02 | P1 | Dosya/mixed content erişimini daralt; güncelleme URL'sini doğrula | ✅ |
| AND-03 | P1 | İmzalı release APK, sürüm metadata'sı ve güncelleme bütünlüğü | ✅ |

## İlk paket ve yayın bağımlılıkları

İlk uygulama paketi: SEC-01–06, SEC-10, AI-01 ve OPS-05'in güvenlik testleri alt işi.
Kota ve bildirim için yeni migration hazırlanacak; canlı veritabanına uygulanması ve uygulamanın dağıtımı ayrı adımlar. Migration eksikse maliyetli işlemler güvenli biçimde reddedilecek.
Sonraki paket: DATA-01–05, FIN-01–02 ve SAVE-01–03.

Her tamamlanan pakette: değişiklik özeti, test sonucu, tamamlanmayan kabul ölçütü ve canlı yayın durumu kaydedilir.
