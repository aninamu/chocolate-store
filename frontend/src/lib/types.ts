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

export type DemoUser = {
  id: string;
  name: string;
  avatar_url: string;
  is_moderator: boolean;
  created_at: string;
};

export type ProductChip = {
  id: string;
  name: string;
  image_url: string;
  price_cents: number;
};

export type Post = {
  id: string;
  text: string;
  image_url: string | null;
  created_at: string;
  deleted_at: string | null;
  author: DemoUser;
  product: ProductChip | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
};

export type Comment = {
  id: string;
  text: string;
  created_at: string;
  deleted_at: string | null;
  author: DemoUser;
};

export type PostDetail = Post & {
  comments: Comment[];
};

export type FeedPage = {
  items: Post[];
  next_offset: number | null;
};

export type UserProfile = {
  user: DemoUser;
  post_count: number;
};

export type Report = {
  id: string;
  entity_type: "post" | "comment";
  entity_id: string;
  reason: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  reporter: DemoUser;
};

export type CreatePostPayload = {
  text: string;
  chocolate_id?: string;
  image_url?: string;
};
