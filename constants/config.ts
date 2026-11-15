// App Configuration
export const APP_CONFIG = {
  // App Info
  APP_NAME: 'HappyDeliveries',
  APP_VERSION: '1.0.0',
  
  // Features
  FEATURES: {
    ENABLE_PUSH_NOTIFICATIONS: process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS === 'true',
    ENABLE_LOCATION_TRACKING: process.env.EXPO_PUBLIC_ENABLE_LOCATION_TRACKING === 'true',
    ENABLE_SOCIAL_LOGIN: false,
    ENABLE_BIOMETRIC_AUTH: false,
    ENABLE_DARK_MODE: true,
  },
  
  // Order Settings
  ORDER: {
    DRIVER_ACCEPTANCE_TIME: 150000, // 2.5 minutes in milliseconds
    DRIVER_DECLINE_AUTO_TIME: 150000, // 2.5 minutes
    ORDER_TIMEOUT: 300000, // 5 minutes for driver to reach restaurant
    MAX_ORDER_ITEMS: 50,
    MIN_ORDER_AMOUNT: 5.0, // Minimum order amount
    MAX_ORDER_AMOUNT: 500.0, // Maximum order amount
    TAX_RATE: 0.08, // 8% tax
    DEFAULT_DELIVERY_FEE: 3.99,
    FREE_DELIVERY_THRESHOLD: 25.0,
    TIP_PERCENTAGES: [0, 10, 15, 20], // Tip percentage options
  },
  
  // Driver Settings
  DRIVER: {
    MIN_AGE: 18,
    MIN_RATING: 3.0,
    MAX_DISTANCE_KM: 20,
    LOCATION_UPDATE_INTERVAL: 30000, // 30 seconds
    EARNING_PERCENTAGE: 0.7, // 70% of delivery fee goes to driver
  },
  
  // Restaurant Settings
  RESTAURANT: {
    COMMISSION_PERCENTAGE: 0.15, // 15% commission
    MAX_MENU_ITEMS: 100,
    MAX_MENUS: 10,
    PREPARATION_TIME_DEFAULT: 20, // minutes
    MIN_ORDER_PREP_TIME: 10, // minutes
    MAX_ORDER_PREP_TIME: 120, // minutes
  },
  
  // Cart Settings
  CART: {
    MAX_QUANTITY_PER_ITEM: 20,
    SAVE_TO_LOCAL_STORAGE: true,
    CART_EXPIRY_HOURS: 24, // Cart expires after 24 hours
  },
  
  // Payment Settings
  PAYMENT: {
    CURRENCY: 'USD',
    CURRENCY_SYMBOL: '$',
    SUPPORTED_METHODS: ['card', 'mobile_money', 'cash'],
    STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    PAYSTACK_PUBLIC_KEY: process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
    FLUTTERWAVE_PUBLIC_KEY: process.env.EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || '',
  },
  
  // Location Settings
  LOCATION: {
    DEFAULT_LATITUDE: 40.7128, // New York
    DEFAULT_LONGITUDE: -74.0060,
    DEFAULT_RADIUS_KM: 10,
    LOCATION_ACCURACY: 100, // meters
    MAX_LOCATION_AGE: 30000, // 30 seconds
    TRACKING_INTERVAL: 30000, // 30 seconds
    GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  },
  
  // Notification Settings
  NOTIFICATION: {
    ORDER_STATUS_UPDATE: true,
    NEW_ORDER_AVAILABLE: true,
    DRIVER_ASSIGNED: true,
    ORDER_DELAYED: true,
    PROMOTIONAL: false,
    SOUND_ENABLED: true,
    VIBRATION_ENABLED: true,
  },
  
  // Storage Keys
  STORAGE_KEYS: {
    USER_TOKEN: 'token',
    USER_DATA: 'user',
    CART_DATA: 'cart',
    LOCATION_DATA: 'location',
    SETTINGS: 'settings',
    NOTIFICATIONS: 'notifications',
    RECENT_SEARCHES: 'recent_searches',
    FAVORITE_RESTAURANTS: 'favorite_restaurants',
  },
  
  // Cache Settings
  CACHE: {
    RESTAURANTS_TTL: 300000, // 5 minutes
    MENUS_TTL: 600000, // 10 minutes
    ORDERS_TTL: 60000, // 1 minute
    IMAGES_TTL: 604800000, // 7 days
  },
  
  // Limits
  LIMITS: {
    MAX_IMAGE_SIZE: 5242880, // 5MB
    MAX_UPLOAD_FILES: 5,
    MAX_SEARCH_HISTORY: 20,
    MAX_RECENT_ORDERS: 50,
    MAX_NOTIFICATIONS: 100,
  },
  
  // Dates & Times
  DATE_FORMATS: {
    DISPLAY_DATE: 'MMM DD, YYYY',
    DISPLAY_TIME: 'hh:mm A',
    DISPLAY_DATETIME: 'MMM DD, YYYY hh:mm A',
    API_DATE: 'YYYY-MM-DD',
    API_DATETIME: 'YYYY-MM-DD HH:mm:ss',
  },
};

// Export individual configs for easy access
export const FEATURES = APP_CONFIG.FEATURES;
export const ORDER_CONFIG = APP_CONFIG.ORDER;
export const DRIVER_CONFIG = APP_CONFIG.DRIVER;
export const RESTAURANT_CONFIG = APP_CONFIG.RESTAURANT;
export const CART_CONFIG = APP_CONFIG.CART;
export const PAYMENT_CONFIG = APP_CONFIG.PAYMENT;
export const LOCATION_CONFIG = APP_CONFIG.LOCATION;
export const NOTIFICATION_CONFIG = APP_CONFIG.NOTIFICATION;
export const STORAGE_KEYS = APP_CONFIG.STORAGE_KEYS;
export const CACHE_CONFIG = APP_CONFIG.CACHE;
export const LIMITS = APP_CONFIG.LIMITS;
export const DATE_FORMATS = APP_CONFIG.DATE_FORMATS;