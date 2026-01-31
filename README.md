# Clusters Control Plane

<div align="center">

![Clusters Dashboard](./architecture.jpg)

![Status](https://img.shields.io/badge/status-production--ready-success.svg?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14.0-black?style=flat-square&logo=next.js&logoColor=white)

**A unified, multi-tenant Kubernetes management platform built for the enterprise.**
Orchestrate clusters across AWS, Azure, GCP, and On-Premises environments with strict organization-based isolation and role-based access control.

</div>

---

## 🚀 Key Features

### 🏢 Enterprise Multi-Tenancy

- **Strict Isolation**: Resources (Clusters, Credentials) are strictly scoped to Organizations. Users in "Org A" cannot see or touch "Org B" resources.
- **Role-Based Access Control (RBAC)**:
  - **Admin Mode**: Global oversight for platform administrators.
  - **User Mode**: Restricted access within assigned organizations.
- **Context Switching**: Seamlessly toggle between organizations via the UI.

### ☁️ Unified Provider Strategy

- **One Interface, Any Cloud**: Normalized operations for **AWS**, **Azure**, **GCP**, and **On-Prem** (SSH) providers.
- **Strategy Pattern**: Extensible backend architecture (`ClusterProvider` interface) allowing easy addition of new cloud providers.
- **Active Validation**: Real-time API verification for all credentials:
  - **AWS**: STS Identity Check
  - **Azure**: Resource Group Listing
  - **GCP**: Service Account Authentication
  - **On-Prem**: SSH Connection Test

### 🔒 Security First

- **Encryption at Rest**: All sensitive credentials (API Keys, SSH Keys) are AES-256 encrypted before storage.
- **Secure Provisioning**: Keys are decrypted only in memory during provisioning operations.
- **Audit Ready**: Deployment IDs and tags trace every resource back to its creator and organization.

---

## 🏗 Architecture & Tech Stack

The platform is built on a modern, type-safe stack designed for reliability and scale.

| Domain             | Technology                                                                                                                                |
| :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**       | [Next.js 14](https://nextjs.org/) (App Router), [Tailwind CSS](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/) |
| **Backend**        | [Node.js](https://nodejs.org/), [Express.js](https://expressjs.com/), [TypeScript](https://www.typescriptlang.org/)                       |
| **Database**       | [PostgreSQL](https://www.postgresql.org/) (with `pg` driver)                                                                              |
| **Infrastructure** | Docker, Docker Compose                                                                                                                    |
| **Cloud SDKs**     | AWS SDK v3, Azure Identity/ARM, Google Cloud Compute, Node-SSH                                                                            |

---

## ⚡ Getting Started

### Prerequisites

- Node.js v18+
- Docker & Docker Compose
- PostgreSQL (if not using Docker)

### Installation

1.  **Clone the repository**

    ```bash
    git clone <repository-url>
    cd clusters
    ```

2.  **Install Dependencies**

    ```bash
    # Install root and workspace dependencies
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory:

    ```env
    PORT=3333
    DATABASE_URL="postgresql://clusters:securepassword@localhost:5435/clusters_control_plane"
    ENCRYPTION_KEY="<generate-random-32-char-string>"
    ```

4.  **Start Services**

    ```bash
    # Start Database
    cd docker && docker-compose up -d

    # Run Development Server (Frontend + Backend)
    npm run dev
    ```

    - **Frontend**: [http://localhost:3000](http://localhost:3000)
    - **Backend API**: [http://localhost:3333](http://localhost:3333)

---

## 🛡️ Admin & Security Guide

### Managing Access

To test RBAC features:

1.  Navigate to the **Sidebar**.
2.  Use the **Admin Mode** toggle (bottom).
    - **OFF**: Simulates a regular user (scoped views).
    - **ON**: Grants full visibility across all organizations.

### Credential Safety

- Never commit `.env` files.
- Ensure `ENCRYPTION_KEY` is kept secret and backed up; losing it renders stored credentials unreadable.

---

## 🤝 Contributing

We welcome contributions! Please follow the `ClusterProvider` interface pattern when adding new cloud integrations.

## 📄 License

MIT © 2024 Cluster Control Plane
