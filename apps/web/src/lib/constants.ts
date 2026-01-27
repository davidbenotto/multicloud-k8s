export const PROVIDERS = [
  {
    id: "aws",
    name: "Amazon Web Services",
    type: "cloud",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  {
    id: "azure",
    name: "Microsoft Azure",
    type: "cloud",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    id: "gcp",
    name: "Google Cloud",
    type: "cloud",
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    id: "onprem",
    name: "On-Premises",
    type: "onprem",
    color: "text-slate-500",
    bg: "bg-slate-500/10",
  },
];

export const REGIONS: Record<string, { id: string; name: string }[]> = {
  aws: [
    { id: "us-east-1", name: "US East (N. Virginia)" },
    { id: "us-west-2", name: "US West (Oregon)" },
    { id: "eu-central-1", name: "Europe (Frankfurt)" },
    { id: "ap-southeast-1", name: "Asia Pacific (Singapore)" },
  ],
  azure: [
    { id: "eastus", name: "East US" },
    { id: "westeurope", name: "West Europe" },
    { id: "japaneast", name: "Japan East" },
  ],
  gcp: [
    { id: "us-central1", name: "US Central (Iowa)" },
    { id: "europe-west1", name: "Europe West (Belgium)" },
    { id: "asia-east1", name: "Asia East (Taiwan)" },
  ],
  onprem: [
    { id: "local-dc", name: "Local Datacenter" },
    { id: "edge", name: "Edge Location" },
  ],
};

export const CREDENTIAL_FIELDS: Record<
  string,
  { key: string; label: string; type: string; placeholder: string }[]
> = {
  aws: [
    {
      key: "accessKeyId",
      label: "AWS ACCESS KEY ID",
      type: "text",
      placeholder: "AKIA...",
    },
    {
      key: "secretAccessKey",
      label: "SECRET ACCESS KEY",
      type: "password",
      placeholder: "wJalrXU...",
    },
  ],
  azure: [
    {
      key: "subscriptionId",
      label: "Azure Subscription ID",
      type: "text",
      placeholder: "e.g., 2e8abbc1-...",
    },
    {
      key: "tenantId",
      label: "Azure Tenant ID",
      type: "text",
      placeholder: "e.g., 7fe460f0-...",
    },
    {
      key: "clientId",
      label: "Azure Client ID",
      type: "text",
      placeholder: "e.g., e1f22329-...",
    },
    {
      key: "clientSecret",
      label: "Azure Client Secret",
      type: "password",
      placeholder: "Paste your client secret value here",
    },
  ],
  gcp: [
    {
      key: "projectId",
      label: "GCP Project ID",
      type: "text",
      placeholder: "my-gcp-project",
    },
    {
      key: "serviceAccountKey",
      label: "GCP Service Account Key (JSON)",
      type: "textarea",
      placeholder: '{ "type": "service_account", ... }',
    },
  ],
  onprem: [
    {
      key: "host",
      label: "Host IP / Domain",
      type: "text",
      placeholder: "192.168.1.50",
    },
    { key: "user", label: "SSH User", type: "text", placeholder: "root" },
    {
      key: "sshKey",
      label: "SSH Private Key",
      type: "textarea",
      placeholder: "-----BEGIN OPENSSH PRIVATE KEY-----...",
    },
  ],
};
