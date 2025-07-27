/**
 * Send test email reply to relay service
 */

const nodemailer = require('nodemailer');
require('dotenv').config();

async function sendTestReply() {
    console.log('📧 Sending test email reply...\n');
    
    // Create test SMTP transporter (using Gmail)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'jiaxicui446@gmail.com',
            pass: process.env.GMAIL_APP_PASSWORD || 'your-app-password'
        }
    });
    
    // Use latest token
    const testToken = 'V5UPZ1UE'; // Latest token from session-map.json
    
    const mailOptions = {
        from: 'jiaxicui446@gmail.com',
        to: 'noreply@pandalla.ai',
        subject: `Re: [Claude-Code-Remote #${testToken}] Claude Code Task Completed - Claude-Code-Remote`,
        text: 'Please explain the basic principles of quantum computing',
        replyTo: 'jiaxicui446@gmail.com'
    };
    
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Test email sent successfully!');
        console.log(`📧 Message ID: ${info.messageId}`);
        console.log(`📋 Token: ${testToken}`);
        console.log(`💬 Command: ${mailOptions.text}`);
        console.log('\n🔍 Now monitoring relay service logs...');
        
        // Wait a few seconds for email processing
        setTimeout(() => {
            console.log('\n📋 Please check relay-debug.log file for processing logs');
        }, 5000);
        
    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
    }
}

sendTestReply().catch(console.error);