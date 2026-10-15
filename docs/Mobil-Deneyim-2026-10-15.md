# Mobil deneyim ve otomatik nakit takibi

15 Ekim 2026. Web ve Android kaynak değişiklikleri çalışma alanındadır. Web yayını ve APK dağıtımı bu çalışma kapsamında yapılmadı. İki eklemeli veritabanı geçişi StockMind projesine uygulandı ve sorgularla doğrulandı.

## Uygulanan düzenlemeler

- Android yenileme hareketi sayfanın üst sınırıyla kısıtlandı. İç listeler, yatay kartlar, form alanları, grafikler, sohbet ve açık katmanlar yenilemeden korunur. WebView donanım hızlandırması etkin; CSS yatay kaydırma dikey harekete izin verir.
- Modal, alt panel, tam ekran grafik ve mobil menü ortak kaydırma kilidini kullanır. İç içe katmanlarda son katman kapanmadan kilit kalkmaz; önceki kaydırma ve stil değerleri geri yüklenir. Modal klavye odağı ve Escape davranışı korunur; masaüstü hızlı işlem çekmecesi eklendi.
- Tema renkleri, ölçü, yazı boyutları, köşeler ve gölgeler `src/theme` altında toplandı. Grafik kütüphaneleri için somut renk paleti, arayüz için semantik CSS token'ları kullanılır. Sistem temasını otomatik izleme ayarlardan seçilebilir. Ortak SVG ikonları ve bileşenler kullanılır; kişisel avatar seçenekleri korunur.
- Dokunma alanları en az 44 px, görünür klavye odağı, benzersiz input açıklamaları, grafik açıklamaları ve azaltılmış hareket desteği eklendi. Kayıplar açık eksi işaretiyle gösterilir.
- Alt menüde Ana Sayfa, Piyasa Nabzı, Portföy, Takip Listesi, AI Asistan ve ikincil Diğer menüsü bulunur. Ana sayfada dört hızlı aksiyon ve en çok değişen üç takip varlığı gösterilir.
- Piyasalarda sabit mobil arama, açılır gelişmiş filtreler, takip filtresi, son kontrol zamanı ve tekrar deneme eklendi. Mevcut piyasa özeti, yükselen/düşen varlıklar ve kategori etiketleri korundu.
- Portföyde üç temel metrik öne çıkarıldı; hacim ikincil satıra ve dışa aktarım araçlara taşındı. Hisse/fon/nakit filtreleri, dokunmatik dağılım seçimi ve lot/maliyet akordeonu eklendi. Silme ve temizleme işlemleri iki aşamalı onay kullanır.
- Takip listesi için satır bazlı sunucu kayıtları, canlı abonelik, yeniden bağlanma kontrolü, hata/yeniden deneme durumu, fiyat yenileme ve sürükleme/ok tuşlarıyla sıralama eklendi. Bir cihazın güncellemesi diğer cihazın eklediği satırları topluca silmez. Yerel kayıt oturum açmış kullanıcılar için önbellek/geçiş amacı taşır; sunucu listeyi belirler.
- Bildirim alan adları birleştirildi; mevcut alarm kayıtları okunabilir. Gelen kutusu, okunmamış filtresi, arşiv, varlık detay bağlantıları ve bildirim tercihine kısayol eklendi. Uygulama içi kutu telefon push tercihinden bağımsızdır.
- AI sohbeti görünür ekran yüksekliğine uyarlanır. Portföy, risk ve piyasa özeti hazır soruları; tablo görünümü, uygun yüzde tablolarından mini grafik, uzun yanıtı daraltma ve sade hata mesajları eklendi.
- Ayarlar Hesap & Güvenlik, Bildirim Tercihleri, Görünüm & Tema ve AI Ayarları olarak ayrıldı. Veri temizleme hesabın altındaki tehlikeli alanda, iki aşamalı onayla sunulur. Mevcut sürüm/güncelleme merkezi korunur.
- Uzun masaüstü piyasa/varlık tabloları görünür satırlarla sınırlandırılır. Piyasa ve grafik istekleri sınırlı süreli önbellek ve eşzamanlı istek birleştirme kullanır; başarısız yanıtlar önbelleğe alınmaz. Özel hesap verileri bu ortak piyasa önbelleğine girmez.

## Nakit hesabının kuralları

Kullanıcının tercihi doğrultusunda bakiye elle sabitlenen bir sayı değil, para yatırma/çekme ve işlem kayıtlarından hesaplanır.

- Alış: tutar + komisyon düşer. Satış: tutar − komisyon eklenir. Temettü eklenir, masraf düşer. Bölünme nakit yaratmaz.
- TRY, USD ve EUR hesapları ayrı izlenir. Döviz dönüşümü kendiliğinden varsayılmaz; kaynak ve hedef para hareketleri doğru tutar ve kurla kaydedilmelidir.
- Döviz hareketinin işlem tarihindeki gerçek kuru net yatırılan sermayeyi; güncel kur eldeki nakdin bugünkü TL değerini belirler. Eksik kur açıkça bildirilir.
- Para yatırma/çekme yatırım kârı değildir. Nakit takibi etkin olduğunda net hesap değeri varlıklar + nakittir; toplam kâr net hesap değeri − tarihsel kurlarla net yatırılan sermayedir. Getiri yüzdesi net sermayeye göre basit orandır; TWR/IRR değildir.
- Günlük dış para akışları günlük getiri paydasından ayrılır. Önceden elde tutulan dövizin ve aynı gün kaydedilen para hareketlerinin kur etkisi hesaba katılır.
- Eski portföylere başlangıç bakiyesi üretilmez. İlk gerçek para hareketi girilene kadar eski varlık değerlemesi korunur. Eksik geçmiş kayıtlar negatif nakde yol açarsa açık uyarı gösterilir.
- Yetersiz bakiyeli para çekme form ve mağaza katmanında reddedilir. Para hareketi silme iki aşamalı onayla bakiyeyi yeniden hesaplar. Bu bir yatırım kayıt uygulamasıdır; banka veya aracı kurumdan para transferi gerçekleştirmez.
- Alım/satım geçmişini temizlemek para yatırma/çekme geçmişini silmez. Portföy silindiğinde ona bağlı para hareketleri veritabanında birlikte silinir.

## Doğrulama ve sınırlar

- 73 otomatik test: mevcut finans/güvenlik testleri, iç içe kaydırma kilidi, önbellek, bildirim dönüşümü, açık zarar işareti ve sekiz nakit senaryosu.
- TypeScript kontrolü ve ESLint hata kontrolü temiz. Depodaki mevcut linter uyarıları ayrı durmaktadır.
- Üretim derlemesi Webpack ile geçti. Varsayılan Turbopack derlemesi bu çalıştırma ortamında yerel port açma kısıtına takıldı; derleyici değişikliği proje ayarlarına yazılmadı.
- Android Java debug derlemesi geçti. Bağlı Android cihazı bulunmadığından gerçek cihazda hareket, farklı üreticilerin WebView davranışı ve yazılım klavyesi uçtan uca doğrulanamadı.
- 390 px tarayıcı kontrolünde para hareketi panelinin açılması, yatay taşma olmaması, kaydırma kilidi, Escape ile kapanma ve odağın geri dönmesi doğrulandı. Kişisel hesaplarda test işlemi/para hareketi oluşturulmadı.
- Sunucuda sıra alanı, canlı yayın ve satır erişim kuralları doğrulandı. Yeni `cash_movements` tablosunda anonim okuma kapalıdır; oturum açmış kullanıcı hem kayıt hem portföy sahibi olmalıdır. Çok cihazlı oturumlar ve gerçek Android cihazlarıyla ek kabul testi önerilir.

Mevcut Supabase genel taramasında eski trigger fonksiyonları için [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [anonim RPC erişimi](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) ve [parola koruması](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) uyarıları görüldü. Bu iki geçiş kullanıcı erişim yetkilerini genişletmez; eski hesap/trigger ayarları bu UI çalışmasında değiştirilmedi.
