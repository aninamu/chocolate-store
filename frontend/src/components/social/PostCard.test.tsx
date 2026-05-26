import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PostCard } from "@/components/social/PostCard";
import type { Post } from "@/lib/types";

const samplePost: Post = {
  id: "post-1",
  text: "Great dark chocolate!",
  image_url: null,
  created_at: new Date().toISOString(),
  deleted_at: null,
  author: {
    id: "user-1",
    name: "Alice Chen",
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
    is_moderator: false,
    created_at: new Date().toISOString(),
  },
  product: null,
  like_count: 2,
  comment_count: 1,
  liked_by_me: false,
};

describe("PostCard", () => {
  it("renders author, text, and engagement counts", () => {
    render(<PostCard post={samplePost} />);
    expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    expect(screen.getByText("Great dark chocolate!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /like post \(2 likes\)/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view comments \(1\)/i })).toBeInTheDocument();
  });

  it("calls onLikeToggle when like button is clicked", async () => {
    const user = userEvent.setup();
    const onLike = vi.fn();
    const { container } = render(
      <PostCard post={samplePost} onLikeToggle={onLike} />
    );
    const card = container.firstElementChild as HTMLElement;
    await user.click(
      within(card).getByRole("button", { name: /like post \(2 likes\)/i })
    );
    expect(onLike).toHaveBeenCalledOnce();
  });
});
