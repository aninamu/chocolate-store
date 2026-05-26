import type {
  CheckoutPayload,
  CheckoutResponse,
  Chocolate,
  Comment,
  CreatePostPayload,
  DemoUser,
  FeedPage,
  Post,
  PostDetail,
  Report,
  UserProfile,
} from "@/lib/types";

const base = () => process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

function parseDetail(err: { detail?: unknown }, fallback: string): string {
  if (typeof err.detail === "string") return err.detail;
  if (Array.isArray(err.detail)) {
    const parts = err.detail.map(
      (d: { msg?: string }) => (typeof d === "string" ? d : d?.msg) ?? ""
    );
    if (parts.some(Boolean)) return parts.join(" · ");
  }
  return fallback;
}

async function apiFetch(
  path: string,
  init?: RequestInit & { demoHeaders?: Record<string, string> }
): Promise<Response> {
  const { demoHeaders, ...rest } = init ?? {};
  const headers = new Headers(rest.headers);
  for (const [k, v] of Object.entries(demoHeaders ?? {})) {
    headers.set(k, v);
  }
  return fetch(`${base()}${path}`, { ...rest, headers, cache: "no-store" });
}

export async function fetchChocolates(params?: {
  tags?: string[];
  sort?: string;
}): Promise<Chocolate[]> {
  const u = new URL("/api/chocolates", base());
  if (params?.tags?.length) {
    for (const t of params.tags) {
      if (t) u.searchParams.append("tag", t);
    }
  }
  if (params?.sort) u.searchParams.set("sort", params.sort);
  const res = await fetch(u.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load chocolates");
  return res.json() as Promise<Chocolate[]>;
}

export async function fetchChocolate(id: string): Promise<Chocolate> {
  const res = await fetch(`${base()}/api/chocolates/${id}`, {
    cache: "no-store",
  });
  if (res.status === 404) throw new Error("Not found");
  if (!res.ok) throw new Error("Failed to load chocolate");
  return res.json() as Promise<Chocolate>;
}

export async function postCheckout(
  body: CheckoutPayload
): Promise<CheckoutResponse> {
  const res = await fetch(`${base()}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: unknown };
    let msg = `Checkout failed (${res.status})`;
    if (typeof err.detail === "string") msg = err.detail;
    if (Array.isArray(err.detail)) {
      const parts = err.detail.map(
        (d: { msg?: string }) => (typeof d === "string" ? d : d?.msg) ?? ""
      );
      if (parts.some(Boolean)) msg = parts.join(" · ");
    }
    throw new Error(msg);
  }
  return res.json() as Promise<CheckoutResponse>;
}

export async function fetchDemoUsers(): Promise<DemoUser[]> {
  const res = await apiFetch("/api/users");
  if (!res.ok) throw new Error("Failed to load demo users");
  return res.json() as Promise<DemoUser[]>;
}

export async function fetchFeed(
  offset = 0,
  demoHeaders: Record<string, string> = {}
): Promise<FeedPage> {
  const u = new URL("/api/feed", base());
  u.searchParams.set("offset", String(offset));
  const res = await apiFetch(u.pathname + u.search, { demoHeaders });
  if (!res.ok) throw new Error("Failed to load feed");
  return res.json() as Promise<FeedPage>;
}

export async function fetchPost(
  id: string,
  demoHeaders: Record<string, string> = {}
): Promise<PostDetail> {
  const res = await apiFetch(`/api/posts/${id}`, { demoHeaders });
  if (res.status === 404) throw new Error("Post not found");
  if (!res.ok) throw new Error("Failed to load post");
  return res.json() as Promise<PostDetail>;
}

export async function createPost(
  body: CreatePostPayload,
  demoHeaders: Record<string, string>
): Promise<Post> {
  const res = await apiFetch("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...demoHeaders },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: unknown };
    throw new Error(parseDetail(err, `Create post failed (${res.status})`));
  }
  return res.json() as Promise<Post>;
}

export async function deletePost(
  id: string,
  demoHeaders: Record<string, string>
): Promise<void> {
  const res = await apiFetch(`/api/posts/${id}`, {
    method: "DELETE",
    demoHeaders,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: unknown };
    throw new Error(parseDetail(err, "Failed to delete post"));
  }
}

export async function likePost(
  id: string,
  demoHeaders: Record<string, string>
): Promise<number> {
  const res = await apiFetch(`/api/posts/${id}/likes`, {
    method: "POST",
    demoHeaders,
  });
  if (!res.ok) throw new Error("Failed to like post");
  const body = (await res.json()) as { like_count: number };
  return body.like_count;
}

export async function unlikePost(
  id: string,
  demoHeaders: Record<string, string>
): Promise<number> {
  const res = await apiFetch(`/api/posts/${id}/likes`, {
    method: "DELETE",
    demoHeaders,
  });
  if (!res.ok) throw new Error("Failed to unlike post");
  const body = (await res.json()) as { like_count: number };
  return body.like_count;
}

export async function createComment(
  postId: string,
  text: string,
  demoHeaders: Record<string, string>
): Promise<Comment> {
  const res = await apiFetch(`/api/posts/${postId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...demoHeaders },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: unknown };
    throw new Error(parseDetail(err, "Failed to add comment"));
  }
  return res.json() as Promise<Comment>;
}

export async function fetchUserProfile(id: string): Promise<UserProfile> {
  const res = await apiFetch(`/api/users/${id}`);
  if (res.status === 404) throw new Error("User not found");
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json() as Promise<UserProfile>;
}

export async function fetchUserPosts(
  id: string,
  offset = 0,
  demoHeaders: Record<string, string> = {}
): Promise<FeedPage> {
  const u = new URL(`/api/users/${id}/posts`, base());
  u.searchParams.set("offset", String(offset));
  const res = await apiFetch(u.pathname + u.search, { demoHeaders });
  if (!res.ok) throw new Error("Failed to load user posts");
  return res.json() as Promise<FeedPage>;
}

export async function createReport(
  body: { entity_type: "post" | "comment"; entity_id: string; reason?: string },
  demoHeaders: Record<string, string>
): Promise<Report> {
  const res = await apiFetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...demoHeaders },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: unknown };
    throw new Error(parseDetail(err, "Failed to submit report"));
  }
  return res.json() as Promise<Report>;
}

export async function fetchOpenReports(
  demoHeaders: Record<string, string>
): Promise<Report[]> {
  const res = await apiFetch("/api/reports", { demoHeaders });
  if (!res.ok) throw new Error("Failed to load reports");
  return res.json() as Promise<Report[]>;
}

export async function resolveReport(
  id: string,
  demoHeaders: Record<string, string>
): Promise<Report> {
  const res = await apiFetch(`/api/reports/${id}/resolve`, {
    method: "POST",
    demoHeaders,
  });
  if (!res.ok) throw new Error("Failed to resolve report");
  return res.json() as Promise<Report>;
}
