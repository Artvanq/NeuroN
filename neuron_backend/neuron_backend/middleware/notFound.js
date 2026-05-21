function notFoundHandler(req, res) {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'Not found' });
  }
  res.status(404).send('Not found');
}

module.exports = notFoundHandler;
