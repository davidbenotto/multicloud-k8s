"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Moon,
  Sun,
  Key,
  Shield,
  User,
  Building2,
  Plus,
  X,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { PageContainer } from "@/components/layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Input,
  ConfirmDialog,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { credentialApi, type CredentialStatus } from "@/lib/api";
import { useOrganization } from "@/contexts/OrganizationContext";

type Theme = "dark" | "light" | "system";

interface ProviderConfig {
  id: string;
  name: string;
  color: string;
  bgColor: string;
  fields: { key: string; label: string; type: string; placeholder: string }[];
}

const providers: ProviderConfig[] = [
  {
    id: "aws",
    name: "Amazon Web Services",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    fields: [
      {
        key: "accessKeyId",
        label: "Access Key ID",
        type: "text",
        placeholder: "AKIA...",
      },
      {
        key: "secretAccessKey",
        label: "Secret Access Key",
        type: "password",
        placeholder: "Your secret key",
      },
      {
        key: "region",
        label: "Default Region",
        type: "text",
        placeholder: "eu-west-1",
      },
    ],
  },
  {
    id: "azure",
    name: "Microsoft Azure",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    fields: [
      {
        key: "tenantId",
        label: "Tenant ID",
        type: "text",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      },
      {
        key: "clientId",
        label: "Client ID",
        type: "text",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        placeholder: "Your client secret",
      },
      {
        key: "subscriptionId",
        label: "Subscription ID",
        type: "text",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      },
    ],
  },
  {
    id: "gcp",
    name: "Google Cloud Platform",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    fields: [
      {
        key: "projectId",
        label: "Project ID",
        type: "text",
        placeholder: "my-project-123",
      },
      {
        key: "serviceAccountKey",
        label: "Service Account JSON",
        type: "textarea",
        placeholder: '{"type": "service_account", ...}',
      },
    ],
  },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const { organizations, currentOrg, isAdmin } = useOrganization();
  const [theme, setTheme] = useState<Theme>("dark");

  // Credential states
  const [credentialStatus, setCredentialStatus] = useState<
    Record<string, CredentialStatus>
  >({});
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Connect modal
  const [connectModal, setConnectModal] = useState<{
    open: boolean;
    provider: ProviderConfig | null;
  }>({ open: false, provider: null });
  const [connectForm, setConnectForm] = useState<Record<string, string>>({});
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [connectionName, setConnectionName] = useState("");
  const [connecting, setConnecting] = useState(false);

  // Disconnect
  const [disconnectDialog, setDisconnectDialog] = useState<{
    open: boolean;
    provider: string;
  }>({ open: false, provider: "" });
  const [disconnecting, setDisconnecting] = useState(false);

  // Theme handling
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) {
      setTheme(stored);
      applyTheme(stored);
    }
  }, []);

  const applyTheme = (newTheme: Theme) => {
    if (newTheme === "system") {
      const systemPrefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      document.documentElement.classList.toggle("light", !systemPrefersDark);
    } else {
      document.documentElement.classList.toggle("light", newTheme === "light");
    }
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  // Fetch credential status for all providers
  const fetchCredentialStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const statuses: Record<string, CredentialStatus> = {};
      for (const provider of providers) {
        try {
          const status = await credentialApi.getStatus(provider.id);
          statuses[provider.id] = status;
        } catch {
          statuses[provider.id] = { connected: false };
        }
      }
      setCredentialStatus(statuses);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentialStatus();
  }, [fetchCredentialStatus, currentOrg]);

  // Open connect modal
  const openConnectModal = (provider: ProviderConfig) => {
    setConnectModal({ open: true, provider });
    setConnectForm({});
    setSelectedOrgId(currentOrg?.id || organizations[0]?.id || "");
    setConnectionName("");
  };

  // Close connect modal
  const closeConnectModal = () => {
    setConnectModal({ open: false, provider: null });
    setConnectForm({});
    setConnectionName("");
  };

  // Handle connect
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectModal.provider) return;

    setConnecting(true);
    try {
      // Build credentials payload with connection_name
      const payload = {
        ...connectForm,
        connection_name:
          connectionName ||
          `${connectModal.provider.name} - ${selectedOrgId === currentOrg?.id ? currentOrg?.name : "Organization"}`,
      };

      // Temporarily switch org context for the API call
      await credentialApi.connect(connectModal.provider.id, payload);

      toast({
        title: "Credentials Connected",
        description: `${connectModal.provider.name} credentials saved successfully.`,
        variant: "success",
      });

      closeConnectModal();
      fetchCredentialStatus();
    } catch (error) {
      toast({
        title: "Connection Failed",
        description:
          error instanceof Error ? error.message : "Failed to save credentials",
        variant: "error",
      });
    } finally {
      setConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await credentialApi.disconnect(disconnectDialog.provider);
      toast({
        title: "Disconnected",
        description: "Credentials have been removed.",
        variant: "success",
      });
      setDisconnectDialog({ open: false, provider: "" });
      fetchCredentialStatus();
    } catch (error) {
      toast({
        title: "Failed to disconnect",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "error",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const themeOptions = [
    { value: "dark", label: "Dark", icon: Moon },
    { value: "light", label: "Light", icon: Sun },
  ];

  return (
    <PageContainer
      title="Settings"
      description="Manage your application preferences and cloud credentials."
      breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Settings" }]}
    >
      <div className="grid gap-6 max-w-3xl">
        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun size={18} className="text-primary" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how the application looks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleThemeChange(option.value as Theme)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                      theme === option.value
                        ? "bg-primary/10 text-primary border border-primary/20 ring-2 ring-primary/20"
                        : "border border-border hover:bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon size={16} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Cloud Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key size={18} className="text-primary" />
              Cloud Credentials
            </CardTitle>
            <CardDescription>
              Connect your cloud providers. Credentials are linked to the
              currently selected organization.
              {currentOrg && (
                <span className="ml-1 text-primary font-medium">
                  ({currentOrg.name})
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loadingStatus ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2
                    className="animate-spin text-muted-foreground"
                    size={24}
                  />
                </div>
              ) : (
                providers.map((provider) => {
                  const status = credentialStatus[provider.id];
                  const isConnected = status?.connected;

                  return (
                    <div
                      key={provider.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            provider.bgColor,
                          )}
                        >
                          <span
                            className={cn("font-bold text-sm", provider.color)}
                          >
                            {provider.id.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{provider.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {isConnected
                              ? status?.connection_name ||
                                status?.identity ||
                                "Connected"
                              : "No credentials configured"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isConnected ? (
                          <>
                            <Badge variant="success" dot>
                              Connected
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openConnectModal(provider)}
                            >
                              Switch
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600"
                              onClick={() =>
                                setDisconnectDialog({
                                  open: true,
                                  provider: provider.id,
                                })
                              }
                            >
                              Disconnect
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => openConnectModal(provider)}
                          >
                            <Plus size={14} className="mr-1" />
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={18} className="text-primary" />
              Security
            </CardTitle>
            <CardDescription>
              Configure security settings and access controls.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security
                </p>
              </div>
              <Button variant="outline" size="sm">
                Enable
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connect Modal */}
      <AnimatePresence>
        {connectModal.open && connectModal.provider && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={closeConnectModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <Card className="w-full max-w-lg p-6 space-y-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          connectModal.provider.bgColor,
                        )}
                      >
                        <span
                          className={cn(
                            "font-bold text-xs",
                            connectModal.provider.color,
                          )}
                        >
                          {connectModal.provider.id.toUpperCase()}
                        </span>
                      </div>
                      Connect {connectModal.provider.name}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter your credentials to connect this provider.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeConnectModal}
                  >
                    <X size={18} />
                  </Button>
                </div>

                <form onSubmit={handleConnect} className="space-y-4">
                  {/* Organization Selector */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Building2 size={14} />
                      Link to Organization
                    </label>
                    <select
                      value={selectedOrgId}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}{" "}
                          {org.id === currentOrg?.id ? "(Current)" : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Credentials will be available only for this organization's
                      clusters.
                    </p>
                  </div>

                  {/* Connection Name */}
                  <Input
                    label="Connection Name"
                    placeholder={`e.g., ${connectModal.provider.name} Production`}
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                  />

                  {/* Provider-specific fields */}
                  {connectModal.provider.fields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <label className="text-sm font-medium">
                        {field.label}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          placeholder={field.placeholder}
                          value={connectForm[field.key] || ""}
                          onChange={(e) =>
                            setConnectForm({
                              ...connectForm,
                              [field.key]: e.target.value,
                            })
                          }
                          rows={4}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none font-mono text-xs"
                          required
                        />
                      ) : (
                        <Input
                          type={field.type}
                          placeholder={field.placeholder}
                          value={connectForm[field.key] || ""}
                          onChange={(e) =>
                            setConnectForm({
                              ...connectForm,
                              [field.key]: e.target.value,
                            })
                          }
                          required
                        />
                      )}
                    </div>
                  ))}

                  <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={closeConnectModal}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" loading={connecting}>
                      <CheckCircle2 size={16} className="mr-1" />
                      Connect
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Disconnect Confirmation */}
      <ConfirmDialog
        open={disconnectDialog.open}
        onClose={() => setDisconnectDialog({ open: false, provider: "" })}
        onConfirm={handleDisconnect}
        title="Disconnect Credentials"
        description="Are you sure you want to disconnect these credentials? Clusters using these credentials may fail to provision."
        confirmText="Disconnect"
        variant="destructive"
        loading={disconnecting}
      />
    </PageContainer>
  );
}
