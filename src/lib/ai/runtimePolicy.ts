/** Provider-independent defaults; deployments can tune these without selecting model names in code. */
function positiveSetting(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

export function getAIRuntimePolicy(env: Record<string, string | undefined> = process.env) {
  return {
    timeoutMs: positiveSetting(env.AI_PROVIDER_TIMEOUT_MS, 30_000, 120_000),
    chatMaxTokens: positiveSetting(env.AI_CHAT_MAX_TOKENS, 1500, 16000),
    committeeMaxTokens: positiveSetting(env.AI_COMMITTEE_MAX_TOKENS, 3500, 16000),
    briefWordTarget: positiveSetting(env.AI_CHAT_BRIEF_WORD_TARGET, 80, 500),
    briefByDefault: env.AI_CHAT_RESPONSE_STYLE !== 'standard',
    committeeModel: env.AI_COMMITTEE_MODEL?.trim(),
  };
}

export function briefChatInstructions(wordTarget: number) {
  return `Yanıtı telefonda rahat okunacak şekilde kısa tut: yaklaşık ${wordTarget} kelimeyi hedefle. Soruyu doğrudan yanıtla; tekrar eden giriş, sonuç, uzun başlıklar ve tablolar ekleme. Kullanıcının belirttiği uzunluk ve biçim tercihi bu varsayılandan önceliklidir; ayrıntı isterse gerekli ayrıntıyı ver. Eksik veriyi uydurma ve gerekli uyarıyı kısa tut.`;
}
