# Clusters Control Plane

A modern, multi-cloud cluster management platform designed for organization-based multi-tenancy. This platform allows administrators to manage Kubernetes clusters across various providers (AWS, Azure, GCP, On-Prem) with isolated environments for different clients.

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 🚀 Features

- **Multi-Cloud Support**: Provision and manage clusters on AWS, Azure, Google Cloud, and On-Premises.
- **Multi-Tenancy**: Organization-based isolation. Each client (Organization) has its own clusters and credentials.
- **Credential Management**: Securely store and manage cloud provider credentials per organization.
- **Admin Control**: Global view for administrators to oversee all organizations and clusters.
- **Modern UI**: Responsive, dark-mode enabled dashboard built with Next.js and Tailwind CSS.
- **Real-time Updates**: Status monitoring for cluster provisioning and health.

## 🏗 Architecture

```mermaid
graph TD
    User((User / Admin))

    subgraph "Frontend Layer"
        Next[Next.js Web App]
    end

    subgraph "Backend Layer"
        API[Express.js API]
    end

    subgraph "Data Layer"
        DB[(PostgreSQL)]
    end

    subgraph "Infrastructure Layer"
        direction LR
        AWS[AWS]
        Azure[Azure]
        GCP[GCP]
        OnPrem[On-Prem]
    end

    User -->|HTTPS| Next
    Next -->|API Requests| API
    API -->|Read/Write| DB
    API -.->|Provisioning| AWS
    API -.->|Provisioning| Azure
    API -.->|Provisioning| GCP
    API -.->|Provisioning| OnPrem

    style User fill:#f9f,stroke:#333,stroke-width:2px
    style Next fill:#61dafb,stroke:#333
    style API fill:#68a063,stroke:#333
    style DB fill:#336791,stroke:#333
```

## 🛠 Tech Stack

**Frontend (apps/web)**

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: Custom UI library with [Lucide React](https://lucide.dev/) icons
- **Animations**: [Framer Motion](https://www.framer.com/motion/)

**Backend (apps/api)**

- **Runtime**: [Node.js](https://nodejs.org/)
- **Server**: Express.js
- **Database**: PostgreSQL (managed via `pg` driver)
- **Architecture**: Service-based architecture with separated concerns

**Shared (packages/common)**

- **Types**: Shared TypeScript interfaces/types for consistent data models across frontend and backend.

## 📂 Project Structure

```
clusters/
├── apps/
│   ├── web/                 # Next.js Frontend Application
│   └── api/                 # Express.js Backend API
├── packages/
│   └── common/              # Shared Types and Utilities
├── docker/                  # Docker Configuration
└── README.md                # Project Documentation
```

## ⚡ Getting Started

### Prerequisites

- Node.js (v18+)
- Docker & Docker Compose (for the local database)

### Installation

1.  **Clone the repository**

    ```bash
    git clone <repository-url>
    cd clusters
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env` file in the root directory based on `.env.example` (or use the provided template).

    ```env
    PORT=3333
    DATABASE_URL="postgresql://clusters:securepassword@localhost:5435/clusters_control_plane"
    ENCRYPTION_KEY="<your-32-char-encryption-key>"
    ```

4.  **Start the Database**

    ```bash
    cd docker
    docker-compose up -d
    ```

5.  **Run Development Server**
    From the root directory:

    ```bash
    npm run dev
    ```

    This command starts:
    - Backend API at `http://localhost:3333`
    - Frontend App at `http://localhost:3000`

## 🔐 Credentials & Security

- **Organization Isolation**: Clusters are strictly filtered by Organization ID.
- **Encryption**: Cloud credentials (AWS Access Keys, Service Principals, etc.) turn stored using AES-256 encryption.
- **Secure Handling**: Decryption occurs only during provisioning operations within the API.

## 🛡 License

This project is licensed under the MIT License.
