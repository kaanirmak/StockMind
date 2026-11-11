# StockMind ürün geliştirme görevleri

10 Kasım 2026 tarihli canlı uygulama incelemesi, kod incelemesi ve rakip araştırmasından çıkarılan iş listesi. Her satır bağımsız bir görevdir. Önceki [görev listesi](StockMind-Gorev-Listesi.md) tarihsel kayıt olarak kullanılabilir. Buradaki maddeler mevcut davranışın iyileştirilmesini, yeniden doğrulanmasını veya yeni bir özelliğin eklenmesini kapsar.

| Öncelik | Anlamı |
|---|---|
| P0 | Veri doğruluğu, teslimat, yayın veya kullanıcı güveni için ilk iş |
| P1 | Günlük kullanıcı akışını iyileştiren iş |
| P2 | Araştırma, raporlama veya Pro değerini artıran iş |
| P3 | İhtiyaç ve dış bağımlılıklar doğrulandıktan sonra değerlendirilecek iş |

Durum işaretleri ☐ sırada, ◐ yerelde doğrulandı, ☑ canlıda doğrulandı. Bir görevi kapatırken kabul ölçütünün nasıl doğrulandığını kaydet. Canlı hizmete veya cihaza bağlı işlerde yerel test ve canlı doğrulama durumlarını ayrı belirt.

## 1. Piyasa verisi ve veri kalitesi

| Kimlik | Öncelik | Görev | Tamamlanma ölçütü | Durum |
|---|---|---|---|---|
| VER-01 | P0 | Piyasa özetindeki sabit fiyatları kaldır | Sağlayıcı kesintisi testinde BIST 100, kur, altın ve diğer kartlar kaynaklı son değeri veya veri yok durumunu döndürür. | ◐ |
| VER-02 | P0 | Fiyat kaynağını ve gözlem zamanını API’ye ekle | Her geçerli fiyat sağlayıcı, veri zamanı ve alınma zamanı alanlarını taşır. (`observation`: `source`, `asOf`, `fetchedAt` hisse, endeks, döviz, emtia, kripto, TEFAS ve geçmiş/gösterge API’lerinde doğrulandı.) | ◐ |
| VER-03 | P0 | Fiyat durumlarını arayüzde tutarlı göster | Güncel, gecikmeli, son kapanış, eski ve eksik değerler kartta ve detayda ayrı etiketlenir. (`classifyPriceStatus` ve `PriceStatusBadge` ile piyasa özeti, piyasalar, hisse ve fon detayında 5 durum doğrulandı.) | ◐ |
| VER-04 | P0 | Son doğrulanmış fiyatı sakla | Sağlayıcı kesilince son gerçek değer özgün zaman damgasıyla görünür. İlk veri yoksa boş durum gösterilir. (`lastVerifiedStore`, `market_quote_cache` şeması ve `MarketOverview` yerel önbelleği ile doğrulandı.) | ◐ |
| VER-05 | P0 | Eksik fiyatın portföy toplamına etkisini göster | Kısmi değerleme etiketlenir ve fiyatı eksik pozisyonlar listelenir. (`ValuationStatus.isPartialValuation`, `missingPositions`, `unpricedCostTotal`, `PartialValuationBanner` ve `HoldingsTable` pozisyon rozetleri doğrulandı.) | ◐ |
| VER-06 | P0 | Eksik veya eski fiyatla alarm tetiklenmesini önle | Kaynak ve tazelik kontrolünden geçmeyen fiyat için alarm ertelenir ve nedeni kaydedilir. (`evaluateAlertPriceFreshness`, `recordDeferredAlert`, `WatchlistAlertWatcher` erteleme koruması ve izleme listesi rozeti doğrulandı.) | ◐ |
| VER-07 | P0 | Gerçek hacim ve gün içi fiyat alanlarını doğrula | Eksik hacim, yüksek/düşük ve kapanış alanları boş kalır. Varsayılan değerler teknik hesaplamaya girmez. (`stocks.ts`, `indicators/index.ts`, `CandlestickChart.tsx` ve `TechnicalIndicatorsPanel.tsx` içindeki sentetik hacim/gün içi aralık/RSI/SMA varsayılanları kaldırıldı; eksik veriler boş bırakılarak doğrulandı.) | ◐ |
| VER-08 | P1 | Varlık türünü ve işlem birimini düzelt | Hisse, ETF, fon, endeks, döviz ve emtia ayrı etiketlenir. Endeks puanla, gram altın TL/gram ile gösterilir. | ☐ |
| VER-09 | P1 | Borsa ve sembol eşleşmelerini doğrula | Aynı sembole sahip farklı borsalar karışmaz. Endeks ve ETF eşlemeleri örnek varlıklarla test edilir. | ☐ |
| VER-10 | P1 | Piyasa seansını ve son kapanışı göster | Açık piyasa, kapalı piyasa ve tatil durumları veri saatine göre ayırt edilir. | ☐ |
| VER-11 | P1 | Sağlayıcı koşullarını ve veri kapsamını belgeye bağla | Her kaynak için kapsanan pazar, gecikme, gösterim ve yeniden dağıtım koşulları kaydedilir. | ☐ |

## 2. TEFAS, fon keşfi ve karşılaştırma

Canlı inceleme örneğinde 1.051 fon kaydının 1.035’i son eşitleme zamanı olmadan 1,00 fiyatıyla dönüyordu. Bu sayı inceleme anını temsil eder.

| Kimlik | Öncelik | Görev | Tamamlanma ölçütü | Durum |
|---|---|---|---|---|
| FON-01 | P0 | Fon kataloğunu fiyat verisinden ayır | Katalog kaydı gerçek fiyat bulunmadan gösterilebilir. Fiyat alanı boş kalır ve 1,00 yer tutucusu kullanılmaz. | ◐ |
| FON-02 | P0 | TEFAS eşitleme başarısızlığını teşhis et | Başarısız çalıştırmada hangi kaynak, fon veya kayıt adımının durduğu görülebilir. | ◐ |
| FON-03 | P0 | Fon eşitlemesini küçük partilerle sürdürülebilir yap | Bir parti kesilince kalan fonlara devam edilebilir. Tekrar çalıştırma aynı fiyat kaydını çoğaltmaz. | ◐ |
| FON-04 | P0 | Fon değerleme tarihini kaydet ve göster | Detay ve listede NAV tarihi görünür. Veri alma zamanı ayrı tutulur. FON-08 karşılaştırması aynı alanı kullanır. | ◐ |
| FON-05 | P0 | TEFAS kapsama göstergesi ekle | Güncel, eski, eksik ve başarısız fon sayıları her çalıştırmada raporlanır. | ◐ |
| FON-06 | P1 | Fon detayındaki veri eksikliği durumlarını tamamla | Ücret, risk, portföy dağılımı veya geçmiş fiyat eksikse ilgili alan anlaşılır bir durum gösterir. | ☐ |
| FON-07 | P1 | Fon listesinin filtrelerini genişlet | Kategori, risk, yönetim ücreti ve seçili dönem getirisi birlikte filtrelenebilir. | ☐ |
| FON-08 | P2 | İki ila dört fonu karşılaştır | Ortak tarih aralığında getiri, risk, ücret, dağılım ve son değerleme tarihi yan yana gösterilir. | ☐ |
| FON-09 | P2 | Benzer fon önerileri ekle | Karşılaştırma listesi aynı kategoriye veya benzer risk düzeyine göre oluşturulur. Eşleşme nedeni görünür. | ☐ |

## 3. Ana ekran, mobil navigasyon ve erişilebilirlik

| Kimlik | Öncelik | Görev | Tamamlanma ölçütü | Durum |
|---|---|---|---|---|
| UX-01 | P1 | Mobil ana ekranın sıralamasını değiştir | 390 pikselde portföy özeti, günün katkı sağlayan varlıkları ve önemli olay ilk görünümde önceliklidir. | ◐ |
| UX-02 | P1 | Isı haritasını kompakt başlat | İlk yükte küçük özet görünür. Kullanıcı genişletebilir ve varlık listesi eşdeğer bilgi sunar. | ◐ |
| UX-03 | P1 | Boş portföy başlangıç akışını düzenle | İlk işlem kaydı, Excel yükleme ve örnek portföy seçeneklerine tek ekrandan ulaşılır. | ◐ |
| UX-04 | P1 | Örnek portföy deneyimi ekle | Misafir, örnek veriyi kendi portföy kayıtlarına karıştırmadan inceleyebilir. | ◐ |
| UX-05 | P1 | Yüklenirken sıfır portföy değerini göstermeyi önle | Oturum ve portföy yüklenirken bekleme durumu görünür. Boş ve gerçek sıfır değerler ayrılır. | ◐ |
| UX-06 | P1 | Ana özet kartını bağımsız kontrollere ayır | Portföy bağlantısı, dönem seçici ve gizlilik düğmesi klavyeyle ayrı ayrı çalışır ve doğru okunur. | ◐ |
| UX-07 | P1 | Arama ve simge düğmelerine erişilebilir ad ekle | Haber araması dahil her arama alanı ve simge düğmesi ekran okuyucuda anlamlı ad taşır. | ◐ |
| UX-08 | P1 | Mobil navigasyonda temel akışları koru | Ana ekran, piyasalar, portföy ve takip listesi tek dokunuşla erişilebilir. Haberler ve alarmlar menüde kolay bulunur. | ◐ |
| UX-09 | P1 | Açık ve koyu tema kontrastını doğrula | Temel metin, yardımcı etiket, grafik ve odak göstergeleri iki temada da ölçülür ve okunabilir hale gelir. | ◐ |
| UX-10 | P1 | Klavye ve ekran okuyucu akışlarını test et | Menü, filtre, modal, geri dönüş ve hata mesajları klavyeyle ve ekran okuyucuyla kullanılabilir. | ◐ |
| UX-11 | P1 | Yükleniyor, hata ve boş durumları birleştir | Ana ekranların her birinde durum adı, kısa neden ve uygun sonraki eylem görünür. | ◐ |
| UX-12 | P2 | Finansal sayı biçimini tutarlı yap | Negatif yüzde, Türkçe ondalık, para simgesi ve tarih yazımı tüm ekranlarda ortak biçimi kullanır. | ◐ |

## 4. Portföy, işlem kaydı ve raporlama

| Kimlik | Öncelik | Görev | Tamamlanma ölçütü | Durum |
|---|---|---|---|---|
| POR-01 | P1 | Portföyün ana eylemini İşlem Kaydet yap | Ana düğme doğrudan kayıt formunu açar. Hızlı işlem ve detay ekranı aynı adlandırmayı kullanır. | ◐ |
| POR-02 | P1 | Aracı kurum ve sanal işlem girişlerini ayır | İşlem kaydı, dış aracı kuruma gitme ve sanal bakiye ayrı seçenekler olarak görünür. | ◐ |
| POR-03 | P1 | Portföy silmeyi yönetim menüsüne taşı | Silme ana eylemlerin yanında görünmez. Onayda silinecek portföy ve etkisi belirtilir. | ◐ |
| POR-04 | P1 | Hazır aracı kurum ekstre şablonları ekle | Seçilen ilk ekstre biçimleri örnek dosyalarla tanınır ve eşlenen sütunlar önizlemede gösterilir. | ◐ |
| POR-05 | P1 | Dosya aktarım önizlemesini güçlendir | Geçerli, hatalı ve mükerrer satır sayıları görünür. Hatalı satırın nedeni kullanıcıya bildirilir. | ◐ |
| POR-06 | P1 | Excel/CSV aktarma ve geri yüklemeyi uçtan uca doğrula | Aynı örnek veri dışa aktarılıp tekrar içe alındığında tutarlar ve tarihler korunur. | ◐ |
| POR-07 | P1 | Günlük getiriyi varlık katkısına ayır | En büyük artı ve eksi katkılar TL ve yüzde puanla listelenir. Toplam katkı günlük portföy sonucuyla uzlaşır. | ◐ |
| POR-08 | P1 | Kâr, temettü, komisyon ve kur etkisini ayır | Aynı seçili dönemde gerçekleşmiş kâr, açık pozisyon sonucu, nakit olayları, ücret ve kur etkisi görülebilir. | ◐ |
| POR-09 | P2 | Referans endeks karşılaştırması ekle | Portföy ile seçili referans aynı dönem ve para biriminde, aynı başlangıç seviyesinden karşılaştırılır. | ☐ |
| POR-10 | P2 | Portföy değerini ve net yatırılan tutarı grafikle göster | Geçmiş değer serisi ile para giriş ve çıkışları ayrı çizilir. Eksik tarihçenin kapsamı belirtilir. | ☐ |
| POR-11 | P2 | Temettü görünümü ekle | Gerçekleşmiş ödemeler, ilan edilen gelecek ödemeler ve varsa tahminler ayrı gösterilir. | ☐ |
| POR-12 | P2 | Nakit akışı görünümü ekle | Para girişleri, çıkışları, temettü ve ücretler dönem ve para birimine göre filtrelenebilir. | ☐ |
| POR-13 | P2 | Yoğunlaşma ve çeşitlilik analizi ekle | En büyük pozisyonlar ile sektör, ülke ve varlık türü dağılımı tek raporda görülebilir. | ☐ |
| POR-14 | P2 | Dönem ve para birimini dışa aktarıma taşı | PDF/yazdırma ve CSV, seçili portföyü, dönemi, para birimini ve verinin tarihini taşır. | ☐ |
| POR-15 | P3 | Salt okunur aracı kurum bağlantısını değerlendir | Öncelikli kurumlar, bağlantı koşulları, maliyet, izinler ve veri silme akışı belgelenir. | ☐ |
| POR-16 | P3 | Salt okunur hesap eşitlemesini dene | Desteklenen ilk kurumda alım satım yetkisi istenmeden ekstre eşitlenir ve mükerrer işlem oluşmaz. | ☐ |

## 5. Piyasalar, hisse detayları ve tarayıcı

| Kimlik | Öncelik | Görev | Tamamlanma ölçütü | Durum |
|---|---|---|---|---|
| PIY-01 | P1 | Pazar seçicisini mobilde üstte tut | BIST, TEFAS ve ABD seçeneklerine sayfanın başından ulaşılır. | ◐ |
| PIY-02 | P1 | Son seçilen pazarı ve filtreyi hatırla | Sayfaya dönüldüğünde son seçim korunur. Paylaşılan URL açıkça seçilmiş filtreyi uygular. | ◐ |
| PIY-03 | P1 | Arama sonuçlarını ayırt edilebilir yap | Her sonuçta sembol, borsa, varlık türü ve para birimi bulunur. | ◐ |
| PIY-04 | P1 | Hisse grafiğinde veri kapsamını görünür kıl | Zaman aralığı, fiyat birimi, son mum zamanı ve veri eksikliği kullanıcıya gösterilir. | ◐ |
| PIY-05 | P1 | Hisse detayında yaklaşan olayları göster | Doğrulanmış bilanço, temettü ve diğer ilanlı olaylar tarih ve kaynakla listelenir. | ◐ |
| PIY-06 | P2 | Kaynaklı finansal tabloları bağla | Bilanço, gelir tablosu ve nakit akışı, dönem, para birimi ve kaynak bağlantısıyla gösterilir. | ☐ |
| PIY-07 | P2 | Finansal oran geçmişi ekle | Temel oranların dönem serisi ve kullanılan hesaplama yöntemi görünür. | ☐ |
| PIY-08 | P2 | BIST için kaydedilebilir tarayıcı oluştur | Kullanıcı temel ve fiyat filtrelerini kaydedebilir, adlandırabilir ve tekrar açabilir. | ☐ |
| PIY-09 | P2 | TEFAS için kaydedilebilir filtre seti ekle | Fon kategorisi, risk, ücret ve getiri koşulları kaydedilebilir. | ☐ |
| PIY-10 | P2 | Tarayıcı sütunlarını ve CSV aktarımını ekle | Sütun seçimi ile sıralama kaydedilir. CSV, seçili filtre ve sütunlarla dışa aktarılır. | ☐ |
| PIY-11 | P3 | Gösterge bazlı ve liste bazlı alarmları değerlendir | Veri kaynağı, eşik davranışı ve arka plan maliyeti doğrulanır. İlk kural örnek veride tekrarlanabilir çalışır. | ☐ |

## 6. Alarmlar, bildirimler ve cihazlar

| Kimlik | Öncelik | Görev | Tamamlanma ölçütü | Durum |
|---|---|---|---|---|
| ALR-01 | P0 | Kapalı Android’de hisse alarmını doğrula | Test cihazında uygulama ön planda olmadan eşik işlenir ve bildirim doğru varlık ekranını açar. | ◐ |
| ALR-02 | P0 | Kapalı Android’de TEFAS alarmını doğrula | Geçerli fon değerlemesiyle tetikleme ve eksik veriyle erteleme ayrı test edilir. | ◐ |
| ALR-03 | P0 | Bildirim izni ve teslimat durumunu ayır | İzin kapalıyken test sonucu bunu gösterir. İzin açık durumda kanalın sonucu ayrı kaydedilir. | ◐ |
| ALR-04 | P1 | Varlık detayından hızlı alarm kurma ekle | Fiyat veya yüzde eşiği, yön ve para birimi anlaşılır biçimde seçilebilir. | ☐ |
| ALR-05 | P1 | Tüm Alarmlar ekranı oluştur | Aktif ve duraklatılmış kurallar listelenir. Kullanıcı düzenleyebilir ve duraklatabilir. | ☐ |
| ALR-06 | P1 | Alarmın son kontrolünü ve tetiklenmesini göster | Her kuralda son kontrol zamanı, görülen fiyat ve varsa son tetikleme görünür. | ☐ |
| ALR-07 | P1 | Fiyat eşiği değerlendirmesini sunucuya taşı | Uygulama kapalıyken sunucu kuralları değerlendirir. Aynı eşik olayı bir defa kaydedilir. | ☐ |
| ALR-08 | P1 | Bildirim kutusunu hesaba bağla | Okunma, arşiv ve tercihler cihazlar arasında eşitlenir. Hesap değişiminde eski hesabın kayıtları görünmez. | ☐ |
| ALR-09 | P1 | Cihaz ve bildirim kanalı yönetimi ekle | Kullanıcı bağlı cihazları, izinleri ve etkin kanalları görebilir. Geçersiz cihaz kaydı otomatik ayıklanır. | ☐ |
| ALR-10 | P2 | Web Push kanalını ekle | Desteklenen tarayıcı ve ana ekrana kurulan iOS web uygulamasında izin, test ve bildirim bağlantısı doğrulanır. | ☐ |
| ALR-11 | P2 | Portföy hareketi bildirimleri ekle | Kullanıcı eşik ve sıklığı seçebilir. Tetikleme doğrulanmış portföy verisine dayanır ve tekrarlar sınırlandırılır. | ☐ |
| ALR-12 | P2 | KAP ve takvim uyarıları ekle | Yetkili kaynaktan gelen olay ilgili varlıkla eşleşir. Kullanıcı olay türüne göre aboneliği yönetebilir. | ☐ |

## 7. Gmail bülteni ve e-posta teslimatı

| Kimlik | Öncelik | Görev | Tamamlanma ölçütü | Durum |
|---|---|---|---|---|
| EPO-01 | P0 | Canlı Gmail göndericisini doğrula | Yetkili test alıcısına gönderilen e-postada görünen gönderen kaanrmak7@gmail.com olur ve alıcı kutusuna teslimat doğrulanır. | ◐ |
| EPO-02 | P0 | Bülten alıcı sınırını kaldır | 51 veya daha fazla uygun test alıcısının tamamı partiler halinde işlenir. | ◐ |
| EPO-03 | P0 | Kalıcı e-posta gönderim kuyruğu kur | İş yarıda kesilse de bekleyen ve tamamlanan alıcılar yeniden başlatmadan sonra ayırt edilir. | ◐ |
| EPO-04 | P0 | Yeniden denemede çift gönderimi önle | Aynı bülten günü ve alıcı için tekrar tetikleme ikinci gönderim oluşturmaz. | ◐ |
| EPO-05 | P0 | Gönderim sonuçlarını operasyon ekranına ekle | Bekleyen, kabul edilen, başarısız ve yeniden denenecek gönderimler ayrı sayaçlarla görünür. | ◐ |
| EPO-06 | P1 | Bülten aboneliğini ve doğrulanmış adresi görünür yap | Hesaptan değiştirilen tercih bir sonraki otomatik çalıştırmada uygulanır. Gönderilecek adres ekranda belirtilir. | ☐ |
| EPO-07 | P1 | Bültene verinin zamanını ve eksik alanları ekle | E-posta fiyatların gözlem zamanını içerir. Eksik kaynak olduğunda boş veri durumu görünür. | ☐ |
| EPO-08 | P1 | Zamanlanmış bülten gecikmesini izle | Planlanan zaman, başlama zamanı ve dağıtım süresi kaydedilir. Kaçan çalıştırma izlenebilir. | ☐ |
| EPO-09 | P2 | Kişiselleştirilmiş bülteni ekle | Tercih açıldığında yalnızca ilgili portföy olayları ve izin verilen özet bilgileri bültene eklenir. | ☐ |

## 8. Haber, KAP ve olay takvimi

| Kimlik | Öncelik | Görev | Tamamlanma ölçütü | Durum |
|---|---|---|---|---|
| HBR-01 | P1 | JSON olmayan yanıtı kullanıcı mesajına çevir | HTML, zaman aşımı ve boş yanıt testlerinde teknik ayrıştırma hatası yerine Türkçe mesaj gösterilir. | ◐ |
| HBR-02 | P1 | Son başarılı haber akışını sakla | Geçici kesintide son liste tarihiyle birlikte kalır ve tekrar deneme sunulur. | ◐ |
| HBR-03 | P1 | Haber kaynağı kapsamasını izle | Her kaynak için son başarılı alım, haber sayısı ve hata nedeni raporlanır. | ◐ |
| HBR-04 | P1 | Haberleri varlık kimliğine göre eşleştir | Şirket takma adları, aynı sembollü farklı borsalar ve yanlış pozitif örnekler test edilir. | ◐ |
| HBR-05 | P1 | Haberde portföy bağlantısının nedenini göster | Eşleşen varlık, olay türü ve eşleşme nedeni kartta görünür. | ☐ |
| HBR-06 | P1 | Öne çıkanlar ile en yeni akışını doğrula | Sıralama değiştirilebilir. Eski bir portföy haberi yeni gelişmeleri süresiz geriye itmez. | ☐ |
| HBR-07 | P1 | Haber, resmî açıklama ve takvim olayını ayır | Kart türleri açıkça etiketlenir. Haber tonuyla olası portföy etkisi ayrı sunulur. | ☐ |
| HBR-08 | P2 | KAP veri erişimini ve kullanım koşullarını doğrula | İzinli veri kaynağı, kapsam, gecikme ve gösterim koşulları belgelenir. | ☐ |
| HBR-09 | P2 | Uygulama içi KAP akışını ekle | Resmî açıklamalar kaynak kimliği, yayın saati, şirket ve orijinal belge bağlantısıyla görünür. | ☐ |
| HBR-10 | P2 | Bilanço ve temettü takvimi ekle | Kullanıcı yaklaşan olayları portföy veya takip listesine göre filtreleyebilir. | ☐ |
| HBR-11 | P2 | Makroekonomi takvimi ekle | Önemli Türkiye ve küresel olaylarda saat, kaynak ve mevcutsa önceki, beklenen ve gerçekleşen değer gösterilir. | ☐ |
| HBR-12 | P2 | Fiyat hareketi açıklamasını ekle | İlgili olaylar ve varlığın gün içi hareketi kaynaklarla gösterilir. Nedensellik belirsizse açıklamada belirtilir. | ☐ |

## 9. AI Asistan ve Pro deneyimi

| Kimlik | Öncelik | Görev | Tamamlanma ölçütü | Durum |
|---|---|---|---|---|
| AIP-01 | P0 | Portföy bağlamını açık seçime bağla | Genel soruda portföy alanları gönderilmez. Kullanıcı portföyü analize ekleyebilir ve hangi alanların kullanılacağını görür. | ◐ |
| AIP-02 | P1 | AI’ya giden portföy alanlarını azalt | Soru türüne göre gerekli alanlar seçilir. Tam tutarlar veya maliyetler yalnız ilgili analizlerde kullanılır. | ☐ |
| AIP-03 | P1 | Yanıtta veri kaynağı, zaman ve kapsamı göster | Sağlayıcıdan gelen veriler ve genel model yorumu ayrı işaretlenir. Eksik veri açıkça belirtilir. | ☐ |
| AIP-04 | P1 | AI hata ve yeniden deneme akışını sadeleştir | Ağ kesintisi, kota, model hatası ve kullanıcı iptali ayrı anlaşılır mesajlar üretir. | ☐ |
| AIP-05 | P1 | Model, kota ve maliyet görünürlüğünü iyileştir | Model seçimi, kalan kota, yenilenme zamanı ve kişisel anahtar seçimi aynı yerden anlaşılır. | ☐ |
| AIP-06 | P1 | Haber analizini kaynaklı ve bağlama duyarlı yap | Haber başlığı, özeti ve kaynak kullanılır. Kullanıcı portföy bağlamını ayrı seçebilir. | ☐ |
| AIP-07 | P2 | Pro özellik özetini ve örnek analizi ekle | Kullanıcı planın kapsamını, veri kapsamını ve örnek çıktı biçimini üyelikten önce görebilir. | ☐ |
| AIP-08 | P2 | Kaydedilebilir analiz ekle | Rapor, sembol, veri tarihi, model ve varsayımlarıyla kaydedilip yeniden açılabilir. | ☐ |
| AIP-09 | P2 | Finansal AI yanıtları için değerlendirme seti kur | Kaynak kesintisi, çelişkili veri, yanlış sembol ve belirsiz haber senaryoları düzenli test edilir. | ☐ |

## 10. Quant Lab

| Kimlik | Öncelik | Görev | Tamamlanma ölçütü | Durum |
|---|---|---|---|---|
| QNT-01 | P0 | Monte Carlo koşu sayısını motordan göster | Tüm ekran ve tanıtım metinlerindeki sayı çalıştırılan örnek sayısıyla aynıdır. | ◐ |
| QNT-02 | P0 | Örnek profil ile kaynaklı finansal profili ayır | Kullanıcı her analizde profil türünü ve varsa finansal veri dönemini ekranın başında görür. | ◐ |
| QNT-03 | P0 | Sabit stres sonuçlarını kaldır | Her sonuç seçilen şok ve açık varsayımlardan hesaplanır. Girdi yoksa örnek senaryo olarak işaretlenir. | ◐ |
| QNT-04 | P1 | Komite analizini kullanıcı eylemine bağla | Ekrana girilince analiz çağrısı başlamaz. Analiz düğmesi, iptal ve yeniden deneme net görünür. | ☐ |
| QNT-05 | P1 | DCF’de girdi ve para birimi tutarlılığını doğrula | Bilanço birimi, işlem fiyatı ve değerleme sonucu aynı para biriminde gösterilir. | ☐ |
| QNT-06 | P1 | DCF geçersiz varsayımlarını ele al | AOMM terminal büyümesinden düşük veya eşitse sonuç, düzeltilmiş açık varsayımla veya doğrulama hatasıyla gösterilir. | ☐ |
| QNT-07 | P2 | DCF’yi dönemsel nakit akışına bağla | Kullanıcı FCF, net borç ve pay adedi girdilerinin dönemini ve kaynağını görebilir. | ☐ |
| QNT-08 | P2 | Sağlık skorlarını doğrulanmış finansallardan üret | Piotroski, Altman ve DuPont çıktıları kullanılan kalemleri, dönemleri ve eksik girdileri gösterir. | ☐ |
| QNT-09 | P2 | Tekrarlanabilir Monte Carlo senaryoları ekle | Vade, oynaklık, drift, koşu sayısı ve rastgelelik tohumu kaydedilir. Aynı girdiler aynı sonucu üretir. | ☐ |
| QNT-10 | P2 | Portföy bazında stres testi ekle | Seçilen kur, faiz veya piyasa şoku portföy pozisyonlarına uygulanır. Varsayımlar ve katkılar gösterilir. | ☐ |
| QNT-11 | P2 | Senaryoları yan yana karşılaştır | Kullanıcı baz, iyimser ve olumsuz senaryonun girdi ve sonuçlarını aynı tabloda görebilir. | ☐ |
| QNT-12 | P2 | AI komite çıktısını kanıta bağla | Kullanılan finansal ve piyasa verileri ile varsayımlar ayrı gösterilir. Veri eksikliği örnek sonuçla açıkça ayrılır. | ☐ |

## 11. Hesap, gizlilik, tanıtım ve widget

| Kimlik | Öncelik | Görev | Tamamlanma ölçütü | Durum |
|---|---|---|---|---|
| HSP-01 | P1 | Tutar gizlemeyi uygulama geneline yay | Etkin olduğunda ana ekran, portföy, ısı haritası, rapor ve widget önizlemesinde tutarlar maskelenir. | ☐ |
| HSP-02 | P1 | Hesap ve misafir veri sınırını doğrula | Hesap değişimi, misafir modu ve çıkış sonrası diğer oturumun portföyü, bildirimleri veya AI geçmişi görünmez. | ☐ |
| HSP-03 | P1 | Giriş, kayıt ve şifre sıfırlamayı uçtan uca test et | Doğrulama, süresi dolan bağlantı ve başarısız oturum senaryoları kullanıcıya açık durum gösterir. | ☐ |
| HSP-04 | P1 | Widget örnek verisini belirgin etiketle | Demo widget üzerinde Örnek Veri görünür. Kişisel widget kendi veri ve gizlilik durumunu gösterir. | ☐ |
| HSP-05 | P1 | Widget paylaşım sınırlarını görünür yap | Gömme önizlemesi hangi verinin paylaşılacağını gösterir. Kişisel değerler için açık seçim gerekir. | ☐ |
| HSP-06 | P1 | Açılış sayfasındaki ürün vaatlerini doğrula | Varlık sayısı, kapsanan pazar, fiyat gecikmesi, dil ve özellik açıklamaları çalışan kapsamla eşleşir. | ☐ |
| HSP-07 | P1 | Demo girişini gerçek misafir akışına bağla | Demo düğmesinden örnek veriye kayıt formu doldurmadan ulaşılır. | ☐ |
| HSP-08 | P2 | Dil kapsamı kararını uygula | Türkçe ve İngilizce destek vaadi varsa temel akışlar her iki dilde tamamlanır. Desteklenen diller yardım ekranında yazılır. | ☐ |
| HSP-09 | P2 | Veri ve gizlilik yardımını görünür yap | Piyasa verisinin kaynağı, AI’ya giden veri, widget paylaşımı ve hesap tercihleri yardım ekranında açıklanır. | ☐ |

## 12. Android yayın, web performansı ve işletim

| Kimlik | Öncelik | Görev | Tamamlanma ölçütü | Durum |
|---|---|---|---|---|
| OPS-01 | P0 | Yeni imzalı Android APK’yı üret | Sürüm kodu artar. Paket ve uygulama sürüm uç noktası aynı sürümü gösterir. | ◐ |
| OPS-02 | P0 | Eski APK’dan güncellemeyi gerçek cihazda doğrula | Mevcut kurulum üzerine güncelleme tamamlanır. Oturum ve portföy kayıtları korunur. | ◐ |
| OPS-03 | P0 | APK dağıtımını ve geri alma yolunu doğrula | İndirme bağlantısı yeni imzalı dosyayı sunar. Sağlama toplamı, sürüm notu ve geri alma adımı kaydedilir. | ◐ |
| OPS-04 | P0 | Kritik veri kesintisi testlerini otomatikleştir | Fiyat, fon, haber veya kur sağlayıcısı kesilince beklenen arayüz durumu doğrulanır. | ◐ |
| OPS-05 | P1 | Alarm ve izleme için sembol bazlı sorgu ekle | Kontrol isteği yalnız aktif alarm veya takip sembollerini içerir. Tam piyasa listesinin yükü ortadan kalkar. | ☐ |
| OPS-06 | P1 | Piyasa tablolarını sayfalandır | Liste ilk açılışta sınırlı sonuç getirir. Arama, sıralama ve filtre sayfalar arasında tutarlı çalışır. | ☐ |
| OPS-07 | P1 | Excel kütüphanesini isteğe bağlı yükle | İlk portföy açılışında Excel parçası indirilmez. İçe veya dışa aktarmada yüklenir. | ☐ |
| OPS-08 | P1 | Gereksiz fiyat yenilemelerini azalt | Gizli sekme, kapalı piyasa ve geçersiz oturum durumlarında yenileme davranışı ölçülür ve uygun şekilde yavaşlatılır. | ☐ |
| OPS-09 | P1 | Mobil ve masaüstü performans ölçümünü kur | LCP, INP, CLS, ilk yük boyutu ve kritik API süreleri platform bazında raporlanır. | ☐ |
| OPS-10 | P1 | Kritik kullanıcı akışlarını otomatik test et | Misafir başlangıcı, işlem kaydı, dosya aktarımı, alarm kurma, haber kesintisi ve rapor üretimi sürüm öncesi çalışır. | ☐ |
| OPS-11 | P1 | Sağlayıcı ve görev durum panosu oluştur | Son başarılı fiyat/fon/haber alımı, bülten gecikmesi ve alarm hataları hassas bilgi taşımadan izlenir. | ☐ |
| OPS-12 | P1 | Kullanım ölçümlerini tanımla | İlk işlem tamamlama, başarılı içe aktarma, alarm kurma ve tekrar kullanım ölçülür. Özel portföy tutarları analitik olaylara girmez. | ☐ |
| OPS-13 | P2 | Lint uyarılarını etkisine göre azalt | Önce erişilebilirlik, React bağımlılıkları ve gerçek hata riski taşıyan uyarılar düşer. Toplam uyarı sayısı CI’da izlenir. | ☐ |
| OPS-14 | P2 | Piyasa ve portföy API’lerine yük testi yap | Tipik ve yoğun kullanımda yanıt süresi, hata oranı ve sağlayıcı çağrı sayısı ölçülür. | ☐ |
| OPS-15 | P3 | Resmî Android dağıtım kanalını değerlendir | Mağaza gereksinimleri, imza yönetimi, güncelleme ve destek maliyeti karşılaştırılır. | ☐ |

## İlk paketin doğrulaması

VER-01 ve FON-01 yerelde doğrulandı. Piyasa Nabzı ve Piyasalar özet kartlarında kaynak ile veri zamanı veya alınma zamanı gösteriliyor. Ana ekranda güncelleme kesilirse oturumda son alınan fiyat etiketlenerek korunuyor. Fon kataloğu fiyatı eksik olan 1.035 kaydı boş fiyatla döndürüyor. Son okuma 1.051 fon kaydından 16'sında eşitleme kaydı ve kullanılabilir fiyat olduğunu gösterdi. TEFAS kapsamını artırma, gerçek değerleme tarihini taşıma ve eski fiyatların alarm politikasını tanımlama işleri açık.

## TEFAS eşitleme teşhisi

FON-02 yerelde doğrulandı. Önceki [GitHub çalıştırması](https://github.com/kaanirmak/StockMind/actions/runs/42723579091/job/129523383165) Supabase bağlantı ayarları eksik olduğu için TEFAS sorgularından önce durdu. Zamanlanmış çalıştırmada NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SECRET_KEY veya SUPABASE_SERVICE_ROLE_KEY yapılandırılmalı. Yazma modu eksik ayarları değerleri göstermeden listeler.

Yerelde sağlayıcı sorgularını veritabanına erişmeden denemek için **npm run sync:funds -- --dry-run --code=TI2** kullan. Sonuç kaydı fon kodunu, uç noktayı, hata türünü, varsa HTTP durumunu ve toplamları gösterir. Seçim yapılmazsa teşhis modu üç fonla sınırlıdır.

FON-03 yerelde doğrulandı. Zamanlanmış görev fonları sekizli gruplar halinde işler ve İstanbul gününün başlangıcından beri pozitif fiyatla kaydedilen fonları atlar. Yarım kalan eşitlemeyi aynı gün yeniden çalıştırmak için GitHub Actions üzerinden `sync-funds` seç. Gece yarısından sonra `resume_date` alanına ilk çalıştırmanın İstanbul tarihini `YYYY-MM-DD` biçiminde gir. Yerelde aynı seçenekler `npm run sync:funds -- --resume` ve `--resume-date=YYYY-MM-DD` ile kullanılabilir. Çalıştırma özeti atlanan, tamamlanan ve kalan fon sayılarını gösterir. Her fon kendi koduyla güncellendiği için yeniden deneme mevcut fiyat kaydını çoğaltmaz.

FON-04 yerelde doğrulandı. TEFAS fiyat özeti tarih içermediğinde yalnızca geçmişteki son fiyatla birebir eşleşen değerleme tarihi kullanılır. Fon detayında alınma zamanı ayrıca görünür. Tarihi doğrulanamayan fiyatlarda değerleme tarihi boş kalır. `20261110201856_add_tefas_nav_date.sql` üretim Supabase veritabanına uygulandı ve alanın API üzerinden okunabildiği doğrulandı. Eski fiyatlar bir sonraki eşitlemede doğrulanan tarihi alabilir.

FON-05 yerelde doğrulandı. `tefas_sync_finished` kaydı ve GitHub Actions özeti seçili fonların fiyat kapsamını gösterir. Referans gün İstanbul'daki son hafta içi günüdür. Resmî tatiller hesaba katılmaz. Fiyatı olup değerleme tarihi doğrulanamayanlar ayrı sayılır. Başarısız denemeler ayrıca sayıldığı için eski fiyatı korunan bir fon hem eski hem başarısız sayısına girebilir. Teşhis modu yalnızca sağlayıcıdan dönen seçili fonları sayar. Veritabanı kapsamı okunamazsa kapsam bilinmiyor olarak gösterilir.

## İlk uygulama sırası

1. **Veri ve güven.** VER-01–07 ve FON-01–05. Fiyat durumu güvenilir hale gelmeden fon karşılaştırması ve sunucu alarmı aynı veri üstünde devreye girmez.
2. **Teslimat ve model doğruluğu.** QNT-01–03, AIP-01, EPO-01–05, ALR-01–03 ve OPS-01–04. Canlı teslimat, eski APK’dan güncelleme ve örnek/gerçek veri ayrımı burada doğrulanır.
3. **Günlük kullanım.** UX, POR-01–08, PIY-01–05, HBR-01–07 ve alarm merkezi. İlk ekran, ilk işlem, takip ve hata durumları birlikte iyileştirilir.
4. **Araştırma ve Pro.** Fon karşılaştırma, kaydedilebilir tarama, kaynaklı finansallar, olay takvimi, getiri katkısı ve kaynaklı Quant Lab. KAP entegrasyonu HBR-08 tamamlanınca başlar.
5. **İleri bağlantılar.** Aracı kurum eşitleme, gösterge alarmları ve resmî dağıtım kanalı için kullanım ihtiyacı ve maliyet doğrulanır.

## Kaynaklar

- [StockMind](https://stockmind.kaanrmak7.workers.dev/) · [Haber akışı notları](news-reliability.md)
- [Fintables](https://fintables.com/) · [Midas fiyat alarmları](https://www.getmidas.com/destek/midas-ile-yatirima-baslarken/midas-ile-neler-yapabilirim/hisseler-icin-nasil-fiyat-alarmi-kurabilirsin) · [TradingView tarayıcı](https://www.tradingview.com/support/solutions/43000718885-tradingview-screeners-walkthrough/)
- [Investing.com takvim](https://www.investing.com/economic-calendar) · [InvestingPro](https://www.investing.com/pro/) · [Delta](https://delta.app/en/features) · [getquin](https://www.getquin.com/) · [Koyfin](https://www.koyfin.com/help/release-notes/attribution-in-model-portfolios/)
- [KAP](https://www.kap.org.tr/) · [Borsa İstanbul veri dağıtımı](https://borsaistanbul.com/sss/veri-dagitim-ve-endeks-lisanslama) · [WCAG 2.2](https://www.w3.org/TR/WCAG22/) · [Web Vitals](https://web.dev/articles/vitals)
