import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Find a Memory",
    description:
      "Browse by tag, use case, or agent compatibility. Filter and sort to find what you need.",
  },
  {
    title: "Pay with Filecoin",
    description:
      "One-time FIL payment via Coinbase Commerce. No subscriptions, no recurring fees.",
  },
  {
    title: "Get your token",
    description:
      "Receive a signed install token on payment. Use it to authenticate your install.",
  },
  {
    title: "Install in seconds",
    description:
      "Run pnpm add memory <name> --token <token>. Your memory is ready to use.",
  },
  {
    title: "Agent loads it",
    description:
      "Memory is injected into agent context. Your agent gains new capabilities.",
  },
  {
    title: "It lives on Filecoin",
    description:
      "Content is permanently stored on decentralized storage. CID-verifiable, forever.",
  },
];

export function HowItWorks({ className }: { className?: string }) {
  return (
    <section className={cn("space-y-8", className)}>
      <div>
        <h2
          className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl"
          style={{ fontFamily: "var(--font-playfair-display), serif" }}
        >
          How It Works
        </h2>
        <p className="mt-2 text-muted-foreground">
          Plug memories into agents. Pay once. Run forever.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, i) => (
          <Card
            key={step.title}
            className="border border-border bg-card shadow-sm"
          >
            <CardHeader className="pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                {i + 1}.
              </span>
              <h3 className="font-display text-lg font-semibold" style={{ fontFamily: "var(--font-playfair-display), serif" }}>
                {step.title}
              </h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {step.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
