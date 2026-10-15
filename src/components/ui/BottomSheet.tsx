'use client';
import { Modal, type ModalProps } from './Modal';
/** Uses the shared dialog focus trap and reference-counted scroll lock. */
export function BottomSheet(props: ModalProps) { return <Modal {...props} presentation="sheet" />; }
