"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  PlusCircle,
  Search,
  Trash2,
  Server,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { PageContainer } from "@/components/layout";
import {
  Button,
  Card,
  Badge,
  Input,
  ConfirmDialog,
  SkeletonCard,
  useToast,
} from "@/components/ui";
import { useClusters } from "@/hooks";
import { cn } from "@/lib/utils";

export default function ClustersPage() {
  const { clusters, loading, deleteCluster } = useClusters();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: string;
    name: string;
  }>({
    open: false,
    id: "",
    name: "",
  });
  const [deleting, setDeleting] = useState(false);

  // Filter clusters by search
  const filteredClusters = clusters.filter(
    (cluster) =>
      cluster.name.toLowerCase().includes(search.toLowerCase()) ||
      cluster.provider.toLowerCase().includes(search.toLowerCase()) ||
      cluster.region?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCluster(deleteDialog.id);
      toast({
        title: "Cluster deleted",
        description: `${deleteDialog.name} has been destroyed.`,
        variant: "success",
      });
      setDeleteDialog({ open: false, id: "", name: "" });
    } catch (error) {
      toast({
        title: "Failed to delete cluster",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "active":
        return {
          icon: CheckCircle2,
          color: "text-emerald-500",
          bg: "bg-emerald-500/10",
        };
      case "pending":
      case "provisioning":
        return { icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" };
      case "error":
        return {
          icon: AlertCircle,
          color: "text-red-500",
          bg: "bg-red-500/10",
        };
      default:
        return { icon: Server, color: "text-muted-foreground", bg: "bg-muted" };
    }
  };

  return (
    <PageContainer
      title="Clusters"
      description="Manage your Kubernetes clusters across all providers."
      breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Clusters" }]}
      actions={
        <Link href="/clusters/new">
          <Button>
            <PlusCircle size={18} />
            <span className="hidden sm:inline">New Cluster</span>
          </Button>
        </Link>
      }
    >
      {/* Search */}
      <Card className="p-4 flex items-center gap-3">
        <Search className="text-muted-foreground" size={20} />
        <input
          type="text"
          placeholder="Search clusters by name, provider, or region..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none flex-1 text-sm text-foreground placeholder:text-muted-foreground"
        />
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
            Clear
          </Button>
        )}
      </Card>

      {/* Cluster List */}
      <div className="space-y-4">
        {loading ? (
          // Loading skeletons
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filteredClusters.length === 0 ? (
          // Empty state
          <Card className="p-12 text-center">
            <Server className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">
              {clusters.length === 0
                ? "No clusters found"
                : "No matching clusters"}
            </h3>
            <p className="text-muted-foreground mt-1">
              {clusters.length === 0
                ? "Deploy your first Kubernetes cluster to get started."
                : "Try adjusting your search terms."}
            </p>
            {clusters.length === 0 && (
              <Link href="/clusters/new" className="mt-4 inline-block">
                <Button>Create Cluster</Button>
              </Link>
            )}
          </Card>
        ) : (
          // Cluster cards
          filteredClusters.map((cluster, index) => {
            const statusInfo = getStatusInfo(cluster.status);
            const StatusIcon = statusInfo.icon;

            return (
              <motion.div
                key={cluster.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card hover className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Server size={24} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">
                          {cluster.name}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge variant={cluster.provider as any} size="sm">
                            {cluster.provider.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {cluster.region || "No Region"}
                          </span>
                          {cluster.nodeCount && (
                            <span className="text-xs text-muted-foreground">
                              • {cluster.nodeCount} nodes
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                          statusInfo.bg,
                          statusInfo.color,
                        )}
                      >
                        <StatusIcon size={14} />
                        <span className="capitalize">{cluster.status}</span>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setDeleteDialog({
                            open: true,
                            id: cluster.id,
                            name: cluster.name,
                          })
                        }
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, id: "", name: "" })}
        onConfirm={handleDelete}
        title="Delete Cluster"
        description={`Are you sure you want to delete "${deleteDialog.name}"? This will destroy all cloud resources and cannot be undone.`}
        confirmText="Delete Cluster"
        variant="destructive"
        loading={deleting}
      />
    </PageContainer>
  );
}
