import { create } from 'zustand';
import { getFriendlyError } from '../utils/errorMessages';

export type FeedbackType = 'info' | 'warning' | 'error' | 'success';

export interface FeedbackPopupOptions {
  type?: FeedbackType;
  title: string;
  message: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export interface FeedbackToastOptions {
  type?: Exclude<FeedbackType, 'error'> | 'warning';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface FeedbackState {
  popup: (FeedbackPopupOptions & { id: number }) | null;
  toast: (FeedbackToastOptions & { id: number }) | null;
  showPopup: (options: FeedbackPopupOptions) => void;
  hidePopup: () => void;
  showToast: (options: FeedbackToastOptions) => void;
  hideToast: () => void;
  showFriendlyError: (
    err: unknown,
    options?: {
      context?: 'login' | 'register' | 'location' | 'checkout' | 'general';
      title?: string;
      primaryLabel?: string;
      onPrimary?: () => void;
      secondaryLabel?: string;
      onSecondary?: () => void;
    }
  ) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let counter = 1;

export const useFeedbackStore = create<FeedbackState>((set) => ({
  popup: null,
  toast: null,

  showPopup: (options) => {
    set({
      popup: {
        ...options,
        id: ++counter,
      },
    });
  },

  hidePopup: () => set({ popup: null }),

  showToast: (options) => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    const toastId = ++counter;
    set({
      toast: {
        ...options,
        id: toastId,
      },
    });
    const duration = options.durationMs ?? 3800;
    if (duration > 0) {
      toastTimer = setTimeout(() => {
        set((state) => (state.toast?.id === toastId ? { toast: null } : state));
      }, duration);
    }
  },

  hideToast: () => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    set({ toast: null });
  },

  showFriendlyError: (err, options) => {
    const parsed = getFriendlyError(err, options?.context);
    set({
      popup: {
        id: ++counter,
        type: parsed.kind === 'location' ? 'warning' : 'error',
        title: options?.title || parsed.title,
        message: parsed.message,
        primaryLabel: options?.primaryLabel || 'OK',
        onPrimary: options?.onPrimary,
        secondaryLabel: options?.secondaryLabel,
        onSecondary: options?.onSecondary,
      },
    });
  },
}));
