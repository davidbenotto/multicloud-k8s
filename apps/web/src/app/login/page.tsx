"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Cloud, Loader2 } from "lucide-react";
import { Button, Card, Input, useToast } from "@/components/ui";

type CloudProvider = "aws" | "azure" | "gcp";

interface AWSCredentials {
  provider: "aws";
  accessKeyId: string;
  secretAccessKey: string;
}

interface AzureCredentials {
  provider: "azure";
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

interface GCPCredentials {
  provider: "gcp";
  serviceAccountKey: string;
}

type CloudCredentials = AWSCredentials | AzureCredentials | GCPCredentials;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [provider, setProvider] = useState<CloudProvider>("aws");
  const [loading, setLoading] = useState(false);

  // AWS credentials
  const [awsAccessKeyId, setAwsAccessKeyId] = useState("");
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState("");

  // Azure credentials
  const [azureTenantId, setAzureTenantId] = useState("");
  const [azureClientId, setAzureClientId] = useState("");
  const [azureClientSecret, setAzureClientSecret] = useState("");

  // GCP credentials
  const [gcpServiceAccountKey, setGcpServiceAccountKey] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let credentials: CloudCredentials;

      if (provider === "aws") {
        credentials = {
          provider: "aws",
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
        };
      } else if (provider === "azure") {
        credentials = {
          provider: "azure",
          tenantId: azureTenantId,
          clientId: azureClientId,
          clientSecret: azureClientSecret,
        };
      } else {
        credentials = {
          provider: "gcp",
          serviceAccountKey: gcpServiceAccountKey,
        };
      }

      const response = await fetch("http://localhost:3333/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // Store session token
      localStorage.setItem("cloud_session_token", data.session.sessionToken);

      toast({
        title: "Login successful",
        description: `Welcome to ${data.session.organization.name}`,
        variant: "success",
      });

      // Redirect to dashboard
      router.push("/");
    } catch (error) {
      toast({
        title: "Authentication failed",
        description:
          error instanceof Error ? error.message : "Invalid credentials",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Cloud className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Clusters Platform</h1>
          <p className="text-muted-foreground">
            Sign in with your cloud provider credentials
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Provider Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Cloud Provider</label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={provider === "aws" ? "primary" : "outline"}
                  onClick={() => setProvider("aws")}
                  className="w-full"
                >
                  AWS
                </Button>
                <Button
                  type="button"
                  variant={provider === "azure" ? "primary" : "outline"}
                  onClick={() => setProvider("azure")}
                  className="w-full"
                >
                  Azure
                </Button>
                <Button
                  type="button"
                  variant={provider === "gcp" ? "primary" : "outline"}
                  onClick={() => setProvider("gcp")}
                  className="w-full"
                >
                  GCP
                </Button>
              </div>
            </div>

            {/* AWS Form */}
            {provider === "aws" && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <Input
                  label="AWS Access Key ID"
                  type="text"
                  required
                  value={awsAccessKeyId}
                  onChange={(e) => setAwsAccessKeyId(e.target.value)}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                />
                <Input
                  label="AWS Secret Access Key"
                  type="password"
                  required
                  value={awsSecretAccessKey}
                  onChange={(e) => setAwsSecretAccessKey(e.target.value)}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                />
              </motion.div>
            )}

            {/* Azure Form */}
            {provider === "azure" && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <Input
                  label="Tenant ID"
                  type="text"
                  required
                  value={azureTenantId}
                  onChange={(e) => setAzureTenantId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
                <Input
                  label="Client ID (Application ID)"
                  type="text"
                  required
                  value={azureClientId}
                  onChange={(e) => setAzureClientId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
                <Input
                  label="Client Secret"
                  type="password"
                  required
                  value={azureClientSecret}
                  onChange={(e) => setAzureClientSecret(e.target.value)}
                  placeholder="Your client secret"
                />
              </motion.div>
            )}

            {/* GCP Form */}
            {provider === "gcp" && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Service Account JSON Key
                  </label>
                  <textarea
                    required
                    value={gcpServiceAccountKey}
                    onChange={(e) => setGcpServiceAccountKey(e.target.value)}
                    placeholder='{"type": "service_account", ...}'
                    rows={8}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none font-mono"
                  />
                </div>
              </motion.div>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              {loading ? "Authenticating..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Your credentials are used only for authentication and organization
              mapping.
              <br />
              They are never stored on our servers.
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
