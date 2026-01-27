"use client";

import { motion } from "framer-motion";
import {
  Activity,
  Server,
  Cpu,
  Globe,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/layout";
import { Card, Badge, Button, SkeletonStats } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useClusters, useHealth } from "@/hooks";

export default function DashboardPage() {
  const { clusters, loading } = useClusters();
  const { isHealthy, health } = useHealth();

  // Calculate stats
  const stats = [
    {
      label: "Active Clusters",
      value: clusters.length.toString(),
      icon: Server,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      trend: "+2 this week",
    },
    {
      label: "Total Nodes",
      value:
        clusters.reduce((sum, c) => sum + (c.nodeCount || 0), 0).toString() ||
        "0",
      icon: Cpu,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      trend: "Scaling enabled",
    },
    {
      label: "Providers",
      value: new Set(clusters.map((c) => c.provider)).size.toString(),
      icon: Globe,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      trend: "Multi-cloud",
    },
    {
      label: "Health Score",
      value:
        clusters.length > 0
          ? Math.round(
              (clusters.filter((c) => c.status === "active").length /
                clusters.length) *
                100,
            ) + "%"
          : "N/A",
      icon: Activity,
      color: "text-pink-500",
      bg: "bg-pink-500/10",
      trend: "All systems go",
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle2 size={14} className="text-emerald-500" />;
      case "pending":
      case "provisioning":
        return <Clock size={14} className="text-amber-500" />;
      case "error":
        return <AlertCircle size={14} className="text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <PageContainer
      title="Dashboard"
      description="Overview of your multi-cloud infrastructure."
      actions={
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  isHealthy ? "bg-emerald-400" : "bg-red-400",
                )}
              />
              <span
                className={cn(
                  "relative inline-flex rounded-full h-2.5 w-2.5",
                  isHealthy ? "bg-emerald-500" : "bg-red-500",
                )}
              />
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                isHealthy ? "text-emerald-500" : "text-red-500",
              )}
            >
              {isHealthy ? "System Operational" : "System Unavailable"}
            </span>
          </span>
        </div>
      }
    >
      {/* Stats Grid */}
      {loading ? (
        <SkeletonStats />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card hover className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{stat.value}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.trend}
                    </p>
                  </div>
                  <div className={cn("p-3 rounded-lg", stat.bg)}>
                    <stat.icon className={cn("w-5 h-5", stat.color)} />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Clusters Table */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <h3 className="text-lg font-semibold">Active Clusters</h3>
            <Link href="/clusters">
              <Button variant="ghost" size="sm" className="gap-1">
                View All
                <ExternalLink size={14} />
              </Button>
            </Link>
          </div>

          <div className="relative w-full overflow-auto">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto" />
                <p className="mt-2">Loading clusters...</p>
              </div>
            ) : clusters.length === 0 ? (
              <div className="p-12 text-center">
                <Server className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No clusters found</h3>
                <p className="text-muted-foreground mt-1">
                  Deploy your first Kubernetes cluster to get started.
                </p>
                <Link href="/clusters/new" className="mt-4 inline-block">
                  <Button>Create Cluster</Button>
                </Link>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Cluster Name</th>
                    <th className="px-6 py-4 font-semibold">Provider</th>
                    <th className="px-6 py-4 font-semibold">Region</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clusters.slice(0, 5).map((cluster) => (
                    <tr
                      key={cluster.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <Server size={16} />
                          </div>
                          {cluster.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={cluster.provider as any}>
                          {cluster.provider.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {cluster.region || "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-2 capitalize">
                          {getStatusIcon(cluster.status)}
                          {cluster.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="icon">
                          <MoreVertical size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </motion.div>
    </PageContainer>
  );
}
