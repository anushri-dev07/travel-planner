const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

const verificationCodes = new Map();

function generateCode(email) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes.set(email, { code, expires: Date.now() + 300000 });
    return code;
}

function verifyCode(email, code) {
    const stored = verificationCodes.get(email);
    if (!stored) return false;
    if (Date.now() > stored.expires) {
        verificationCodes.delete(email);
        return false;
    }
    if (stored.code !== code) return false;
    verificationCodes.delete(email);
    return true;
}

async function sendVerificationEmail(email, username) {
    const code = generateCode(email);
    
    console.log('\n========================================');
    console.log('📧 EMAIL VERIFICATION CODE (DEMO)');
    console.log('========================================');
    console.log(`To: ${email}`);
    console.log(`Code: ${code}`);
    console.log('========================================\n');
    
    const mailOptions = {
        from: 'Travel Planner <travelplanner.noreply@gmail.com>',
        to: email,
        subject: 'Verify your Travel Planner account',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #0d9488, #14b8a6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0;">✈️ Travel Planner</h1>
                </div>
                <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px;">
                    <h2 style="color: #0f172a; margin-top: 0;">Hi ${username}! 👋</h2>
                    <p style="color: #374151; font-size: 16px;">Welcome to Travel Planner! Please verify your email address to get started.</p>
                    <div style="background: white; padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0; border: 2px solid #0d9488;">
                        <p style="color: #64748b; margin: 0 0 10px;">Your verification code:</p>
                        <div style="font-size: 32px; font-weight: bold; color: #0d9488; letter-spacing: 8px;">${code}</div>
                    </div>
                    <p style="color: #64748b; font-size: 14px;">This code expires in <strong>5 minutes</strong>.</p>
                    <p style="color: #94a3b8; font-size: 12px; margin-top: 30px;">If you didn't create an account, ignore this email.</p>
                </div>
            </div>
        `
    };
    
    try {
        await transporter.sendMail(mailOptions);
        return code;
    } catch (error) {
        console.log('📧 Email service not configured - check console for code!');
        return code;
    }
}

module.exports = { sendVerificationEmail, verifyCode };
