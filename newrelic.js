'use strict';

exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'SoulTale API'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  distributed_tracing: { enabled: true },
  application_logging: {
    enabled: true,
    forwarding: {
      enabled: true,
      max_samples_stored: 10000,
    },
    metrics: { enabled: true },
    local_decorating: { enabled: false },
  },
  logging: { level: 'info' },
};
