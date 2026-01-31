"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cloud,
  HardDrive,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { PageContainer } from "@/components/layout";
import { Card, Button, Input, Select, Badge, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useCredentials, useClusters } from "@/hooks";
import { PROVIDERS, REGIONS, CREDENTIAL_FIELDS } from "@/lib/constants";

type Step = "provider" | "credentials" | "config";

const INSTANCE_TYPES: Record<string, { value: string; label: string }[]> = {
  aws: [
    { value: "t3.small", label: "t3.small (2 vCPU, 2GB)" },
    { value: "t3.medium", label: "t3.medium (2 vCPU, 4GB)" },
    { value: "t3.large", label: "t3.large (2 vCPU, 8GB)" },
    { value: "m5.large", label: "m5.large (2 vCPU, 8GB)" },
  ],
  azure: [
    { value: "Standard_B2s", label: "Standard_B2s (2 vCPU, 4GB)" },
    { value: "Standard_D2s_v3", label: "Standard_D2s_v3 (2 vCPU, 8GB)" },
    { value: "Standard_B4ms", label: "Standard_B4ms (4 vCPU, 16GB)" },
  ],
  gcp: [
    { value: "e2-medium", label: "e2-medium (2 vCPU, 4GB)" },
    { value: "e2-standard-2", label: "e2-standard-2 (2 vCPU, 8GB)" },
    { value: "n2-standard-4", label: "n2-standard-4 (4 vCPU, 16GB)" },
  ],
  onprem: [{ value: "generic", label: "Generic / Virtual Machine" }],
};

export default function NewClusterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createCluster } = useClusters();
  const {
    status: credStatus,
    loading: credLoading,
    checkStatus,
    connect,
    disconnect,
  } = useCredentials();

  const [step, setStep] = useState<Step>("provider");
  const [loading, setLoading] = useState(false);
  const [credForm, setCredForm] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: "",
    provider: "",
    region: "",
    nodeCount: 3,
    instanceType: "",
    tags: "",
  });

  // Check credentials when provider changes
  useEffect(() => {
    if (formData.provider) {
      checkStatus(formData.provider);
    }
  }, [formData.provider, checkStatus]);

  const handleProviderSelect = (providerId: string) => {
    setFormData({
      ...formData,
      provider: providerId,
      region: REGIONS[providerId]?.[0]?.id || "",
      instanceType: INSTANCE_TYPES[providerId]?.[0]?.value || "",
    });
    setStep("credentials");
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await connect(formData.provider, credForm);
      setCredForm({});
      toast({
        title: "Connected successfully",
        description: `Your ${PROVIDERS.find((p) => p.id === formData.provider)?.name} account is now connected.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Connection failed",
        description:
          error instanceof Error ? error.message : "Failed to connect",
        variant: "error",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect(formData.provider);
      toast({
        title: "Disconnected",
        description: "Credentials have been removed.",
        variant: "info",
      });
    } catch (error) {
      toast({
        title: "Failed to disconnect",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "error",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.provider || !credStatus?.connected) return;

    setLoading(true);
    try {
      await createCluster(formData);
      toast({
        title: "Cluster created",
        description: `${formData.name} is now being provisioned.`,
        variant: "success",
      });
      router.push("/clusters");
    } catch (error) {
      toast({
        title: "Failed to create cluster",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const currentProvider = PROVIDERS.find((p) => p.id === formData.provider);
  const currentRegions = REGIONS[formData.provider] || [];

  return (
    <PageContainer
      title="Create New Cluster"
      description="Configure your new Kubernetes cluster deployment."
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Clusters", href: "/clusters" },
        { label: "New Cluster" },
      ]}
    >
      <div className="max-w-3xl space-y-8">
        {/* Step Indicator */}
        <div className="flex items-center gap-4">
          {["provider", "credentials", "config"].map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : ["provider", "credentials", "config"].indexOf(step) > idx
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {["provider", "credentials", "config"].indexOf(step) > idx ? (
                  <CheckCircle2 size={16} />
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium capitalize hidden sm:inline",
                  step === s ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s}
              </span>
              {idx < 2 && (
                <div className="w-8 h-px bg-border hidden sm:block" />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Provider Selection */}
          {step === "provider" && (
            <motion.div
              key="provider"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold">
                Select Infrastructure Provider
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PROVIDERS.map((p) => (
                  <Card
                    key={p.id}
                    hover
                    onClick={() => handleProviderSelect(p.id)}
                    className={cn(
                      "cursor-pointer p-5 transition-all",
                      formData.provider === p.id &&
                        "ring-2 ring-primary border-primary",
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-lg flex items-center justify-center",
                          p.bg,
                          p.color,
                        )}
                      >
                        {p.type === "cloud" ? (
                          <Cloud size={24} />
                        ) : (
                          <HardDrive size={24} />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{p.name}</h3>
                        <p className="text-xs text-muted-foreground capitalize">
                          {p.type} Provider
                        </p>
                      </div>
                      {formData.provider === p.id && (
                        <CheckCircle2 className="text-primary" size={20} />
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Credentials */}
          {step === "credentials" && (
            <motion.div
              key="credentials"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Account Connection</h2>
                  <p className="text-sm text-muted-foreground">
                    Connect your {currentProvider?.name} credentials
                  </p>
                </div>
                {credStatus?.connected && (
                  <Badge variant="success" dot>
                    Connected
                  </Badge>
                )}
              </div>

              <Card className="p-6">
                {credLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-primary" size={24} />
                  </div>
                ) : credStatus?.connected ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
                      <div>
                        <p className="font-medium text-sm">
                          Authenticated as: {credStatus.identity || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Source:{" "}
                          {credStatus.source === "env"
                            ? "Environment Variable (.env)"
                            : "Secure Storage"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDisconnect}
                        disabled={credStatus.source === "env"}
                        className="text-red-500 hover:text-red-600"
                      >
                        {credStatus.source === "env"
                          ? "Managed by Admin"
                          : "Disconnect"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleConnect} className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Enter your {currentProvider?.name} credentials to
                      continue.
                    </p>
                    <div className="grid gap-4">
                      {CREDENTIAL_FIELDS[formData.provider]?.map((field) => (
                        <Input
                          key={field.key}
                          type={field.type === "password" ? "password" : "text"}
                          label={field.label}
                          placeholder={field.placeholder}
                          required
                          value={credForm[field.key] || ""}
                          onChange={(e) =>
                            setCredForm({
                              ...credForm,
                              [field.key]: e.target.value,
                            })
                          }
                        />
                      ))}
                    </div>
                    <Button type="submit" loading={credLoading}>
                      Connect Account
                    </Button>
                  </form>
                )}
              </Card>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep("provider")}>
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button
                  onClick={() => setStep("config")}
                  disabled={!credStatus?.connected}
                >
                  Continue
                  <ArrowRight size={16} />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Configuration */}
          {step === "config" && (
            <motion.div
              key="config"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-semibold">Cluster Configuration</h2>
                <p className="text-sm text-muted-foreground">
                  Configure your Kubernetes cluster settings
                </p>
              </div>

              <Card className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                      label="Cluster Name"
                      placeholder="e.g., prod-cluster-01"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />

                    <Select
                      label="Region / Datacenter"
                      placeholder="Select a region"
                      required
                      value={formData.region}
                      onChange={(e) =>
                        setFormData({ ...formData, region: e.target.value })
                      }
                      options={currentRegions.map((r) => ({
                        value: r.id,
                        label: `${r.name} (${r.id})`,
                      }))}
                    />

                    <Select
                      label="Instance Type"
                      placeholder="Select instance size"
                      required
                      value={formData.instanceType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          instanceType: e.target.value,
                        })
                      }
                      options={INSTANCE_TYPES[formData.provider] || []}
                    />

                    <Input
                      label="Node Count"
                      type="number"
                      min={1}
                      max={5}
                      required
                      value={formData.nodeCount.toString()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          nodeCount: parseInt(e.target.value) || 1,
                        })
                      }
                    />

                    <div className="md:col-span-2">
                      <Input
                        label="Tags (Optional)"
                        placeholder="Environment=Production, Project=Alpha"
                        value={formData.tags}
                        onChange={(e) =>
                          setFormData({ ...formData, tags: e.target.value })
                        }
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Comma-separated key=value pairs
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4 border-t border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep("credentials")}
                    >
                      <ArrowLeft size={16} />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      loading={loading}
                      disabled={!formData.name}
                    >
                      Create Cluster
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageContainer>
  );
}
