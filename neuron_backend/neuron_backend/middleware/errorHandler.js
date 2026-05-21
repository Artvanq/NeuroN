const { captureException } = require('../utils/sentry');

function errorHandler(err, req, res, _next) {
  console.error(err);

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
    return res.status(400).json({ message });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({ message: `${field} already exists` });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid id' });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expired' });
  }

  const status = err.status || 500;
  if (status >= 500) {
    captureException(err, {
      path: req?.path,
      method: req?.method,
    });
  }
  res.status(status).json({
    message: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;
