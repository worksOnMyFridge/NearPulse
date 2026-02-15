import { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

export default function Toast({ message, onClose, duration = 2000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className="glass-card rounded-xl px-4 py-3 shadow-lg border-green-500/30 flex items-center gap-3 min-w-[200px]">
        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
        <span className="text-primary font-medium text-sm flex-1">{message}</span>
        <button
          onClick={onClose}
          className="text-secondary hover:text-primary transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
