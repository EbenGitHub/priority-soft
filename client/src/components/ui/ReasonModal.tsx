"use client";

import React, { useEffect, useState } from 'react';
import ModalShell from './ModalShell';

export default function ReasonModal({
  title,
  subtitle,
  label,
  placeholder,
  submitLabel,
  initialValue = '',
  required = false,
  loading = false,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle?: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  initialValue?: string;
  required?: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <ModalShell title={title} subtitle={subtitle} onClose={onClose}>
      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</label>
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            rows={5}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-white outline-none transition focus:border-blue-500"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(value)}
            disabled={loading || (required && !value.trim())}
            className="rounded-xl border border-blue-500 bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {loading ? 'Saving...' : submitLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
