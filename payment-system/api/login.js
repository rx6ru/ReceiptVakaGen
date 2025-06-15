// api/login.js
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !JWT_SECRET) {
  console.error('FATAL ERROR: One or more environment variables are not defined.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Export the handler function directly
module.exports = async (req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { adminCode } = req.body;

    if (!adminCode) {
        return res.status(400).json({ message: 'Admin code is required.' });
    }

    try {
        const { data, error } = await supabase
            .from('admins')
            .select('name, admin_code')
            .eq('admin_code', adminCode)
            .single();

        if (error && error.code === 'PGRST116') {
            return res.status(401).json({ message: 'Invalid admin code.' });
        }

        if (error) {
            console.error('Supabase query error:', error);
            return res.status(500).json({ message: 'Internal server error during login.' });
        }

        if (!data) {
            return res.status(401).json({ message: 'Invalid admin code.' });
        }

        const adminName = data.name;
        const token = jwt.sign(
            { adminName: adminName, adminCode: adminCode },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.status(200).json({ token, adminName });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'An unexpected error occurred during login.' });
    }
};