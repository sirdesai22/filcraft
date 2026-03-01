import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

/**
 * Skeleton placeholder matching RegistryAgentCard layout.
 * Used during loading for stable layout and perceived performance (like erc-8004-agents-explorer-demo).
 */
export function AgentCardSkeleton() {
  return (
    <Card className="flex flex-col overflow-hidden border border-border bg-card shadow-sm h-full animate-pulse">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-lg bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-5 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        </div>
        <div className="space-y-2 pt-2">
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-2/3 rounded bg-muted" />
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 pb-2">
        <div className="flex flex-wrap gap-1.5">
          <div className="h-5 w-12 rounded-full bg-muted" />
          <div className="h-5 w-16 rounded-full bg-muted" />
          <div className="h-5 w-14 rounded-full bg-muted" />
        </div>
      </CardContent>

      <CardFooter className="border-t border-border pt-4">
        <div className="flex w-full items-center justify-between">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
      </CardFooter>
    </Card>
  );
}
