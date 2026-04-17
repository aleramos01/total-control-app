import React from 'react';
import { useLanguage } from '../LanguageContext';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmButtonText: string;
  confirmButtonVariant?: 'danger' | 'primary';
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText,
  confirmButtonVariant = 'primary',
}) => {
  const { t } = useLanguage();

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const confirmButtonClasses = confirmButtonVariant === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-indigo-600 hover:bg-indigo-700';

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-dialog-title"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md rounded-[28px] border border-white/10 bg-slate-800 p-8 text-slate-100 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirmation-dialog-title" className="mb-4 text-2xl font-bold text-slate-50">{title}</h2>
        <p className="mb-6 text-slate-400">{message}</p>
        <div className="flex justify-end gap-4">
          <button type="button" onClick={onClose} className="button-secondary">{t('cancel')}</button>
          <button type="button" onClick={onConfirm} className={`rounded-2xl px-4 py-3 text-white transition ${confirmButtonClasses}`}>{confirmButtonText}</button>
        </div>
      </div>
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ConfirmationDialog;
