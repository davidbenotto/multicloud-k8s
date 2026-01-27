import {
  EC2Client,
  RunInstancesCommand,
  CreateKeyPairCommand,
  TerminateInstancesCommand,
  CreateVpcCommand,
  CreateSubnetCommand,
  TagSpecification,
  DescribeInstancesCommand,
} from "@aws-sdk/client-ec2";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { v4 as uuidv4 } from "uuid";

interface AWSConfig {
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export class AWSProvisionerService {
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
   * Deploy EC2 Instances (Cluster Nodes)
   */
  async deployClusterNodes(
    name: string,
    nodeCount: number = 3,
    instanceType: string = "t2.micro",
  ) {
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

    // 2. Launch Instances
    const tags: TagSpecification[] = [
      {
        ResourceType: "instance",
        Tags: [
          { Key: "Name", Value: `${name}-node` },
          { Key: "DeploymentId", Value: deploymentId },
          { Key: "Cluster", Value: name },
          { Key: "ManagedBy", Value: "clusters-control-plane" },
        ],
      },
    ];

    console.log(
      `[AWS] Launching ${nodeCount} instances for cluster ${name}...`,
    );

    try {
      const response = await this.ec2Client.send(
        new RunInstancesCommand({
          ImageId: imageId,
          InstanceType: instanceType as any, // Cast to any to avoid strict enum mismatch
          MinCount: nodeCount,
          MaxCount: nodeCount,
          KeyName: keyName,
          TagSpecifications: tags,
        }),
      );

      const instances = response.Instances?.map((i) => ({
        instanceId: i.InstanceId,
        privateIp: i.PrivateIpAddress,
        state: i.State?.Name,
      }));

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
   * Destroy Cluster Resources
   */
  async destroyCluster(deploymentId: string) {
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

      return { success: true, count: instanceIds.length };
    } catch (error: any) {
      console.error("[AWS] Destroy failed:", error);
      throw new Error(`AWS Destroy Failed: ${error.message}`);
    }
  }
}
