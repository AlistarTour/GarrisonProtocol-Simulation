module.exports = {
  apps: [{
    name: 'covenant-game',
    cwd: __dirname,
    script: 'server/index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    env: { HOST: '0.0.0.0', PORT: '3001', NODE_ENV: 'production' }
  }]
};
