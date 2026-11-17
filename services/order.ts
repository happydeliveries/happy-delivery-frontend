import api from './api';

export const orderService = {
  async getSupportContact() {
    return api.get('/orders/support-contact');
  },

  async getDeliveryQuote(data: {
    restaurant_id: string;
    delivery_address?: any;
    latitude?: number;
    longitude?: number;
  }) {
    return api.post('/orders/delivery-quote', data);
  },

  async createOrder(data: {
    restaurant_id: string;
    items: Array<{
      menu_item_id: string;
      quantity: number;
      unit_price: number;
      special_instructions?: string;
      selected_options?: any;
      allergen_notes?: string;
    }>;
    special_instructions?: string;
    delivery_instructions?: string;
    delivery_address: any;
    subtotal: number;
    delivery_fee: number;
    tax_amount: number;
    tip_amount?: number;
  }) {
    return api.post('/orders', data);
  },

  async getOrder(id: string) {
    return api.get(`/orders/${id}`);
  },

  async getMyOrders(filters = {}) {
    const params = new URLSearchParams(filters);
    return api.get(`/orders/my?${params}`);
  },

  async acceptOrder(orderId: string) {
    return api.post(`/orders/${orderId}/accept`);
  },

  async declineOrder(orderId: string) {
    return api.post(`/orders/${orderId}/decline`);
  },

  async updateOrderStatus(orderId: string, status: string) {
    return api.patch(`/orders/${orderId}/status`, { status });
  },

  async trackOrder(orderId: string) {
    return api.get(`/orders/${orderId}/tracking`);
  },

  async getOrderRoute(
    orderId: string,
    params?: { lat?: number; lng?: number; force?: boolean }
  ) {
    const query = new URLSearchParams();
    if (params?.lat !== undefined && params?.lng !== undefined) {
      query.set('lat', String(params.lat));
      query.set('lng', String(params.lng));
    }
    if (params?.force) {
      query.set('force', '1');
    }
    const qs = query.toString();
    return api.get(`/orders/${orderId}/route${qs ? `?${qs}` : ''}`);
  },

  async getDirections(
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number }
  ) {
    const query = new URLSearchParams({
      fromLat: String(from.latitude),
      fromLng: String(from.longitude),
      toLat: String(to.latitude),
      toLng: String(to.longitude),
    });
    return api.get(`/routing/directions?${query.toString()}`);
  },

  async cancelOrder(orderId: string, reason?: string) {
    return api.post(`/orders/${orderId}/cancel`, { reason });
  },

  async rateOrder(
    orderId: string,
    ratings: { restaurant_rating?: number; driver_rating?: number }
  ) {
    return api.post(`/orders/${orderId}/rate`, ratings);
  },

  async processPayment(orderId: string, paymentMethod: string, paymentDetails?: any) {
    return api.post('/payments/process', {
      order_id: orderId,
      payment_method: paymentMethod,
      payment_details: paymentDetails,
    });
  },

  async initializePaystackPayment(orderId: string, paymentMethod = 'card') {
    return api.post('/payments/paystack/initialize', {
      order_id: orderId,
      payment_method: paymentMethod,
    });
  },

  async verifyPaystackPayment(data: {
    order_id: string;
    reference?: string;
    channel?: string;
    complete_checkout?: boolean;
    card_last4?: string;
  }) {
    return api.post('/payments/paystack/verify', data);
  },
};