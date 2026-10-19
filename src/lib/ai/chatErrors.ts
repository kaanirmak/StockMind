export function chatErrorMessage(status: number, body: { code?: string; error?: string }): string {
  if (body.code === 'HOURLY_QUOTA_EXCEEDED') return body.error || 'Saatlik soru sınırına ulaştınız. Lütfen bir sonraki saati bekleyin veya Pro hesaba yükseltin.';
  if (body.code === 'AUTH_REQUIRED') return 'Oturumunuz doğrulanamadı. Tekrar giriş yapıp mesajınızı yeniden gönderin.';
  if (body.code === 'AI_KEY_REQUIRED') return 'AI anahtarı tanımlı değil. Ayarlar > AI bölümünden OpenRouter anahtarınızı ekleyin.';
  if (body.code === 'AI_PROVIDER_UNAUTHORIZED') return 'OpenRouter anahtarı reddedildi. Ayarlar > AI bölümündeki anahtarı kontrol edin.';
  if (body.code === 'AI_PROVIDER_FORBIDDEN') return 'Sağlayıcı isteği engelledi. Başka bir model seçin veya OpenRouter gizlilik ayarlarınızı kontrol edin.';
  if (body.code === 'AI_CREDITS_REQUIRED') return 'Seçilen model için OpenRouter kredisi yetersiz. Ücretsiz modeli seçin veya bakiyenizi kontrol edin.';
  if (body.code === 'FORBIDDEN_ORIGIN') return 'İstek adresi doğrulanamadı. Sayfayı uygulamanın kendi adresinden yeniden açın.';
  if (body.code === 'AI_TIMEOUT') return 'AI servisi zamanında yanıt vermedi. Biraz sonra tekrar deneyin.';
  if (body.code === 'AI_RATE_LIMITED') return 'Seçili modelin sağlayıcı sınırına ulaşıldı. Bu, StockMind soru kotanızdan farklıdır. Otomatik ücretsiz veya başka bir model seçip yeniden deneyin.';
  if (status === 429) return body.error || 'İstek sınırına ulaşıldı. Biraz bekleyip tekrar deneyin.';
  if (status === 401) return body.error || 'Oturumunuz doğrulanamadı. Tekrar giriş yapın.';
  return body.error || 'AI şu anda yanıt veremiyor. Lütfen tekrar deneyin.';
}
