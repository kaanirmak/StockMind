'use client';

import React from 'react';
import { Modal, Button } from '@/components/ui';

export interface LegalDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegalDisclaimerModal: React.FC<LegalDisclaimerModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Piyasa Verileri ve Yasal Uyarı"
      size="md"
    >
      <div className="space-y-4 text-xs sm:text-sm text-text-secondary leading-relaxed">
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5">
          <p className="font-bold text-amber-400 flex items-center gap-1.5">
            <span>⚖️</span>
            <span>SPK Mevzuatı Uyarınca Yasal Uyarı</span>
          </p>
          <p className="text-xs text-text-secondary">
            Burada yer alan yatırım bilgi, yorum ve tavsiyeleri yatırım danışmanlığı kapsamında değildir.
            Yatırım danışmanlığı hizmeti; aracı kurumlar, portföy yönetim şirketleri, mevduat kabul etmeyen bankalar
            ile müşteri arasında imzalanacak yatırım danışmanlığı sözleşmesi çerçevesinde sunulmaktadır.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold text-text-primary text-xs uppercase tracking-wider">Veri Kaynakları ve Güncellik</h4>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><strong className="text-text-primary">Borsa İstanbul (BIST):</strong> Pay senedi ve endeks verileri en az 15 dakika gecikmeli olarak sağlanır.</li>
            <li><strong className="text-text-primary">TEFAS Fonları:</strong> Fon pay fiyatları Takasbank tarafından yayımlanan gün sonu resmî takas değerleridir.</li>
            <li><strong className="text-text-primary">Döviz ve Emtialar:</strong> Serbest piyasa ve uluslararası tezgah üstü piyasa kotasyonları üzerinden hesaplanır.</li>
            <li><strong className="text-text-primary">Yapay Zeka & Quant:</strong> Monte Carlo simülasyonları, DCF indirgenmiş nakit akımı modelleri ve AI asistan yanıtları algoritmik projeksiyonlardır; kesin getiri garantisi oluşturmaz.</li>
          </ul>
        </div>

        <p className="text-xs text-text-muted">
          Bu sayfada veya StockMind platformunun herhangi bir bölümünde yer alan görüşler mali durumunuz ile risk ve getiri tercihlerinize uygun olmayabilir. Bu nedenle, sadece burada yer alan bilgilere dayanılarak yatırım kararı verilmesi beklentilerinize uygun sonuçlar doğurmayabilir.
        </p>

        <div className="flex justify-end pt-2 border-t border-border/60">
          <Button variant="primary" size="sm" onClick={onClose}>
            Anladım
          </Button>
        </div>
      </div>
    </Modal>
  );
};
