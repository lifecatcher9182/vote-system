'use client';

import { Modal } from '@/components/ui';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
}

export default function ConfirmModal({
  isOpen, onClose, onConfirm, message, title = '확인', confirmText = '확인', cancelText = '취소', variant = 'primary',
}: ConfirmModalProps) {
  return (
    <Modal open={isOpen} title={title} onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn btn-secondary">{cancelText}</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`} autoFocus>
            {confirmText}
          </button>
        </>
      }>
      <p className="body">{message}</p>
    </Modal>
  );
}
