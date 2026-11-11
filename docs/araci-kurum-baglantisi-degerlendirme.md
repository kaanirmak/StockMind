# POR-15 — Salt Okunur Aracı Kurum Bağlantısı Değerlendirmesi

Bu belge, StockMind portföy takibi için **salt okunur (read-only)** aracı kurum ve saklama kurumu bağlantılarının teknik, hukuki, maliyet ve gizlilik çerçevesini özetler. Yapılandırılmış kayıt [`src/lib/portfolio/brokerConnectionPolicy.ts`](../src/lib/portfolio/brokerConnectionPolicy.ts) içinde kodlanmıştır.

## 1. Öncelikli Kurumlar ve Bağlantı Koşulları

| Öncelik | Kurum / Altyapı | Kapsam | Bağlantı Yöntemi | Aylık Tahmini Maliyet | Hazırlık Durumu |
|---:|---|---|---|---|---|
| 1 | **Midas** | BIST + ABD | Yapılandırılmış salt-okunur ekstre / JSON eşitlemesi (`POR-16`) | 0 TL (ekstre) / B2B anlaşmaya tabi | Prototipe hazır |
| 2 | **İş Yatırım / İş Bankası** | BIST + TEFAS | Açık Bankacılık / lisanslı toplayıcı veya ekstre içe aktarma | ~15–45 TL/aktif bağlantı (toplayıcı) veya 0 TL | Partner incelemesinde |
| 3 | **Garanti BBVA Yatırım** | BIST + TEFAS | Partner API (mTLS + OAuth) veya ekstre içe aktarma | ~15–45 TL/aktif bağlantı (toplayıcı) veya 0 TL | Partner incelemesinde |
| 4 | **MKK e-Yatırımcı / Takasbank** | Saklama bakiyeleri | Kullanıcının indirdiği salt-okunur rapor içe aktarma | 0 TL | Yalnızca manuel ekstre |
| 5 | **Interactive Brokers (IBKR)** | ABD / Küresel | Kullanıcının ürettiği salt-okunur **Flex Web Service** tokenı | 0 TL (resmî Flex API dahil) | Prototipe hazır |

## 2. İzin Politikası (Emir ve Transfer Yetkisi Yasaktır)

- **İzin Verilen Kapsamlar:** Yalnızca `positions:read`, `transactions:read`, `balances:read`.
- **Kesinlikle Yasaklı Kapsamlar:** `orders:write`, `transfers:write`, `margin:write`, `profile:write`.
- `validateReadOnlyBrokerScopes(...)` doğrulaması, beyaz liste dışındaki her yetki talebini (`orders:write` vb.) fail-closed şekilde reddeder.
- Aracı kurum kullanıcı şifresi veya işlem PIN'i hiçbir koşulda saklanmaz (screen-scraping yapılmaz).

## 3. Kullanıcı Veri Silme ve Bağlantıyı Kesme Akışı

Kullanıcı bağlı bir kurumu kaldırdığında `BROKER_DATA_DELETION_FLOW` dört adımda uygulanır:

1. **Erişim Yetkisini İptal Et (`revoke_token`):** Varsa salt-okunur Flex/OAuth jetonu kurumda ve şifreli kasada geçersiz kılınır.
2. **Eşitleme İzlerini Sil (`purge_sync_state`):** Harici bağlantı kaydı, tekilleştirme imzaları (`externalRef`) ve ham ekstre önbellekleri temizlenir.
3. **İşlemler İçin Kullanıcı Seçimi (`handle_transactions`):** İçe aktarılmış işlemler kullanıcının seçimine göre ya bağımsız yerel kayıt olarak bırakılır ya da portföyden topluca silinir.
4. **Doğrulama (`audit_confirmation`):** Kesme zaman damgası kullanıcıya bildirilir ve arka plan eşitlemesi kalıcı olarak durdurulur.
