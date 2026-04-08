const RateLimit = require('express-rate-limit');

const loginLimiter = RateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { success: false, error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  loginLimiter
};
