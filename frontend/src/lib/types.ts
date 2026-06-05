export type Chocolate = {
  id: string;
  name: string;
  slug: string;
  description: string;
  origin: string | null;
  cacao_percentage: number | null;
  price_cents: number;
  image_url: string;
  tags: string[];
  in_stock: boolean;
  created_at: string;
  churrito_quote: string | null;
};

export type CartLine = {
  chocolateId: string;
  quantity: number;
};

export type CheckoutPayload = {
  customer_name: string;
  customer_email: string;
  items: { chocolate_id: string; quantity: number }[];
};

export type CheckoutResponse = {
  order_id: string;
  total_cents: number;
};
