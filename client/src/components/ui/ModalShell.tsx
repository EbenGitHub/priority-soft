"use client";

import React from 'react';

export default function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  maxWidthClass = 'max-w-lg',
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-900 shadow-[0_0_50px_rgba(0,0,0,0.5)] ${maxWidthClass}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-800/50 p-6">
          <div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
            {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}
