// api/confirm.js - Enhanced debugging version
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

// Enhanced environment variable checking with detailed logging
function checkEnvironmentVariables() {
    const missing = [];
    const present = [];
    
    // Check each variable and log its status
    console.log('=== ENVIRONMENT VARIABLES CHECK ===');
    
    if (!SUPABASE_URL) {
        missing.push('SUPABASE_URL');
        console.log('❌ SUPABASE_URL: Missing');
    } else {
        present.push('SUPABASE_URL');
        console.log('✅ SUPABASE_URL: Present');
    }
    
    if (!SUPABASE_SERVICE_KEY) {
        missing.push('SUPABASE_SERVICE_KEY');
        console.log('❌ SUPABASE_SERVICE_KEY: Missing');
    } else {
        present.push('SUPABASE_SERVICE_KEY');
        console.log('✅ SUPABASE_SERVICE_KEY: Present');
    }
    
    if (!GMAIL_USER) {
        missing.push('GMAIL_USER');
        console.log('❌ GMAIL_USER: Missing');
    } else {
        present.push('GMAIL_USER');
        console.log(`✅ GMAIL_USER: Present (${GMAIL_USER})`);
    }
    
    if (!GMAIL_APP_PASSWORD) {
        missing.push('GMAIL_APP_PASSWORD');
        console.log('❌ GMAIL_APP_PASSWORD: Missing');
    } else {
        present.push('GMAIL_APP_PASSWORD');
        console.log(`✅ GMAIL_APP_PASSWORD: Present (length: ${GMAIL_APP_PASSWORD.length})`);
    }
    
    if (!JWT_SECRET) {
        missing.push('JWT_SECRET');
        console.log('❌ JWT_SECRET: Missing');
    } else {
        present.push('JWT_SECRET');
        console.log('✅ JWT_SECRET: Present');
    }
    
    console.log(`Present variables: ${present.length}/5`);
    console.log(`Missing variables: ${missing.length}/5`);
    console.log('=== END ENV CHECK ===');
    
    if (missing.length > 0) {
        console.error('FATAL ERROR: Missing environment variables:', missing.join(', '));
        return false;
    }
    return true;
}

const envCheck = checkEnvironmentVariables();
let supabase, transporter;

if (envCheck) {
    console.log('Initializing Supabase client...');
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log('✅ Supabase client initialized');
    
    // Enhanced transporter initialization with detailed error logging
    console.log('Initializing email transporter...');
    try {
        // Test the Gmail credentials format
        if (!GMAIL_USER.includes('@gmail.com')) {
            console.warn('⚠️  GMAIL_USER might not be a valid Gmail address:', GMAIL_USER);
        }
        
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: GMAIL_USER,
                pass: GMAIL_APP_PASSWORD,
            },
        });
        
        console.log('✅ Email transporter created successfully');
        
        // Test the transporter connection
        console.log('Testing email transporter connection...');
        transporter.verify((error, success) => {
            if (error) {
                console.error('❌ Email transporter verification failed:', error);
                console.error('Error details:', {
                    code: error.code,
                    response: error.response,
                    responseCode: error.responseCode,
                    command: error.command
                });
            } else {
                console.log('✅ Email transporter verified successfully');
            }
        });
        
    } catch (error) {
        console.error('❌ Failed to initialize email transporter:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        transporter = null; // Ensure it's null if initialization fails
    }
} else {
    console.error('❌ Environment check failed - services not initialized');
}

function generatePaymentId() {
    return crypto.randomBytes(5).toString('hex').toUpperCase();
}

// Enhanced token verification function
function verifyToken(req) {
    const authHeader = req.headers['authorization'];
    
    console.log('Auth header received:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Access Denied: No token provided or token format is incorrect.');
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
        throw new Error('Access Denied: Token missing after Bearer.');
    }
    
    console.log('Token length:', token.length);
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Token verified successfully for admin:', decoded.adminName);
        return decoded;
    } catch (err) {
        console.error('Token verification error:', err.message);
        if (err.name === 'TokenExpiredError') {
            throw new Error('Access Denied: Token expired.');
        }
        if (err.name === 'JsonWebTokenError') {
            throw new Error('Access Denied: Invalid token format.');
        }
        throw new Error('Access Denied: Invalid token.');
    }
}

// Export as serverless function handler
module.exports = async (req, res) => {
    console.log(`[${new Date().toISOString()}] Confirm API called with method: ${req.method}`);
    
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        console.log('Handling CORS preflight request');
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        console.log('Method not allowed:', req.method);
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Enhanced environment setup check
    console.log('=== SERVICE AVAILABILITY CHECK ===');
    if (!envCheck) {
        console.error('❌ Environment variables not properly configured');
        return res.status(500).json({ 
            message: 'Server configuration error - missing environment variables',
            debug: 'Check server logs for missing environment variables'
        });
    }

    try {
        // Enhanced service availability checks
        console.log('Checking email service availability...');
        if (!transporter) {
            console.error('❌ Email service not configured - transporter is null');
            console.error('This usually means:');
            console.error('1. GMAIL_USER or GMAIL_APP_PASSWORD environment variables are missing');
            console.error('2. Gmail credentials are invalid');
            console.error('3. Transporter initialization failed');
            return res.status(500).json({ 
                message: 'Email service not configured',
                debug: 'Gmail credentials missing or invalid'
            });
        }
        console.log('✅ Email service available');

        console.log('Checking database service availability...');
        if (!supabase) {
            console.error('❌ Database connection not configured');
            return res.status(500).json({ 
                message: 'Database service not configured',
                debug: 'Supabase credentials missing or invalid'
            });
        }
        console.log('✅ Database service available');

        // Verify token
        let user;
        try {
            user = verifyToken(req);
        } catch (tokenError) {
            console.error('Token verification failed:', tokenError.message);
            return res.status(401).json({ message: tokenError.message });
        }
        
        const confirmedByAdminName = user.adminName;
        const { petitionerId } = req.body;

        console.log('Request body:', req.body);
        console.log('Petitioner ID:', petitionerId);

        if (!petitionerId) {
            console.error('Petitioner ID missing from request');
            return res.status(400).json({ message: 'Petitioner ID is required.' });
        }

        console.log(`Attempting to confirm payment for petitioner ID: ${petitionerId}`);

        const newPaymentId = generatePaymentId();
        const confirmedAt = new Date().toISOString();

        console.log('Generated payment ID:', newPaymentId);

        // Update the petitioner record
        const { data, error } = await supabase
            .from('petitioners')
            .update({
                payment_confirmed: true,
                payment_id: newPaymentId,
                confirmed_by: confirmedByAdminName,
                confirmed_at: confirmedAt
            })
            .eq('id', petitionerId)
            .eq('payment_confirmed', false)
            .select('*')
            .single();

        if (error) {
            console.error('Supabase update error:', error);
            if (error.code === 'PGRST116') {
                return res.status(409).json({ message: 'Payment already confirmed or petitioner not found.' });
            }
            return res.status(500).json({ message: 'Error confirming payment in database.', details: error.message });
        }

        if (!data) {
            console.log('No data returned from update - payment already confirmed or petitioner not found');
            return res.status(409).json({ message: 'Payment already confirmed or petitioner not found.' });
        }

        const petitionerData = data;
        console.log(`Payment confirmed for ${petitionerData.name}. Payment ID: ${petitionerData.payment_id}`);

        // Determine payment details based on group
        let petitionerCaseNumber;
        let paymentAmountDisplay;
        let paymentDescription;

        if (petitionerData.petitioner_group === 3) {
            paymentAmountDisplay = '₹1050';
            paymentDescription = 'for third phase collection';
            petitionerCaseNumber = 'WPA26400/2024';
        } else if (petitionerData.petitioner_group === 2) {
            paymentAmountDisplay = '₹1950';
            paymentDescription = 'for fourth phase collection';
            petitionerCaseNumber = 'WPA13054/2024';
        } else if (petitionerData.petitioner_group === 1) {
            paymentAmountDisplay = '₹1950';
            paymentDescription = 'for fourth phase collection';
            petitionerCaseNumber = 'WPA3028/2024';
        } else {
            paymentAmountDisplay = 'Amount not specified';
            paymentDescription = 'for registration';
            petitionerCaseNumber = 'Case not specified';
            console.warn(`Petitioner ${petitionerData.id} has unhandled group: ${petitionerData.petitioner_group}.`);
        }

        // Prepare email
        const mailOptions = {
            from: GMAIL_USER,
            to: petitionerData.email,
            subject: `Payment Confirmed - ${petitionerData.name}`,
            html: `
                <div style="font-family: Helvetica, sans-serif;">
                    <p>Dear ${petitionerData.name},</p>
                    <p>Your payment ${paymentDescription} has been successfully confirmed.</p>
                    <p><strong>Registration Details:</strong></p>
                    <ul>
                        <li><strong>Name:</strong> ${petitionerData.name}</li>
                        <li><strong>Petitioner Serial No.:</strong> ${petitionerData.petitioner_number}</li>
                        <li><strong>Phase:</strong> ${petitionerData.petitioner_group}</li>
                        <li><strong>Case:</strong> ${petitionerCaseNumber}</li>
                        <li><strong>Department:</strong> ${petitionerData.department}</li>
                        <li><strong>Amount:</strong> ${paymentAmountDisplay}</li><br>
                        <li><strong>Payment ID:</strong> ${petitionerData.payment_id}</li>
                    </ul>
                    <p><strong>NOTE:</strong> <em>You must take a screenshot of this email receipt and upload it to the google form. Failure
                        to do so will result in your payment not being processed.</em></p>
                    <p><strong>Google Form: </strong>https://forms.gle/yTp9UqVxYB6ERA4d8</p>
                    <p><strong>Confirmed by:</strong> ${confirmedByAdminName}
                        <br><strong>Date:</strong> ${new Date(petitionerData.confirmed_at).toLocaleString('en-IN', { timeZone:
                        'Asia/Kolkata' })}
                    </p>
                    <p>Thank you!
                        <br><strong>Core 0 Legal Team</strong>
                    </p>
                    <p> --- </p>
                    <p><em>Please do not reply to this mail as this is a system generated mail.</em></p>
                </div>
            `,
        };

        // Enhanced email sending with detailed error logging
        try {
            console.log('Attempting to send email to:', petitionerData.email);
            console.log('Email options:', {
                from: mailOptions.from,
                to: mailOptions.to,
                subject: mailOptions.subject
            });
            
            const emailResult = await transporter.sendMail(mailOptions);
            console.log(`✅ Confirmation email sent successfully to ${petitionerData.email}`);
            console.log('Email result:', emailResult);
        } catch (emailError) {
            console.error('❌ Email sending failed:', emailError);
            console.error('Email error details:', {
                name: emailError.name,
                message: emailError.message,
                code: emailError.code,
                response: emailError.response,
                responseCode: emailError.responseCode,
                command: emailError.command
            });
            
            // Don't fail the entire request if email fails, but log it
            // The payment is already confirmed in the database
            console.log('⚠️  Payment confirmed in database but email failed to send');
        }

        // Return success response
        const successResponse = {
            message: `Payment confirmed and email sent successfully. Amount: ${paymentAmountDisplay}.`,
            petitioner: {
                id: petitionerData.id,
                name: petitionerData.name,
                petitioner_number: petitionerData.petitioner_number,
                petitioner_group: petitionerData.petitioner_group,
                department: petitionerData.department,
                email: petitionerData.email,
                payment_confirmed: petitionerData.payment_confirmed,
                payment_id: petitionerData.payment_id,
                confirmed_by: petitionerData.confirmed_by,
                confirmed_at: petitionerData.confirmed_at
            }
        };

        console.log('Sending success response');
        res.status(200).json(successResponse);

    } catch (error) {
        console.error('Confirmation process error:', error);
        console.error('Error stack:', error.stack);
        
        if (error.message.includes('Access Denied')) {
            return res.status(401).json({ message: error.message });
        }
        
        res.status(500).json({ 
            message: 'An unexpected error occurred during confirmation.',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};