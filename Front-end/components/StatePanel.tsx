import React from 'react';

interface StatePanelProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

const StatePanel: React.FC<StatePanelProps> = ({ title, description, actionLabel, onAction }) => {
  return (
    <div className="rounded-[28px] border border-dashed border-white/10 bg-slate-900/40 px-6 py-8 text-center">
      <h3 className="text-lg font-bold text-slate-50">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          className="button-secondary mx-auto mt-5 justify-center"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
};

export default StatePanel;
