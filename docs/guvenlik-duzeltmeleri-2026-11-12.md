# 12 Kasım 2026 — Güvenlik düzeltmeleri

## Kodda tamamlananlar

- Android WebView ve APK indirmeleri ayrıştırılmış URL’nin protokol, alan adı ve portuyla doğrulanır. Benzer başlangıçlı alan adları, URL kullanıcı bilgisi, farklı portlar ve release HTTP bağlantıları reddedilir. Release özel sunucu değiştirme ekranı kapalıdır. Debug yapılandırmasındaki geliştirme adresi ayrı değerlendirilir.
- Release manifestinde düz HTTP kapalıdır; yerel geliştirme izni yalnız debug varyantındadır. Web sayfalarının CSP başlığı üçüncü taraf frame yüklenmesini önler; native köprü yalnız güvenilen içerikle kullanılmalıdır.
- Saatlik AI kotası yalnız kalıcı RPC’den okunur. RPC eksikliği/hatası veya geçersiz yanıt ücretli çağrıya izin vermez. Hazırlık API’si de hayalî kullanılabilir kota göstermez.
- Auth callback, dış yönlendirme kökenini yapılandırılmış uygulama adresinden alır; forwarded başlıklarını dikkate almaz. Ters eğik çizgi, kontrol karakteri ve harici next adresleri reddedilir.
- Yönetim API’leri doğrulanmış yönetici kimliğiyle aynı kullanıcıya ait imzası doğrulanmış AAL2 JWT ister. İstemci storage bayrağıyla erişim açılamaz. Konsol, Auth servisinin WebAuthn MFA veya TOTP challenge/verify akışını kullanır. Biyometrik işlem başarısız olunca otomatik yeniden kayıt yapılmaz. Çıkış düğmesi Auth oturumunu kapatır.
- Eski e-posta onay/ret GET bağlantıları yetki değiştirmez; MFA korumalı yönetim konsolunu açar. Karar işlemleri oturum ve origin kontrolüyle POST üzerinden yapılır.
- Bültenin gönderimden önce kalıcı kuyruğa yazılması zorunludur. Servis rolüne özel atomik UPDATE/RPC ile alıcı sahiplenilir; eşzamanlı çalışan aynı alıcıyı alamaz. Sonuç yalnız doğru claim tokenıyla kaydedilebilir. Yeniden deneme zamanı ve azami deneme sayısı SQL tarafında uygulanır.
- SMTP çağrısı sırasında çalışan kesilirse processing kaydı otomatik yeniden sahiplenilmez. Sağlayıcı kaydı uzlaştırılmadan tekrar gönderilmez. SMTP’nin uçtan uca exactly-once teslimatı garanti edilmez; işlem başladıktan sonraki belirsizliği çift gönderim üretmeden görünür tutarız.
- Kişiselleştirilmiş bültenin hatalı portfolio_transactions sorgusu mevcut transactions tablosuna yönlendirildi.

## Canlıya uygulanan migration sırası

Kullanıcının yeniden açılan onayıyla aşağıdaki dokuz migration canlı StockMind veritabanına uygulandı. Yerel dosya adları canlı migration sürümleriyle eşleştirildi. Önceden bulunan watchlist_server_fields sürüm farkı da dosya adı eşleştirilerek giderildi; SQL içeriği değiştirilmedi.

1. `20261112002822_durable_ai_hourly_quota.sql`
2. `20261112002839_last_verified_quotes.sql`
3. `20261112002851_email_delivery_queue.sql`
4. `20261112002900_server_alert_events.sql`
5. `20261112002909_notification_inbox_sync.sql`
6. `20261112002918_notification_devices.sql`
7. `20261112002929_funds_nullable_metrics.sql`
8. `20261112002938_bulletin_run_telemetry.sql`
9. `20261112002949_security_hardening.sql`

Son migration dört tetikleyici fonksiyonun search_path değerini sabitler, gereksiz doğrudan çalıştırma izinlerini kaldırır, cache ve telemetri izinlerini açıkça tanımlar, kullanıcıların sunucu alarm olayında yalnız read_at/archived_at alanlarını güncellemesine izin verir ve atomik bülten RPC’lerini ekler.

Canlı doğrulama tamamlandı: yeni sekiz tablonun tamamında RLS açık, tetikleyici fonksiyonların search_path ayarı sabit ve doğrudan anon/authenticated çalıştırma izni kapalı. Kota RPC’si anonim erişime kapalı; standart 5, Pro 20 soru/saat politikası mevcut. Bülten sahiplenme ve tamamlama RPC’leri yalnız service_role tarafından çağrılabilir.

Gerçek veritabanında rollback ile biten testte ilk sahiplenme başarılı oldu; ikinci sahiplenme, yanlış tokenla tamamlama ve accepted kaydı yeniden sahiplenme reddedildi. Test gerçek e-posta göndermedi ve kalıcı kayıt bırakmadı.

Advisors artık değiştirilebilir search_path ve anonim SECURITY DEFINER uyarılarını üretmiyor. İki kota fonksiyonunun authenticated SECURITY DEFINER uyarısı tasarlanan erişimdir: fonksiyonlar auth.uid ile sınırlıdır, arama yolu sabittir ve özel tablolara doğrudan erişim kapalıdır. Dört RLS/no-policy bilgi kaydı da istemciye kapalı sunucu tabloları için beklenir. Sızdırılmış parola koruması uyarısı açık kalmıştır.

Web dağıtımı ve gerçek kullanıcı kabul testleri ayrıca beklemektedir; migration uygulanması tek başına uçtan uca özellik doğrulaması sayılmaz.

## Dış yapılandırma ve kabul testleri

- Supabase Auth’ta sızdırılmış parola koruması hâlâ açık iş olarak izlenir. Mevcut bağlayıcı Auth ayarlarını değiştirmeyi sunmuyor. Ücretli plan değişikliği yapılmadı.
- WebAuthn MFA kullanılacaksa Auth servisinde destek/izinli origin ayarı doğrulanmalıdır. TOTP seçeneği aynı AAL2 doğrulamasını sağlar. Gerçek yönetici hesabında kurulum/kurtarma ve giriş kabul testi henüz yapılmadı.
- Yeni imzalı APK üretimi, sürüm kodunun artırılması, eski kurulum üstüne gerçek cihaz testi ve dağıtım ayrıca yapılmalıdır. Üretimde sunulan APK bu kod değişikliğiyle kendiliğinden güncellenmez.
- Gmail alıcı kutusu teslimatı, kapalı Android alarmı, kapalı tarayıcıya gerçek sunucu Web Push ve staging HTTP yük testi hâlâ kabul testi bekler.

## Doğrulama

- 302 otomatik test: tamamı geçti, atlanan test yok. Yeni testler sahte forwarded host/next, AAL1 ve imza hatası, eşzamanlı bülten ve eksik kuyruk/RPC reddini kapsıyor. Native URL politikası Java 21 ile gerçekten derlenip çalıştırıldı.
- TypeScript kontrolü ve ESLint bütçesi geçti; diff whitespace kontrolü temiz.
- Next.js üretim derlemesi ve OpenNext Cloudflare Worker derlemesi geçti. Dağıtım yapılmadı.
- Yerel PostgreSQL başlatma denemesi sandbox’ın paylaşımlı bellek kısıtı nedeniyle çalışmadı. Ardından onaylı migration’lar gerçek Supabase PostgreSQL üzerinde uygulandı; sahiplenme/tamamlama kontrolleri rollback işlemiyle doğrulandı.
- Tam Android derlemesi Gradle daemon soketi için sandbox izin vermediğinden tamamlanamadı. Java politika testi fiziksel cihaz testi değildir.
