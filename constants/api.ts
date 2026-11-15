// API Configuration
// Supports switching between Render ('render') and Local ('local') purely via mobile-app/.env
const apiEnv = (process.env.EXPO_PUBLIC_API_ENV || 'render').trim().toLowerCase();
const renderBase = (
  process.env.EXPO_PUBLIC_RENDER_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://happy-deliveries-api-tq5y.onrender.com'
).trim();
const localBase = (
  process.env.EXPO_PUBLIC_LOCAL_URL ||
  'http://10.0.0.88:5000'
).trim();

const selectedBaseUrl = apiEnv === 'local' ? localBase : renderBase;

const normalizedApiBaseUrl = selectedBaseUrl.endsWith('/api')
  ? selectedBaseUrl
  : `${selectedBaseUrl.replace(/\/+$/, '')}/api`;
const normalizedServerBaseUrl = normalizedApiBaseUrl.replace(/\/api$/, '');

export const API_BASE_URL = normalizedApiBaseUrl;
export const SOCKET_URL =
  apiEnv === 'local'
    ? normalizedServerBaseUrl
    : (process.env.EXPO_PUBLIC_SOCKET_URL || normalizedServerBaseUrl).replace(/\/+$/, '');

export const API_CONFIG = {
  ENV: apiEnv,
  BASE_URL: normalizedServerBaseUrl,
  API_BASE_URL: API_BASE_URL,
  API_URL: API_BASE_URL,
  SOCKET_URL: SOCKET_URL,

  // Endpoints
  ENDPOINTS: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    ME: '/auth/me',

    // Restaurants
    RESTAURANTS: '/restaurants',
    RESTAURANT_SEARCH: '/restaurants/search',
    RESTAURANT_DETAILS: (id: string) => `/restaurants/${id}`,
    RESTAURANT_MENUS: (id: string) => `/restaurants/${id}/menus`,
    MY_RESTAURANTS: '/restaurants/my/restaurants',

    // Menus
    CREATE_MENU: (restaurantId: string) => `/restaurants/${restaurantId}/menus`,
    ADD_MENU_ITEM: (restaurantId: string, menuId: string) =>
      `/restaurants/${restaurantId}/menus/${menuId}/items`,

    // Orders
    ORDERS: '/orders',
    ORDER_DETAILS: (id: string) => `/orders/${id}`,
    MY_ORDERS: '/orders/my',
    ACCEPT_ORDER: (id: string) => `/orders/${id}/accept`,
    DECLINE_ORDER: (id: string) => `/orders/${id}/decline`,
    UPDATE_ORDER_STATUS: (id: string) => `/orders/${id}/status`,

    // Drivers
    DRIVER_LOCATION: '/drivers/location',
    DRIVER_STATUS: '/drivers/status',
    AVAILABLE_ORDERS: '/drivers/available-orders',
    DRIVER_EARNINGS: '/drivers/earnings',

    // Payments
    PROCESS_PAYMENT: '/payments/process',
    PAYMENT_DETAILS: (orderId: string) => `/payments/${orderId}`,
    MY_PAYMENTS: '/payments/my',

    // Users
    UPDATE_PROFILE: '/users/profile',
    UPDATE_ROLE_PROFILE: '/users/role-profile',

    // Notifications
    NOTIFICATIONS: '/notifications',
    MARK_NOTIFICATION_READ: (id: string) => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/mark-all-read',
  },

  // Timeouts
  TIMEOUTS: {
    DEFAULT: 20000,
    UPLOAD: 30000,
    SOCKET_RECONNECT: 5000,
  },

  // Headers
  HEADERS: {
    JSON: {
      'Content-Type': 'application/json',
    },
    FORM_DATA: {
      'Content-Type': 'multipart/form-data',
    },
  },
};

// For backward compatibility
export const API_URL = API_CONFIG.API_URL;
export const BASE_URL = API_CONFIG.BASE_URL;
