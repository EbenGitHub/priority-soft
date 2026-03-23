"use client";

import { Toaster } from 'sonner';

export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        className: 'font-sans',
        style: {
          background: '#020617',
          border: '1px solid #334155',
          color: '#e2e8f0',
        },
      }}
    />
  );
}
