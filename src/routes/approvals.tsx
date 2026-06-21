import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Check, X, Clock } from "lucide-react";
import { db, type ApprovalRequest, seedDatabase } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { user, isAdmin } = useAuth();
  const [pending, setPending] = useState<ApprovalRequest[]>([]);
  const [history, setHistory] = useState<ApprovalRequest[]>([]);

  const loadApprovals = useCallback(async () => {
    await seedDatabase();
    const all = await db.approvals.reverse().toArray();
    setPending(all.filter((a) => a.status === "pending"));
    setHistory(all.filter((a) => a.status !== "pending"));
  }, []);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleReview = async (id: string, status: "approved" | "rejected", note?: string) => {
    if (!user) return;
    await db.approvals.update(id, {
      status,
      reviewedBy: user.id,
      reviewedByName: user.displayName,
      reviewNote: note,
      reviewedAt: new Date(),
    });
    loadApprovals();
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">Only admins can access approvals.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-display">Approvals</h1>
        <p className="text-sm text-muted-foreground">Review edit and deletion requests</p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
          <h3 className="font-semibold text-sm">Pending Requests ({pending.length})</h3>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </div>
        {pending.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No pending approval requests
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pending.map((req) => (
              <div key={req.id} className="px-4 py-3 hover:bg-muted/30">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      <span className="capitalize">{req.type}</span> request for{" "}
                      <span className="capitalize">{req.recordType}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Requested by {req.requestedByName} · {req.createdAt.toLocaleDateString("en-UG")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Proposed changes: {req.proposedChanges}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-profit border-profit/30 hover:bg-profit/10"
                      onClick={() => handleReview(req.id, "approved")}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-loss border-loss/30 hover:bg-loss/10"
                      onClick={() => handleReview(req.id, "rejected")}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted">
            <h3 className="font-semibold text-sm">History</h3>
          </div>
          <div className="divide-y divide-border">
            {history.slice(0, 20).map((req) => (
              <div key={req.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">
                      <span className="capitalize">{req.type}</span>{" "}
                      <span className={`font-medium ${req.status === "approved" ? "text-profit" : "text-loss"}`}>
                        {req.status}
                      </span>{" "}
                      for <span className="capitalize">{req.recordType}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      By {req.reviewedByName} · {req.reviewedAt?.toLocaleDateString("en-UG")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
