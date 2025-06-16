// api/confirm.js - Fixed for Vercel serverless
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

// Check environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GMAIL_USER || !GMAIL_APP_PASSWORD || !JWT_SECRET) {
    console.error('FATAL ERROR: One or more environment variables are not defined.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Initialize transporter only if credentials are available
let transporter;
if (GMAIL_USER && GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
            user: GMAIL_USER,
            pass: GMAIL_APP_PASSWORD,
        },
    });
}

function generatePaymentId() {
    return crypto.randomBytes(5).toString('hex').toUpperCase();
}

// Token verification function
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

// Export as serverless function handler
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

    try {
        // Check if required services are available
        if (!transporter) {
            console.error('Email service not configured - missing GMAIL credentials');
            return res.status(500).json({ message: 'Email service not configured' });
        }

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

        if (!petitionerId) {
            return res.status(400).json({ message: 'Petitioner ID is required.' });
        }

        console.log(`Attempting to confirm payment for petitioner ID: ${petitionerId}`);

        const newPaymentId = generatePaymentId();
        const confirmedAt = new Date().toISOString();

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
            return res.status(500).json({ message: 'Error confirming payment in database.' });
        }

        if (!data) {
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

        // Send email
        try {
            await transporter.sendMail(mailOptions);
            console.log(`Confirmation email sent to ${petitionerData.email}`);
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            // Don't fail the entire request if email fails, but log it
            // The payment is already confirmed in the database
        }

        // Return success response
        res.status(200).json({
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
        });

    } catch (error) {
        console.error('Confirmation process error:', error);
        
        if (error.message.includes('Access Denied')) {
            return res.status(401).json({ message: error.message });
        }
        
        res.status(500).json({ 
            message: 'An unexpected error occurred during confirmation.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};