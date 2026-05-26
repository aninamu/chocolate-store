"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import {
  deletePost,
  fetchOpenReports,
  resolveReport,
} from "@/lib/api";
import { useDemoUser } from "@/context/demo-user";
import { DemoUserPicker } from "@/components/social/DemoUserPicker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function ModerationPage() {
  const { demoHeaders, userId } = useDemoUser();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["reports", userId],
    queryFn: () => fetchOpenReports(demoHeaders()),
    retry: false,
  });

  const resolveMutation = useMutation({
    mutationFn: (reportId: string) => resolveReport(reportId, demoHeaders()),
    onSuccess: () => {
      toast.success("Report resolved");
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (postId: string) => deletePost(postId, demoHeaders()),
    onSuccess: () => {
      toast.success("Content removed");
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/feed" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          ← Back to feed
        </Link>
        <h1 className="mt-2 font-heading text-3xl font-semibold">Moderation</h1>
        <p className="text-sm text-muted-foreground">
          Review open reports and remove content. Switch to the Mod Team demo user.
        </p>
      </div>

      <DemoUserPicker />

      {isError ? (
        <p className="text-sm text-destructive" role="alert">
          {(error as Error).message}{" "}
          <Button variant="link" onClick={() => void refetch()}>
            Retry
          </Button>
        </p>
      ) : isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" aria-label="Loading reports" />
      ) : (data?.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No open reports. You&apos;re all caught up.
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Open reports">
          {data!.map((report) => (
            <li
              key={report.id}
              className="rounded-xl border bg-card p-4 text-sm shadow-sm"
            >
              <p>
                <span className="font-medium capitalize">{report.entity_type}</span>{" "}
                reported by {report.reporter.name}
              </p>
              {report.reason ? (
                <p className="mt-1 text-muted-foreground">{report.reason}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => resolveMutation.mutate(report.id)}
                  disabled={resolveMutation.isPending}
                >
                  Resolve
                </Button>
                {report.entity_type === "post" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => removeMutation.mutate(report.entity_id)}
                    disabled={removeMutation.isPending || !userId}
                  >
                    Remove post
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
