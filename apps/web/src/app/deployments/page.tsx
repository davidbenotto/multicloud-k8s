"use client";

import { Box, Clock, CheckCircle2, XCircle } from "lucide-react";
import { PageContainer } from "@/components/layout";
import { Card, Badge, Button } from "@/components/ui";

// Mock deployments data - in a real app this would come from an API
const deployments = [
  // Empty for now - this would be populated as clusters are created
];

export default function DeploymentsPage() {
  return (
    <PageContainer
      title="Deployments"
      description="Track and manage your cluster deployment history."
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Deployments" },
      ]}
    >
      {deployments.length === 0 ? (
        <Card className="p-12 text-center">
          <Box className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No deployments yet</h3>
          <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
            When you create clusters, their deployment history will appear here.
            You&apos;ll be able to track provisioning status, view logs, and
            manage rollbacks.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">{/* Deployment list would go here */}</div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Clock size={20} className="text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Successful</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <XCircle size={20} className="text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
