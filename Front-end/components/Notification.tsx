import React, { useState, useEffect } from 'react';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';

interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-emerald-500/12 border-emerald-400/25 text-emerald-100' : 'bg-rose-500/12 border-rose-400/25 text-rose-100';
  const iconColor = type === 'success' ? 'text-emerald-300' : 'text-rose-300';
  const Icon = type === 'success' ? CheckCircleIcon : XCircleIcon;

  return (
    <div role="alert" className={`fixed right-5 top-5 z-50 flex items-center rounded-2xl border px-4 py-3 shadow-xl backdrop-blur transition-all duration-300 ${bgColor} ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'}`}>
      <div className={`mr-3 ${iconColor}`}>
        <Icon className="h-6 w-6" />
      </div>
      <span className="font-medium">{message}</span>
    </div>
  );
};

export default Notification;
