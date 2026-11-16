import { create } from 'zustand';

export type IncomingOrderAlert = {
  id: string;
  order_number: string;
  restaurant_name: string;
  restaurant_address: string;
  delivery_address: any;
  distance_to_restaurant?: number;
  time_left_seconds?: number;
  expiresAt?: number;
};

type DriverAlertState = {
  isOnline: boolean;
  statusLoaded: boolean;
  alertOrders: IncomingOrderAlert[];
  dismissedIds: Record<string, true>;
  setOnlineStatus: (online: boolean) => void;
  enqueueOrderAlert: (rawOrder: any) => void;
  syncAvailableOrders: (orders: any[]) => void;
  removeOrderAlert: (orderId: string, markDismissed?: boolean) => void;
  pruneExpiredAlerts: () => void;
  reset: () => void;
};

function normalizeIncomingOrder(raw: any): IncomingOrderAlert | null {
  if (!raw) return null;
  const order = raw.order && typeof raw.order === 'object' ? raw.order : raw;
  const id = String(raw.orderId || order.id || raw.id || '').trim();
  if (!id) return null;

  let expiresAt: number | undefined = undefined;
  if (raw.driver_acceptance_deadline || order.driver_acceptance_deadline) {
    const parsed = new Date(raw.driver_acceptance_deadline || order.driver_acceptance_deadline).getTime();
    if (Number.isFinite(parsed)) expiresAt = parsed;
  } else if (raw.time_left_seconds != null || order.time_left_seconds != null) {
    const secs = Number(raw.time_left_seconds ?? order.time_left_seconds);
    if (Number.isFinite(secs) && secs > 0) {
      expiresAt = Date.now() + secs * 1000;
    }
  } else {
    expiresAt = Date.now() + 600 * 1000;
  }

  return {
    id,
    order_number: String(
      raw.order_number || order.order_number || `#${id.slice(0, 8).toUpperCase()}`
    ),
    restaurant_name: String(
      raw.restaurantName || raw.restaurant_name || order.restaurant_name || 'Restaurant'
    ),
    restaurant_address: String(
      raw.restaurantAddress || raw.restaurant_address || order.restaurant_address || ''
    ),
    delivery_address:
      raw.deliveryAddress || raw.delivery_address || order.delivery_address || '',
    distance_to_restaurant:
      order.distance_to_restaurant != null ? Number(order.distance_to_restaurant) : undefined,
    time_left_seconds:
      raw.time_left_seconds != null
        ? Number(raw.time_left_seconds)
        : order.time_left_seconds != null
          ? Number(order.time_left_seconds)
          : undefined,
    expiresAt,
  };
}

export const useDriverAlertStore = create<DriverAlertState>((set, get) => ({
  isOnline: false,
  statusLoaded: false,
  alertOrders: [],
  dismissedIds: {},

  setOnlineStatus: (online: boolean) =>
    set((state) => ({
      isOnline: online,
      statusLoaded: true,
      alertOrders: online ? state.alertOrders : [],
    })),

  enqueueOrderAlert: (rawOrder: any) => {
    const state = get();
    if (!state.isOnline) return;
    const normalized = normalizeIncomingOrder(rawOrder);
    if (!normalized) return;
    if (state.dismissedIds[normalized.id]) return;
    if (normalized.expiresAt && normalized.expiresAt <= Date.now()) return;

    const existingIdx = state.alertOrders.findIndex((o) => o.id === normalized.id);
    if (existingIdx >= 0) {
      const updated = [...state.alertOrders];
      updated[existingIdx] = { ...updated[existingIdx], ...normalized };
      set({ alertOrders: updated });
      return;
    }

    set({ alertOrders: [normalized, ...state.alertOrders] });
  },

  syncAvailableOrders: (orders: any[]) => {
    const state = get();
    const list = Array.isArray(orders) ? orders : [];
    const activeIds = new Set(list.map((o) => String(o.id || o.orderId || '')));

    if (!state.isOnline) {
      if (state.alertOrders.length > 0) {
        set({ alertOrders: [] });
      }
      return;
    }

    // Keep only orders still active on backend, and enqueue any unacknowledged available orders
    const nextAlerts: IncomingOrderAlert[] = [];
    const seen = new Set<string>();

    for (const existing of state.alertOrders) {
      if (activeIds.has(existing.id) && !state.dismissedIds[existing.id]) {
        const fresh = list.find((o) => String(o.id) === existing.id);
        nextAlerts.push(fresh ? normalizeIncomingOrder(fresh) || existing : existing);
        seen.add(existing.id);
      }
    }

    for (const raw of list) {
      const normalized = normalizeIncomingOrder(raw);
      if (!normalized || seen.has(normalized.id) || state.dismissedIds[normalized.id]) {
        continue;
      }
      if (normalized.expiresAt && normalized.expiresAt <= Date.now()) {
        continue;
      }
      nextAlerts.push(normalized);
      seen.add(normalized.id);
    }

    set({ alertOrders: nextAlerts });
  },

  removeOrderAlert: (orderId: string, markDismissed = false) => {
    if (!orderId) return;
    const id = String(orderId);
    set((state) => ({
      alertOrders: state.alertOrders.filter((o) => o.id !== id),
      dismissedIds: markDismissed
        ? { ...state.dismissedIds, [id]: true }
        : state.dismissedIds,
    }));
  },

  pruneExpiredAlerts: () => {
    const now = Date.now();
    const { alertOrders } = get();
    if (alertOrders.length === 0) return;
    const remaining = alertOrders.filter((o) => !o.expiresAt || o.expiresAt > now);
    if (remaining.length !== alertOrders.length) {
      set({ alertOrders: remaining });
    }
  },

  reset: () =>
    set({
      isOnline: false,
      statusLoaded: false,
      alertOrders: [],
      dismissedIds: {},
    }),
}));
