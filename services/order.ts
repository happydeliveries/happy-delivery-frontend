import api from './api';

export const orderService = {
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