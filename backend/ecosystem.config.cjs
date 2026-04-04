module.exports = {
  apps: [
    {
      name: "justbeauty-backend",
      script: "./server.js",
      cwd: "",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
