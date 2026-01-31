import {
  EC2Client,
  RunInstancesCommand,
  CreateKeyPairCommand,
  TerminateInstancesCommand,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  DescribeSecurityGroupsCommand,
  DescribeInstancesCommand,
  TagSpecification,
} from "@aws-sdk/client-ec2";
import { NodeSSH } from "node-ssh";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { v4 as uuidv4 } from "uuid";
import { ClusterProvider, ProvisioningResult } from "./cluster-provider";
import { ClusterConfig } from "../provisioner";

interface AWSConfig {
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export class AWSProvider implements ClusterProvider {
  private ec2Client: EC2Client;
  private ssmClient: SSMClient;

  constructor(config: AWSConfig) {
    this.ec2Client = new EC2Client(config);
    this.ssmClient = new SSMClient(config);
  }

  /**
   * Helper to get latest AMI ID from SSM (Ubuntu/Amazon Linux)
   */
  async getLatestAmi(osImage: string = "ubuntu24"): Promise<string> {
    const ssmPaths: Record<string, string> = {
      ubuntu24:
        "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id",
      ubuntu22:
        "/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp3/ami-id",
      "amazon-linux-2023":
        "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64",
    };

    const paramName = ssmPaths[osImage] || ssmPaths["ubuntu24"];

    try {
      const response = await this.ssmClient.send(
        new GetParameterCommand({ Name: paramName }),
      );
      return response.Parameter?.Value || "";
    } catch (error: any) {
      console.warn(
        `Failed to fetch AMI from SSM for ${osImage}, using fallback. Error: ${error.message}`,
      );
      // Fallback map (us-east-1 examples)
      const fallbackMap: Record<string, string> = {
        ubuntu24: "ami-04b70fa74e45c3917",
        ubuntu22: "ami-0c02fb55956c7d316",
        "amazon-linux-2023": "ami-051f7e7f6c2f40dc1",
      };
      return fallbackMap[osImage] || fallbackMap["ubuntu24"];
    }
  }

  /**
   * Create dedicated Security Group for the cluster
   */
  async createSecurityGroup(name: string, deploymentId: string) {
    const sgName = `sg-${name}-${deploymentId.slice(0, 8)}`;
    try {
      // 1. Create SG
      const createRes = await this.ec2Client.send(
        new CreateSecurityGroupCommand({
          GroupName: sgName,
          Description: `Security Group for Cluster ${name}`,
          TagSpecifications: [
            {
              ResourceType: "security-group",
              Tags: [
                { Key: "Name", Value: sgName },
                { Key: "DeploymentId", Value: deploymentId },
                { Key: "ManagedBy", Value: "clusters-control-plane" },
              ],
            },
          ],
        }),
      );
      const groupId = createRes.GroupId;

      // 2. Authorize Ingress
      if (groupId) {
        await this.ec2Client.send(
          new AuthorizeSecurityGroupIngressCommand({
            GroupId: groupId,
            IpPermissions: [
              {
                IpProtocol: "tcp",
                FromPort: 22,
                ToPort: 22,
                IpRanges: [{ CidrIp: "0.0.0.0/0" }], // SSH Access
              },
              {
                IpProtocol: "tcp",
                FromPort: 6443,
                ToPort: 6443,
                IpRanges: [{ CidrIp: "0.0.0.0/0" }], // K8s API Access
              },
              {
                IpProtocol: "tcp",
                FromPort: 80,
                ToPort: 80,
                IpRanges: [{ CidrIp: "0.0.0.0/0" }], // App HTTP
              },
              {
                IpProtocol: "tcp",
                FromPort: 443,
                ToPort: 443,
                IpRanges: [{ CidrIp: "0.0.0.0/0" }], // App HTTPS
              },
            ],
          }),
        );
      }
      return groupId;
    } catch (error: any) {
      console.warn("Failed to create security group:", error);
      return undefined;
    }
  }

  /**
   * Deploy EC2 Instances (Cluster Nodes)
   */
  async deploy(
    config: ClusterConfig & { name: string },
  ): Promise<ProvisioningResult> {
    const {
      name,
      nodeCount = 3,
      instanceType = "t2.micro",
      tags: customTags = {},
    } = config;
    const deploymentId = uuidv4();
    const imageId = await this.getLatestAmi("ubuntu24");

    // 1. Create Key Pair
    const keyName = `key-${deploymentId.slice(0, 8)}`;
    let keyMaterial: string | undefined;

    try {
      const keyPair = await this.ec2Client.send(
        new CreateKeyPairCommand({ KeyName: keyName }),
      );
      keyMaterial = keyPair.KeyMaterial;
    } catch (error) {
      console.warn("Failed to create key pair:", error);
    }

    // 2. Create Security Group
    const securityGroupId = await this.createSecurityGroup(name, deploymentId);

    // 3. Prepare User Data (K3s Installation)
    const userDataScript = `#!/bin/bash
# Install K3s (Lightweight Kubernetes)
curl -sfL https://get.k3s.io | sh -s - --tls-san $(curl http://169.254.169.254/latest/meta-data/public-ipv4) --write-kubeconfig-mode 644
`;
    const encodedUserData = Buffer.from(userDataScript).toString("base64");

    // 4. Prepare Tags
    const tags: TagSpecification[] = [
      {
        ResourceType: "instance",
        Tags: [
          { Key: "Name", Value: `${name}-node` },
          { Key: "DeploymentId", Value: deploymentId },
          { Key: "Cluster", Value: name },
          { Key: "ManagedBy", Value: "clusters-control-plane" },
          ...Object.entries(customTags).map(([key, value]) => ({
            Key: key,
            Value: value,
          })),
        ],
      },
    ];

    console.log(
      `[AWS] Launching ${nodeCount} instances (${instanceType}) for cluster ${name}...`,
    );

    try {
      const response = await this.ec2Client.send(
        new RunInstancesCommand({
          ImageId: imageId,
          InstanceType: instanceType as any,
          MinCount: nodeCount,
          MaxCount: nodeCount,
          KeyName: keyName,
          SecurityGroupIds: securityGroupId ? [securityGroupId] : undefined,
          UserData: encodedUserData,
          TagSpecifications: tags,
        }),
      );

      const instances =
        response.Instances?.filter((i) => i.InstanceId).map((i) => ({
          instanceId: i.InstanceId!,
          privateIp: i.PrivateIpAddress,
          state: i.State?.Name,
        })) || [];

      return {
        success: true,
        deploymentId,
        resourceType: "ec2-cluster",
        instances,
        details: {
          keyName,
          keyMaterial, // Warning: In production, save this securely!
          sshUser: "ubuntu",
        },
      };
    } catch (error: any) {
      console.error("[AWS] Failed to launch instances:", error);
      throw new Error(`AWS Launch Failed: ${error.message}`);
    }
  }

  /**
   * Get Public IP of an instance
   */
  async getPublicIp(instanceId: string): Promise<string | undefined> {
    try {
      const res = await this.ec2Client.send(
        new DescribeInstancesCommand({ InstanceIds: [instanceId] }),
      );
      return res.Reservations?.[0]?.Instances?.[0]?.PublicIpAddress;
    } catch (error) {
      return undefined;
    }
  }

  async getKubeconfig(provisioningResult: ProvisioningResult): Promise<string> {
    const instances = provisioningResult.instances || [];
    if (instances.length === 0)
      throw new Error("No instances to retrieve kubeconfig from");

    // Pick first instance
    const instanceId = instances[0].instanceId;
    if (!instanceId) throw new Error("Instance ID missing");

    const publicIp = await this.getPublicIp(instanceId);
    if (!publicIp) throw new Error("Instance has no Public IP yet");

    const sshUser = provisioningResult.details?.sshUser || "ubuntu";
    const privateKey = provisioningResult.details?.keyMaterial;

    if (!privateKey)
      throw new Error("No SSH Key available to retrieve kubeconfig");

    return this.retrieveKubeconfig(publicIp, sshUser, privateKey);
  }

  /**
   * Retrieve Kubeconfig from instance via SSH
   */
  private async retrieveKubeconfig(
    publicIp: string,
    username: string,
    privateKey: string,
  ): Promise<string> {
    const ssh = new NodeSSH();
    try {
      await ssh.connect({
        host: publicIp,
        username,
        privateKey,
        readyTimeout: 20000, // 20s timeout
      });

      // Read kubeconfig
      const result = await ssh.execCommand("cat /etc/rancher/k3s/k3s.yaml");
      ssh.dispose();

      if (result.stderr) {
        throw new Error(`SSH Error: ${result.stderr}`);
      }

      // Replace localhost with public IP
      return result.stdout.replace(/127\.0\.0\.1/g, publicIp);
    } catch (error: any) {
      console.error(`Failed to retrieve kubeconfig from ${publicIp}:`, error);
      throw new Error(`Kubeconfig Retrieval Failed: ${error.message}`);
    }
  }

  /**
   * Destroy Cluster Resources
   */
  async destroy(deploymentId: string) {
    if (!deploymentId) {
      throw new Error("No deployment ID provided for destruction");
    }

    console.log(`[AWS] Destroying cluster resources for ${deploymentId}...`);

    try {
      // 1. Find Instances
      const describeRes = await this.ec2Client.send(
        new DescribeInstancesCommand({
          Filters: [
            { Name: "tag:DeploymentId", Values: [deploymentId] },
            {
              Name: "instance-state-name",
              Values: ["running", "pending", "stopped", "stopping"],
            },
          ],
        }),
      );

      const instanceIds: string[] = [];

      describeRes.Reservations?.forEach((res) => {
        res.Instances?.forEach((inst) => {
          if (inst.InstanceId) instanceIds.push(inst.InstanceId);
        });
      });

      if (instanceIds.length > 0) {
        // 2. Terminate Instances
        console.log(`[AWS] Terminating instances: ${instanceIds.join(", ")}`);
        await this.ec2Client.send(
          new TerminateInstancesCommand({ InstanceIds: instanceIds }),
        );
      } else {
        console.log(`[AWS] No active instances found for ${deploymentId}`);
      }

      // Cleanup SGs is best-effort here due to termination wait time
      return {
        success: true,
        count: instanceIds.length,
      };
    } catch (error: any) {
      console.error("[AWS] Destroy failed:", error);
      throw new Error(`AWS Destroy Failed: ${error.message}`);
    }
  }
}
