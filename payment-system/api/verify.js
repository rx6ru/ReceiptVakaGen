// api/verify.js - Fixed for Vercel serverless
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
}

// Export as serverless function handler
module.exports = async (req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Access Denied: No token provided or token format is incorrect.' });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Access Denied: Token missing after Bearer.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        res.status(200).json({ valid: true, user: decoded });
        
    } catch (err) {
        console.error('Token verification error:', err);
        
        if (err.name === 'TokenExpiredError') {
            return res.status(403).json({ message: 'Access Denied: Token expired.' });
        }
        return res.status(403).json({ message: 'Access Denied: Invalid token.' });
    }
};