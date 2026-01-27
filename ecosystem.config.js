module.exports = {
  apps: [
    {
      name: "clusters-api",
      cwd: "./apps/api",
      script: "npm",
      args: "run dev",
      watch: ["src"],
      ignore_watch: ["node_modules"],
      env_file: "./.env",
      env: {
        PORT: 3333,
        NODE_ENV: "development",
        DATABASE_URL:
          "postgresql://clusters:securepassword@localhost:5435/clusters_control_plane",
      },
    },
    {
      name: "clusters-web",
      cwd: "./apps/web",
      script: "npm",
      args: "run dev",
      env_file: "./.env",
      env: {
        PORT: 3000,
      },
    },
  ],
};
