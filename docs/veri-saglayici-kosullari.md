# Veri Sağlayıcı Koşulları ve Kapsam Matrisi

Bu belge, StockMind uygulamasında kullanılan her bir harici veri ve yorum sağlayıcısı için **kapsanan pazarlar**, **gecikme profili**, **gösterim/atıf koşulları** ve **yeniden dağıtım (redistribution) kısıtlarını** kayıt altına alır.  
Uygulama içi programatik eşlenik: [`src/lib/market/providerPolicies.ts`](../src/lib/market/providerPolicies.ts)

## Özet Sağlayıcı Tablosu

| Sağlayıcı ID | Sağlayıcı Adı | Kapsanan Pazarlar | Gecikme Sınıfı | Gecikme / Tazelik Koşulu | Gösterim Koşulu | Yeniden Dağıtım (Redistribution) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `tradingview` | TradingView Scanner | `BIST`, `NASDAQ`, `NYSE`, `CRYPTO`, `FOREX`, `COMMODITY` | `intraday-delayed` | Seans içi kısa gecikmeli veya son kapanış verisi (resmî canlı BIST/NASDAQ lisanslı terminal değildir) | Kaynak (`TradingView`), gözlem zamanı (`asOf`), seans durumu ve tazelik etiketi gösterilir | Ham feed olarak üçüncü taraflara API veya toplu dağıtımı ve satışı yasaktır |
| `yahoo-finance` | Yahoo Finance | `BIST`, `NASDAQ`, `NYSE`, `INDEX`, `FOREX`, `COMMODITY` | `intraday-delayed` | Borsa kurallarına bağlı 15–20 dk gecikmeli veya son kapanış / tarihsel bar verisi | Grafik aralığı, kısmi/güncel bar kapsamı ve `Yahoo Finance` kaynağı gösterilir | Yalnızca uygulama içi görselleştirme kapsamındadır; harici yeniden dağıtım yasaktır |
| `tefas` | TEFAS / Takasbank | `TEFAS` | `end-of-day` | Gün sonu resmî değerleme (`NAV`); tatil ve hafta sonlarında son iş günü verisi | `TL/pay` birimi, değerleme tarihi (`asOf`) ve resmî KAP fon bağlantısı gösterilir | İçerik değiştirilmeden ve kaynak atfıyla gösterilir; ücretli feed olarak satılamaz |
| `rss-news` | Yayıncı RSS & KAP Bağlantıları | `BIST`, `MACRO`, `GLOBAL` | `feed-periodic` | Yayıncı RSS yayın sıklığı ve önbellek tazeleme döngüsüne bağlı | Yayıncı adı ve yayın saati gösterilir; yayıncı haberi asla resmî KAP bildirimi gibi sunulmaz | Yalnızca başlık, kısa özet ve orijinal link verilir; tam metin yeniden dağıtılmaz |
| `kap` | Kamuyu Aydınlatma Platformu (KAP) | `BIST`, `TEFAS` | `feed-periodic` | Resmî KAP API veya doğrudan `kap.org.tr` bağlantısı; canlı fiyat verisi değildir ve önbellek gecikmesi içerebilir | Kaynak kimliği (`KAP`), yayın saati, şirket/sembol ve doğrudan `kap.org.tr` belge linki gösterilir; yayıncı haberi KAP sayılmaz | Tam metin ve ek PDF'ler yeniden dağıtılmaz; yalnızca doğrulanmış özet ve orijinal link sunulur |
| `openrouter` | OpenRouter AI Gateway | `AI-COMMENTARY` | `on-demand-ai` | İstek anında metin üretimi; **canlı fiyat sağlayıcısı değildir** | Doğrulanmış uygulama verisine dayanır; eksik fiyat durumunda tahmin üretmez, yatırım tavsiyesi değildir | Kullanıcı oturumuna özel çıktıdır; seçili model sağlayıcı şartlarına tabidir |

---

## Sağlayıcı Bazlı Detaylar

### 1. TradingView Scanner (`tradingview`)
- **Kapsanan Pazarlar ve Enstrümanlar:** BIST pay senetleri ve BYF/ETF'ler, ABD (`NASDAQ`/`NYSE`) hisseleri ve ETF'leri, kripto para pariteleri, döviz kurları (`USD/TRY`, `EUR/TRY`, `EUR/USD`) ve CFD emtia göstergeleri (`GA`, `XAU`, `XAG`).
- **Gecikme Beklentisi:** Seans açıkken gecikmeli/kısa aralıklı kotasyon, seans dışı ve resmî tatillerde son doğrulanan kapanış fiyatı.
- **Gösterim Koşulları:** [`src/lib/market/priceStatus.ts`](../src/lib/market/priceStatus.ts) ve [`src/lib/market/marketSession.ts`](../src/lib/market/marketSession.ts) üzerinden `Canlı`, `Gecikmeli`, `Son kapanış` veya `Eski` etiketi ve kaynak adı ile birlikte gösterilir.
- **Yeniden Dağıtım Kısıtı:** Uygulama dışı toplu aktarım, ticari veri feed'i veya alt lisanslama kapsamı dışındadır.
- **Hata/Kesinti Davranışı:** Yanıt alınamadığında yalnızca kısa süre önce doğrulanan kayıt gösterilir ve `Son bilinen` uyarısı verilir; sahte fiyat üretilmez.

### 2. Yahoo Finance (`yahoo-finance`)
- **Kapsanan Pazarlar ve Enstrümanlar:** Endeksler (`XU100`, `SPX`, `NDX`), tarihsel OHLCV mum serileri (`1h`, `1d`, `1wk`) ve döviz/emtia yedek kotasyonları.
- **Gecikme Beklentisi:** Genellikle 15–20 dakika gecikmeli piyasa kotasyonu veya gün/hafta bar kapanışı.
- **Gösterim Koşulları:** Grafik ekranlarında kapsam durumu (`Güncel bar`, `Kısmi veri` veya `Boşluklu`) ve `Yahoo Finance` kaynağı belirtilir.
- **Yeniden Dağıtım Kısıtı:** Yalnızca StockMind web ve mobil istemcisinde görselleştirme amacıyla kullanılır; ham tarihsel seriler üçüncü taraflara servis edilmez.

### 3. TEFAS / Takasbank (`tefas`)
- **Kapsanan Pazarlar ve Enstrümanlar:** Türkiye yatırım fonları (`TEFAS`), birim pay fiyatı (`TL/pay`), yönetim ücreti, risk skoru (1–7), portföy varlık dağılımı ve dönemsel getiri serileri.
- **Gecikme Beklentisi:** İş günleri gün sonu resmî değerleme döngüsü; resmî tatillerde ve hafta sonlarında son iş günü fiyatı gösterilir.
- **Gösterim Koşulları:** Fon detay ve liste sayfalarında kaynak (`TEFAS`), değerleme tarihi (`asOf`) ve resmî [KAP Fon Bilgileri](https://www.kap.org.tr) bağlantısı korunur; eksik veri alanları sıfır (`0`) gibi gösterilmez.
- **Yeniden Dağıtım Kısıtı:** Kamuya açık resmî fon verisidir; tahrif edilmeden atıfla sunulur, ticari veri akışı olarak yeniden satılamaz.

### 4. Yayıncı RSS & Resmî Bildirim Bağlantıları (`rss-news`)
- **Kapsanan Pazarlar ve Enstrümanlar:** Makroekonomi, BIST şirket haberleri ve küresel piyasa başlıkları (`TRT Haber Ekonomi`, `Investing.com TR`, `Avrupa Merkez Bankası / ECB`) ile `KAP` genel bilgi bağlantıları.
- **Gecikme Beklentisi:** İlgili yayıncının RSS akış yenileme süresi ve sunucu anlık yedekleme aralığına bağlıdır.
- **Gösterim Koşulları:** Her içerik yayıncı adı, zaman damgası ve kaynak URL'si ile sunulur. Yayıncı haberleri asla resmî KAP özel durum açıklaması gibi etiketlenmez.
- **Yeniden Dağıtım Kısıtı:** Yalnızca başlık ve kısa özet indekslenir; tam makale metni barındırılmaz ve yeniden dağıtılmaz.

### 5. OpenRouter AI Gateway (`openrouter`)
- **Kapsanan Pazarlar ve Enstrümanlar:** Sohbet asistanı ve Yatırım Komitesi (Pro) çoklu perspektif özetleri.
- **Gecikme Beklentisi:** İstek bazlı model yanıtı; zaman aşımı ve kota korumasına tabidir. **Piyasa fiyatı veya fon verisi kaynağı değildir.**
- **Gösterim Koşulları:** Yapay zekâ yorumu yalnızca sunucudan doğrulanan mevcut fiyat ve fon verileriyle beslenir; eksik alanlarda kullanıcıya veri eksikliği açıkça bildirilir.
- **Yeniden Dağıtım Kısıtı:** Çıktılar yalnızca ilgili oturum kullanıcısına sunulur ve seçili model sağlayıcılarının kullanım koşullarına tabidir.

### 6. Kamuyu Aydınlatma Platformu (`kap`)
- **İzinli Veri Kaynağı ve Erişim Modeli:** Yalnızca resmî KAP veri dağıtım/API kanalı veya doğrulanmış `kap.org.tr` bildirim bağlantıları kullanılır. Yetkisiz sayfa kazıma (scraping) ile sahte gerçek zamanlı KAP iddiasında bulunulmaz.
- **Kapsam:** Özel Durum Açıklamaları (ÖDA), periyodik finansal tablolar ve faaliyet raporları, temettü/sermaye artırımı/genel kurul bildirimleri ile TEFAS fon KAP sayfaları.
- **Gecikme Beklentisi:** Kaynak yayınlanma ve uygulama önbellek döngüsüne bağlı periyodik güncelleme (`feed-periodic`); canlı borsa emir/fiyat verisi değildir.
- **Gösterim Koşulları:** Her resmî açıklamada kaynak kimliği (`KAP`), orijinal yayın zamanı, ilgili şirket/sembol ve doğrudan `https://www.kap.org.tr/` belge bağlantısı görünür. Yayıncı RSS haberleri asla resmî KAP bildirimi gibi sunulmaz.
- **Yeniden Dağıtım Kısıtı:** Tam bildirim metinleri veya PDF ekleri barındırılıp toplu yeniden dağıtılmaz; yalnızca bildirim özeti ve resmî belge bağlantısı sunulur.
