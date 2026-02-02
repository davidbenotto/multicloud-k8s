module.exports = {
  apps: [
    {
      name: "clusters-api",
      cwd: "./apps/api",
      script: "npm",
      args: "run dev",
      interpreter: "none",
      watch: ["src"],
      ignore_watch: ["node_modules", "dist"],
      env_file: "./.env",
      restart_delay: 3000,
      env: {
        PORT: 3333,
        NODE_ENV: "development",
        DATABASE_URL:
          "postgresql://clusters:securepassword@localhost:5435/clusters_control_plane",
      },
    },
    {
      name: "clusters-web",
      cwd: "./",
      script: "./scripts/start-web.sh",
      interpreter: "/bin/bash",
      env_file: "./apps/web/.env",
      restart_delay: 5000,
      max_restarts: 10,
      env: {
        PORT: 3000,
      },
    },
  ],
};
