export type ReadOnlyScope = 'positions:read' | 'transactions:read' | 'balances:read';

export type ForbiddenScope = 'orders:write' | 'transfers:write' | 'margin:write' | 'profile:write';

export type ConnectionMechanism =
  | 'statement_file_import'
  | 'flex_readonly_token'
  | 'open_finance_partner'
  | 'official_oauth_readonly';

export interface BrokerConnectionEvaluation {
  id: 'midas' | 'isbank' | 'garanti' | 'mkk_takasbank' | 'ibkr';
  brokerName: string;
  marketFocus: string;
  priorityRank: number;
  connectionMechanism: ConnectionMechanism;
  connectionTerms: string;
  estimatedMonthlyCostTryPerUser: string;
  allowedScopes: readonly ReadOnlyScope[];
  forbiddenScopes: readonly ForbiddenScope[];
  readOnlyEnforced: true;
  currentReadiness: 'prototype_ready' | 'partner_review' | 'manual_statement_only';
  notes: string;
}

export interface DeletionFlowStep {
  step: number;
  id: 'revoke_token' | 'purge_sync_state' | 'handle_transactions' | 'audit_confirmation';
  title: string;
  description: string;
}

export const ALLOWED_READ_ONLY_SCOPES: readonly ReadOnlyScope[] = [
  'positions:read',
  'transactions:read',
  'balances:read',
];

export const FORBIDDEN_TRADING_SCOPES: readonly ForbiddenScope[] = [
  'orders:write',
  'transfers:write',
  'margin:write',
  'profile:write',
];

export const READ_ONLY_BROKER_EVALUATIONS: readonly BrokerConnectionEvaluation[] = [
  {
    id: 'midas',
    brokerName: 'Midas',
    marketFocus: 'BIST + ABD Borsaları',
    priorityRank: 1,
    connectionMechanism: 'statement_file_import',
    connectionTerms:
      'Bireysel kullanıcılar için herkese açık resmî OAuth API bulunmuyor; mevcut ekstre/hesap özeti şeması üzerinden salt-okunur dosya ve yapılandırılmış JSON eşitlemesi uygulanabilir.',
    estimatedMonthlyCostTryPerUser: '0 TL (yerel ekstre ayrıştırma) / kurumsal Open Finance sözleşmesine tabi',
    allowedScopes: ALLOWED_READ_ONLY_SCOPES,
    forbiddenScopes: FORBIDDEN_TRADING_SCOPES,
    readOnlyEnforced: true,
    currentReadiness: 'prototype_ready',
    notes: 'En yüksek kullanıcı talebi olan kurum; POR-16 prototipi ilk bu kurum şemasıyla doğrulanır.',
  },
  {
    id: 'isbank',
    brokerName: 'İş Yatırım / İş Bankası',
    marketFocus: 'BIST + TEFAS',
    priorityRank: 2,
    connectionMechanism: 'open_finance_partner',
    connectionTerms:
      'Açık Bankacılık / TCMB Ödeme ve Menkul Kıymet altyapısı dışında bireysel yatırım API erişimi yalnızca lisanslı B2B anlaşmayla verilir.',
    estimatedMonthlyCostTryPerUser: 'Ortalama 15–45 TL/aktif bağlantı (lisanslı toplayıcı) veya 0 TL (ekstre yükleme)',
    allowedScopes: ALLOWED_READ_ONLY_SCOPES,
    forbiddenScopes: FORBIDDEN_TRADING_SCOPES,
    readOnlyEnforced: true,
    currentReadiness: 'partner_review',
    notes: 'Resmî B2B sözleşme ve SPK/BDDK kapsam değerlendirmesi tamamlanmadan canlı OAuth bağlanmaz.',
  },
  {
    id: 'garanti',
    brokerName: 'Garanti BBVA Yatırım',
    marketFocus: 'BIST + TEFAS',
    priorityRank: 3,
    connectionMechanism: 'open_finance_partner',
    connectionTerms:
      'Partner/Açık Bankacılık portalı üzerinden kurumsal onay ve mTLS istemci sertifikası gerektirir.',
    estimatedMonthlyCostTryPerUser: 'Ortalama 15–45 TL/aktif bağlantı (toplayıcı) veya 0 TL (ekstre yükleme)',
    allowedScopes: ALLOWED_READ_ONLY_SCOPES,
    forbiddenScopes: FORBIDDEN_TRADING_SCOPES,
    readOnlyEnforced: true,
    currentReadiness: 'partner_review',
    notes: 'CSV/XLSX hesap hareketleri şablonu mevcut içe aktarma motorunda desteklenir.',
  },
  {
    id: 'mkk_takasbank',
    brokerName: 'MKK e-Yatırımcı / Takasbank',
    marketFocus: 'Türkiye Saklama Bakiyeleri (BIST + TEFAS)',
    priorityRank: 4,
    connectionMechanism: 'statement_file_import',
    connectionTerms:
      'e-Yatırımcı bireysel girişe açıktır; üçüncü parti uygulamalar için genel amaçlı OAuth API sunulmaz.',
    estimatedMonthlyCostTryPerUser: '0 TL (kullanıcı tarafından indirilen salt-okunur rapor)',
    allowedScopes: ['positions:read', 'balances:read'],
    forbiddenScopes: FORBIDDEN_TRADING_SCOPES,
    readOnlyEnforced: true,
    currentReadiness: 'manual_statement_only',
    notes: 'Çoklu kurum bakiye doğrulaması için referans mutabakat kaynağı olarak kullanılabilir.',
  },
  {
    id: 'ibkr',
    brokerName: 'Interactive Brokers (IBKR)',
    marketFocus: 'ABD / Küresel Borsalar',
    priorityRank: 5,
    connectionMechanism: 'flex_readonly_token',
    connectionTerms:
      'Kullanıcının kendi ürettiği salt-okunur Flex Web Service tokenı ile yalnızca rapor XML/CSV çekilir; emir iletimi kesinlikle devre dışıdır.',
    estimatedMonthlyCostTryPerUser: '0 TL (resmî Flex Query API dahil)',
    allowedScopes: ALLOWED_READ_ONLY_SCOPES,
    forbiddenScopes: FORBIDDEN_TRADING_SCOPES,
    readOnlyEnforced: true,
    currentReadiness: 'prototype_ready',
    notes: 'Küresel hesaplar için teknik olarak emir yetkisi olmayan en temiz resmî salt-okunur arayüz.',
  },
];

export const BROKER_DATA_DELETION_FLOW: readonly DeletionFlowStep[] = [
  {
    step: 1,
    id: 'revoke_token',
    title: 'Erişim Yetkisini / Tokenı İptal Et',
    description:
      'Varsa Flex/OAuth erişim jetonu kurum tarafında ve StockMind şifreli kasasında anında geçersiz kılınır; şifre veya trading PIN asla saklanmaz.',
  },
  {
    step: 2,
    id: 'purge_sync_state',
    title: 'Eşitleme İzlerini ve Ham Ekstre Önbelleğini Sil',
    description:
      'Harici kurum bağlantı kaydı, son senkronizasyon imzaları (`externalRef`) ve geçici ekstre yüklemeleri kalıcı olarak temizlenir.',
  },
  {
    step: 3,
    id: 'handle_transactions',
    title: 'İçe Aktarılmış İşlemler İçin Kullanıcı Seçimi Uygula',
    description:
      'Kullanıcı isterse kurum kaynaklı işlemleri portföyde bağımsız manuel kayıt olarak tutar veya tümünü tek tıkla portföyden siler.',
  },
  {
    step: 4,
    id: 'audit_confirmation',
    title: 'Silme Zaman Damgası ve Doğrulama Bildir',
    description:
      'Bağlantı kesme işlemi tarih/saat bilgisiyle kullanıcıya doğrulanır ve gelecekte otomatik arka plan çekimi yapılmaz.',
  },
];

export function validateReadOnlyBrokerScopes(requestedScopes: readonly string[]): {
  accepted: boolean;
  allowedScopes: string[];
  rejectedScopes: string[];
  reason: string | null;
} {
  const allowedSet = new Set<string>(ALLOWED_READ_ONLY_SCOPES);
  const allowedScopes: string[] = [];
  const rejectedScopes: string[] = [];

  for (const rawScope of requestedScopes) {
    const scope = String(rawScope || '').trim();
    if (!scope) continue;
    if (allowedSet.has(scope)) {
      if (!allowedScopes.includes(scope)) allowedScopes.push(scope);
    } else if (!rejectedScopes.includes(scope)) {
      rejectedScopes.push(scope);
    }
  }

  if (rejectedScopes.length > 0) {
    return {
      accepted: false,
      allowedScopes,
      rejectedScopes,
      reason: `Salt okunur politika ihlali: yazma veya bilinmeyen izinler reddedildi (${rejectedScopes.join(', ')}).`,
    };
  }

  if (allowedScopes.length === 0) {
    return {
      accepted: false,
      allowedScopes: [],
      rejectedScopes: [],
      reason: 'En az bir salt-okunur kapsam (positions:read, transactions:read, balances:read) gereklidir.',
    };
  }

  return {
    accepted: true,
    allowedScopes,
    rejectedScopes: [],
    reason: null,
  };
}
