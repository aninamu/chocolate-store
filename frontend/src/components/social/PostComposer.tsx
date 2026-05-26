"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { createPost, fetchChocolates } from "@/lib/api";
import { useDemoUser } from "@/context/demo-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_TEXT = 280;

export function PostComposer() {
  const { demoHeaders } = useDemoUser();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [productId, setProductId] = useState("");

  const { data: products } = useQuery({
    queryKey: ["chocolates", "all"],
    queryFn: () => fetchChocolates(),
  });

  const mutation = useMutation({
    mutationFn: () =>
      createPost(
        {
          text: text.trim(),
          chocolate_id: productId || undefined,
          image_url: imageUrl.trim() || undefined,
        },
        demoHeaders()
      ),
    onSuccess: () => {
      toast.success("Post published");
      setText("");
      setImageUrl("");
      setProductId("");
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const remaining = MAX_TEXT - text.length;
  const canSubmit = text.trim().length >= 1 && text.length <= MAX_TEXT;

  return (
    <form
      className="space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mutation.mutate();
      }}
      aria-label="Create a new post"
    >
      <div className="space-y-1.5">
        <Label htmlFor="post-text">What&apos;s on your mind?</Label>
        <textarea
          id="post-text"
          className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
          maxLength={MAX_TEXT}
          placeholder="Share a tasting note or discovery…"
          aria-describedby="post-char-count"
        />
        <p
          id="post-char-count"
          className={`text-xs ${remaining < 20 ? "text-destructive" : "text-muted-foreground"}`}
        >
          {remaining} characters remaining
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="post-product">Product (optional)</Label>
          <select
            id="post-product"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">None</option>
            {(products ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="post-image">Image URL (optional)</Label>
          <Input
            id="post-image"
            type="url"
            placeholder="https://…"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            aria-describedby="post-image-hint"
          />
          <p id="post-image-hint" className="text-xs text-muted-foreground">
            Demo accepts HTTPS image URLs only — no file upload.
          </p>
        </div>
      </div>
      <Button type="submit" disabled={!canSubmit || mutation.isPending}>
        {mutation.isPending ? "Publishing…" : "Publish"}
      </Button>
    </form>
  );
}
