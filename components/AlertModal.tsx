'use client';

import { Modal } from '@/components/ui';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  title?: string;
}

export default function AlertModal({ isOpen, onClose, message, title = '알림' }: AlertModalProps) {
  return (
    <Modal open={isOpen} title={title} onClose={onClose}
      footer={<button onClick={onClose} className="btn btn-primary" autoFocus>확인</button>}>
      <p className="body">{message}</p>
    </Modal>
  );
}
