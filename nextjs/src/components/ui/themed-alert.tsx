'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Themed alerts (2026-11-11) ────────────────────────────────────────────
// Replaces every native window.alert() / prompt() in the app. The old
// browser dialogs ("localhost:8080 says …") broke the Mentorly look; these
// are the same light theme as the rest of the site: white card, one sans
// font, hairline border, black pill button. Two pieces:
//
//   <ThemedAlert />   — controlled modal: title + message + OK button.
//   <ThemedPrompt />  — controlled modal with a textarea: asks for a reason
//                       (used where prompt() used to collect one) and
//                       resolves with the text, or null on cancel.
//   <ThemedConfirm /> — controlled modal: yes/no question with Cancel +
//                       confirm buttons (replaces native confirm()).
//
//   useThemedDialogs() — hook for a page: showAlert(message, opts) fires
//   the modal; showPrompt(opts) returns a Promise<string | null>;
//   showConfirm(opts) returns a Promise<boolean>; render the returned
//   `dialogs` node once near the page root.
//
// Tones: success (emerald check), error (red alert), info (neutral).

export type ThemedAlertTone = 'success' | 'error' | 'info';

const TONE_ICON = {
  success: { Icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-50' },
  error: { Icon: AlertCircle, className: 'text-red-600 bg-red-50' },
  info: { Icon: Info, className: 'text-neutral-700 bg-neutral-100' },
} as const;

function DialogShell({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Focus the card so keyboard users land inside the dialog.
    cardRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={cardRef}
        tabIndex={-1}
        className="relative w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl outline-none"
      >
        {children}
      </div>
    </div>
  );
}

export function ThemedAlert({
  open,
  title,
  message,
  tone = 'info',
  actionLabel = 'OK',
  onClose,
}: {
  open: boolean;
  title?: string;
  message: string;
  tone?: ThemedAlertTone;
  actionLabel?: string;
  onClose: () => void;
}) {
  const { Icon, className } = TONE_ICON[tone];
  return (
    <DialogShell open={open} onClose={onClose} labelledBy={title ? 'themed-alert-title' : undefined}>
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${className}`} aria-hidden="true">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          {title && (
            <h2 id="themed-alert-title" className="text-base font-bold text-neutral-900">
              {title}
            </h2>
          )}
          <p className={`text-sm leading-relaxed text-neutral-600 ${title ? 'mt-1' : ''}`}>{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={onClose} className="rounded-full bg-neutral-900 px-6 text-white hover:bg-neutral-800">
          {actionLabel}
        </Button>
      </div>
    </DialogShell>
  );
}

export function ThemedConfirm({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive action: the confirm button renders red instead of black. */
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { Icon, className } = TONE_ICON[danger ? 'error' : 'info'];
  return (
    <DialogShell open={open} onClose={onClose} labelledBy="themed-confirm-title">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${className}`} aria-hidden="true">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="themed-confirm-title" className="text-base font-bold text-neutral-900">
            {title}
          </h2>
          {message && <p className="mt-1 text-sm leading-relaxed text-neutral-600">{message}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={onClose}
          className="rounded-full border-neutral-300 bg-white px-5 text-neutral-900 hover:bg-neutral-100"
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          className={
            danger
              ? 'rounded-full bg-red-600 px-6 text-white hover:bg-red-700'
              : 'rounded-full bg-neutral-900 px-6 text-white hover:bg-neutral-800'
          }
        >
          {confirmLabel}
        </Button>
      </div>
    </DialogShell>
  );
}

export function ThemedPrompt({
  open,
  title,
  message,
  placeholder,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fresh empty field every time the dialog opens.
  useEffect(() => {
    if (open) {
      setValue('');
      // Focus after the card mounts.
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open ]);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }, [value, onSubmit]);

  return (
    <DialogShell open={open} onClose={onClose} labelledBy="themed-prompt-title">
      <h2 id="themed-prompt-title" className="text-base font-bold text-neutral-900">
        {title}
      </h2>
      {message && <p className="mt-1 text-sm leading-relaxed text-neutral-600">{message}</p>}
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="mt-4 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20"
      />
      <div className="mt-5 flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={onClose}
          className="rounded-full border-neutral-300 bg-white px-5 text-neutral-900 hover:bg-neutral-100"
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={submit}
          disabled={!value.trim()}
          className="rounded-full bg-neutral-900 px-6 text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {submitLabel}
        </Button>
      </div>
    </DialogShell>
  );
}

export interface ShowAlertOptions {
  title?: string;
  tone?: ThemedAlertTone;
  actionLabel?: string;
}

export interface ShowPromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  submitLabel?: string;
}

export interface ShowConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

/**
 * Page-level hook. `showAlert` fires the modal; `showPrompt` asks for a
 * line of text and resolves with it (or null when the user cancels, which
 * mirrors the old prompt() returning null); `showConfirm` asks a yes/no
 * question and resolves true only when the user confirms (Escape,
 * backdrop, and Cancel all resolve false). Render `dialogs` once near
 * the page root.
 */
export function useThemedDialogs() {
  const [alertState, setAlertState] = useState<(ShowAlertOptions & { message: string }) | null>(null);
  const [promptState, setPromptState] = useState<ShowPromptOptions | null>(null);
  const promptResolveRef = useRef<((value: string | null) => void) | null>(null);
  const [confirmState, setConfirmState] = useState<ShowConfirmOptions | null>(null);
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  const showAlert = useCallback((message: string, opts?: ShowAlertOptions) => {
    setAlertState({ message, title: opts?.title, tone: opts?.tone ?? 'info', actionLabel: opts?.actionLabel });
  }, []);

  const showPrompt = useCallback((opts: ShowPromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      promptResolveRef.current = resolve;
      setPromptState(opts);
    });
  }, []);

  const closePrompt = useCallback((value: string | null) => {
    setPromptState(null);
    promptResolveRef.current?.(value);
    promptResolveRef.current = null;
  }, []);

  const showConfirm = useCallback((opts: ShowConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState(opts);
    });
  }, []);

  const closeConfirm = useCallback((value: boolean) => {
    setConfirmState(null);
    confirmResolveRef.current?.(value);
    confirmResolveRef.current = null;
  }, []);

  const dialogs = (
    <>
      <ThemedAlert
        open={alertState !== null}
        title={alertState?.title}
        message={alertState?.message ?? ''}
        tone={alertState?.tone ?? 'info'}
        actionLabel={alertState?.actionLabel}
        onClose={() => setAlertState(null)}
      />
      <ThemedPrompt
        open={promptState !== null}
        title={promptState?.title ?? ''}
        message={promptState?.message}
        placeholder={promptState?.placeholder}
        submitLabel={promptState?.submitLabel}
        onSubmit={(value) => closePrompt(value)}
        onClose={() => closePrompt(null)}
      />
      <ThemedConfirm
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={confirmState?.cancelLabel}
        danger={confirmState?.danger}
        onConfirm={() => closeConfirm(true)}
        onClose={() => closeConfirm(false)}
      />
    </>
  );

  return { showAlert, showPrompt, showConfirm, dialogs };
}
