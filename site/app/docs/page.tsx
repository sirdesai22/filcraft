"use client";

import { motion } from "framer-motion";
import { HowItWorks } from "@/components/how-it-works";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InstallCommand } from "@/components/install-command";

export default function DocsPage() {
  return (
    <div className="container px-4 py-12 md:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-3xl space-y-16"
      >
        <div>
          <h1
            className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl"
            style={{ fontFamily: "var(--font-playfair-display), serif" }}
          >
            Documentation
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Plug memories into agents. Pay once. Run forever.
          </p>
        </div>

        <HowItWorks />

        <section className="space-y-6">
          <h2
            className="font-display text-2xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair-display), serif" }}
          >
            The Install Metaphor
          </h2>
          <p className="text-muted-foreground">
            Memories work like npm packages but for agent cognition. Each memory
            is a structured experience file that your agent can consume.
            Install it once, and it becomes part of your agent&apos;s context—no
            subscriptions, no recurring fees.
          </p>
          <p className="text-muted-foreground">
            After purchasing, you receive a signed install token. Use it with the
            Memfil registry to add the memory to your project:
          </p>
          <InstallCommand name="chain-of-thought-pro" className="my-4" />
        </section>

        <section className="space-y-6">
          <h2
            className="font-display text-2xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair-display), serif" }}
          >
            Filecoin Storage
          </h2>
          <p className="text-muted-foreground">
            All memories are stored on Filecoin and IPFS. Every memory has a
            content identifier (CID) that you can verify. The content is
            permanently stored on decentralized infrastructure—no single point of
            failure, no takedowns.
          </p>
          <Card className="border border-border bg-card">
            <CardHeader>
              <p className="text-sm font-medium text-foreground">
                Stored on Filecoin
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Each memory card and detail page shows a CID badge. Click to
                copy or open the IPFS gateway to verify the content.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <h2
            className="font-display text-2xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair-display), serif" }}
          >
            Getting Started
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
            <li>Browse memories by tag or use the Explore page for curated picks.</li>
            <li>Click Buy & Install to pay with Filecoin via Coinbase Commerce.</li>
            <li>Copy the install command with your token from the success modal.</li>
            <li>Run the command in your project directory.</li>
            <li>Your agent loads the memory automatically.</li>
          </ol>
        </section>
      </motion.div>
    </div>
  );
}
