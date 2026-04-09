module.exports = {
  apps: [
    {
      name: 'aetherion-core',
      script: './app.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '700M',
      restart_delay: 3000,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        CORS_ORIGINS: 'https://reaching-posting-agriculture-learning.trycloudflare.com',
        SESSION_COOKIE_SAMESITE: 'none',
        SESSION_COOKIE_SECURE: 'true',
        SESSION_SECRET: 'your-secret-key-here',
        MC_SERVER_HOST: '127.0.0.1',
        MC_SERVER_PORT: 25565,
        MC_RCON_HOST: '127.0.0.1',
        MC_RCON_PORT: 25575,
        MC_RCON_PASSWORD: process.env.MC_RCON_PASSWORD || '622d67c16f1f418f82ec47a4',
        KIT_CREATE_COMMAND_TEMPLATE: process.env.KIT_CREATE_COMMAND_TEMPLATE || 'cmi kiteditor new {name}',
        KIT_DELETE_COMMAND_TEMPLATE: process.env.KIT_DELETE_COMMAND_TEMPLATE || 'cmi removekit {name}',
        KIT_HELP_COMMAND: process.env.KIT_HELP_COMMAND || 'cmi kit'
      }
    }
  ]
};
