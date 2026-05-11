module.exports = {
  apps: [
    {
      name: "scriptpilot",
      script: "npm",
      args: "run start",
      interpreter: "none",
      cwd: __dirname,
      watch: false,
      autorestart: true,
      instances: 1,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production"
      },
      env_production: {
        NODE_ENV: "production"
      },
      env_file: ".env.production",
      out_file: "logs/scriptpilot.out.log",
      error_file: "logs/scriptpilot.error.log",
      merge_logs: true
    }
  ]
};
