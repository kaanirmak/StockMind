'use client';
import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
export function ConfirmAction({ title, description, onClose, onConfirm }: { title: string; description: string; onClose: () => void; onConfirm: () => Promise<boolean | void> }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return <Modal isOpen onClose={() => { if (!busy) onClose(); }} title={title}>
    <div className="space-y-4"><p className="text-sm text-text-secondary">{description}</p>
      {step === 2 && <p className="p-3 rounded-xl bg-danger/10 text-danger text-sm" role="alert">Son onay: Bu işlem geri alınamaz.</p>}
      {failed && <p role="alert" className="text-danger text-sm">İşlem tamamlanamadı. Tekrar deneyin.</p>}
      <div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={onClose}>Vazgeç</Button>
        <Button variant="destructive" isLoading={busy} onClick={async () => { if (step === 1) { setStep(2); return; } setBusy(true); try { const result = await onConfirm(); if (result === false) setFailed(true); else onClose(); } catch { setFailed(true); } finally { setBusy(false); } }}>{step === 1 ? 'Devam Et' : 'Kalıcı Olarak Sil'}</Button>
      </div>
    </div>
  </Modal>;
}
