export type Language = "lug" | "eng";

export interface OpeningHours {
  open: string; // "07:00", restaurant's local time
  close: string; // "22:30"
}

export interface DeliverySettings {
  pickup: boolean;
  delivery: boolean;
  fee: number; // UGX
  areas: string[];
}

export interface Restaurant {
  id: string;
  ownerId: string | null;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  defaultLanguage: Language;
  hours: OpeningHours;
  delivery: DeliverySettings;
  greeting: string | null;
  whatsappPhoneNumberId: string | null;
}

export interface MenuCategory {
  id: string;
  name: string;
  nameLg: string | null;
  position: number;
}

export interface MenuItem {
  id: string;
  categoryId: string | null;
  name: string;
  nameLg: string | null;
  description: string | null;
  price: number; // whole UGX
  available: boolean;
  imagePath: string | null;
  aliases: string[];
  position: number;
}

export interface Menu {
  categories: MenuCategory[];
  items: MenuItem[];
}

export const ORDER_STATUSES = ["new", "accepted", "preparing", "ready", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderItem {
  menuItemId: string | null;
  name: string;
  unitPrice: number;
  qty: number;
  notes: string | null;
}

export interface Order {
  id: string;
  reference: string;
  restaurantId: string;
  conversationId: string | null;
  channel: string;
  customerName: string | null;
  customerPhone: string | null;
  fulfillment: "pickup" | "delivery";
  address: string | null;
  notes: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  paymentMethod: "cash" | "mtn_momo" | "airtel_money";
  paymentStatus: "unpaid" | "paid";
  createdAt: string;
  items: OrderItem[];
}
