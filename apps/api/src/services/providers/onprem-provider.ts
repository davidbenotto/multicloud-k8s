import { ClusterProvider, ProvisioningResult } from "./cluster-provider";
import { ClusterConfig } from "../provisioner";
import { v4 as uuidv4 } from "uuid";
import { NodeSSH } from "node-ssh";

interface OnPremConfig {
  host?: string;
  user?: string;
  sshKey?: string;
}

export class OnPremProvider implements ClusterProvider {
  private config: OnPremConfig;

  constructor(config: OnPremConfig) {
    this.config = config;
  }

  async deploy(
    config: ClusterConfig & { name: string },
  ): Promise<ProvisioningResult> {
    const deploymentId = uuidv4();
    console.log(`[OnPrem] Deploying to host ${this.config.host}...`);

    // Mock deployment for OnPrem (or actual SSH calls if we had real servers)
    // In a real scenario, this would SSH to the existing machine and install K3s

    // Simulate delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      success: true,
      deploymentId,
      resourceType: "onprem-cluster",
      instances: [
        {
          instanceId: "static-host-1",
          publicIp: this.config.host,
          privateIp: "127.0.0.1",
          state: "running",
        },
      ],
      details: {
        sshUser: this.config.user,
        // For on-prem, keyMaterial might be the key used to connect, or a new key generated
        // Here we assume we use the provided credentials to connect
      },
    };
  }

  async destroy(deploymentId: string) {
    console.log(
      `[OnPrem] "Destroying" cluster ${deploymentId} (No-op for static hosts)`,
    );
    return { success: true };
  }

  async getKubeconfig(provisioningResult: ProvisioningResult): Promise<string> {
    const host = this.config.host;
    const user = this.config.user;
    const key = this.config.sshKey;

    if (!host || !user || !key)
      throw new Error("Missing OnPrem connection details");

    // Attempt to retrieve via SSH
    const ssh = new NodeSSH();
    try {
      await ssh.connect({
        host,
        username: user,
        privateKey: key,
        readyTimeout: 10000,
      });

      const result = await ssh.execCommand("cat /etc/rancher/k3s/k3s.yaml");
      ssh.dispose();

      if (result.stderr) {
        throw new Error(`SSH Error: ${result.stderr}`);
      }

      return result.stdout.replace(/127\.0\.0\.1/g, host);
    } catch (error: any) {
      throw new Error(`OnPrem Kubeconfig retrieval failed: ${error.message}`);
    }
  }
}
