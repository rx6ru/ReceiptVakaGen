// api/search.js
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const jwt = require('jsonwebtoken');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !JWT_SECRET) {
  console.error('FATAL ERROR: Environment variables are not defined.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Token verification function (inline)
function verifyToken(req) {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Access Denied: No token provided or token format is incorrect.');
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
        throw new Error('Access Denied: Token missing after Bearer.');
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new Error('Access Denied: Token expired.');
        }
        throw new Error('Access Denied: Invalid token.');
    }
}

module.exports = async (req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Verify token
        const user = verifyToken(req);
        req.user = user;
        
        const searchQuery = req.query.q;

        if (!searchQuery) {
            return res.status(400).json({ message: 'Search query (q) is required.' });
        }

        let queryBuilder = supabase
            .from('petitioners')
            .select('*');

        const orConditions = [];
        orConditions.push(`name.ilike.%${searchQuery}%`);

        if (!isNaN(searchQuery) && searchQuery.trim() !== '') {
            orConditions.push(`petitioner_number.eq.${searchQuery}`);
        }

        queryBuilder = queryBuilder.or(orConditions.join(','));
        queryBuilder = queryBuilder.order('name', { ascending: true });

        const { data, error } = await queryBuilder;

        if (error) {
            console.error('Supabase search error:', error);
            return res.status(500).json({ message: 'Error performing search.' });
        }

        if (!data || data.length === 0) {
            return res.status(200).json([]);
        }

        res.status(200).json(data);

    } catch (error) {
        if (error.message.includes('Access Denied')) {
            return res.status(401).json({ message: error.message });
        }
        console.error('An unexpected error occurred during search:', error);
        res.status(500).json({ message: 'An unexpected server error occurred.' });
    }
};