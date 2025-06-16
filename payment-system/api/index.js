// api/index.js - Fixed version
const express = require('express');

// Import route handlers (now all CommonJS)
const loginHandler = require('./login');
const verifyHandler = require('./verify');
const searchHandler = require('./search');
const confirmHandler = require('./confirm');

// Create Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// CORS headers for all routes
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// API Routes - using the handlers as middleware
app.use('/api/login', loginHandler);
app.post('/api/verify', verifyHandler);  // verify as POST endpoint
app.get('/api/search', searchHandler);   // search as GET endpoint  
app.post('/api/confirm', confirmHandler); // confirm as POST endpoint

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found.' });
});

// Export the Express API
module.exports = app;