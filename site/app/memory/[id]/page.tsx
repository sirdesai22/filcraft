"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { getMemoryById } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CIDBadge } from "@/components/cid-badge";
import { TagBadge } from "@/components/tag-badge";
import { InstallCommand } from "@/components/install-command";
import { PaymentModal } from "@/components/payment-modal";
import Link from "next/link";

export default function MemoryDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const memory = getMemoryById(id);
  const [paymentOpen, setPaymentOpen] = useState(false);

  if (!memory) {
    return (
      <div className="container flex flex-col items-center justify-center px-4 py-24">
        <h1 className="font-display text-2xl font-bold" style={{ fontFamily: "var(--font-playfair-display), serif" }}>
          Memory not found
        </h1>
        <p className="mt-2 text-muted-foreground">
          The memory you're looking for doesn't exist or has been removed.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link href="/">Browse Memories</Link>
        </Button>
      </div>
    );
  }

  const readme = memory.readme ?? `## Overview\n\n${memory.description}\n\n## Installation\n\nUse the install command in the sidebar to add this memory to your project.`;

  return (
    <>
      <div className="container px-4 py-8 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-8 lg:flex-row lg:gap-12"
        >
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <h1
              className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl"
              style={{ fontFamily: "var(--font-playfair-display), serif" }}
            >
              {memory.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {memory.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>

            {/* Command to get memory locally - shown when book is "opened" */}
            <div className="parchment-command mt-6 rounded-lg p-4">
              <p className="mb-3 text-sm font-medium text-foreground/90">
                Get this memory locally
              </p>
              <InstallCommand name={memory.id} variant="parchment" />
            </div>

            <Tabs defaultValue="overview" className="mt-8">
              <TabsList className="mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="changelog">Changelog</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-0">
                <Card className="border border-border bg-card">
                  <CardContent className="pt-6">
                    <div className="prose prose-sm max-w-none text-foreground prose-headings:font-display prose-headings:font-semibold prose-p:text-muted-foreground prose-li:text-muted-foreground">
                      <ReactMarkdown>{readme}</ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="files" className="mt-0">
                <Card className="border border-border bg-card">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      File listing will be available after purchase.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="changelog" className="mt-0">
                <Card className="border border-border bg-card">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      No changelog entries yet.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="reviews" className="mt-0">
                <Card className="border border-border bg-card">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      No reviews yet. Be the first to leave one.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar panel */}
          <aside className="w-full lg:w-80 shrink-0">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="sticky top-24 space-y-6"
            >
              <Card className="border border-border bg-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">
                      {memory.price} FIL
                    </span>
                    <span className="text-xs text-muted-foreground">
                      v{memory.version}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    className="w-full rounded-full"
                    onClick={() => setPaymentOpen(true)}
                  >
                    Buy & Install
                  </Button>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Install command
                    </p>
                    <InstallCommand name={memory.id} variant="parchment" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border bg-card">
                <CardHeader>
                  <p className="text-sm font-medium text-foreground">
                    Stored on Filecoin
                  </p>
                </CardHeader>
                <CardContent>
                  <CIDBadge cid={memory.cid} />
                </CardContent>
              </Card>

              <Card className="border border-border bg-card">
                <CardHeader>
                  <p className="text-sm font-medium text-foreground">Author</p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {memory.author}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {memory.installs.toLocaleString()} installs
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </aside>
        </motion.div>
      </div>

      <PaymentModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        item={memory ? { type: "memory", data: memory } : null}
      />
    </>
  );
}
