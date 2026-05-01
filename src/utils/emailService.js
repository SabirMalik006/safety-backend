import { Resend } from 'resend';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Resend with better error handling
let resend = null;
try {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && apiKey.startsWith('re_')) {
    resend = new Resend(apiKey);
    console.log('✅ Resend initialized successfully');
  } else {
    console.error('❌ Resend API key missing or invalid. Email sending disabled.');
  }
} catch (error) {
  console.error('❌ Failed to initialize Resend:', error.message);
}

// ============================================
// Main Send Email Function
// ============================================
export const sendEmail = async ({ to, subject, html, text }) => {
  // Check if Resend is initialized
  if (!resend) {
    console.error('Resend not initialized. Email not sent.');
    return { success: false, error: 'Email service not configured. Please add RESEND_API_KEY to .env' };
  }

  // Check if API key is configured
  if (!process.env.RESEND_API_KEY) {
    console.error('Resend API key not configured');
    return { success: false, error: 'RESEND_API_KEY missing in .env file' };
  }

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const fromName = process.env.RESEND_FROM_NAME || process.env.COMPANY_NAME || 'Horizon Supplies';
    
    console.log(`Attempting to send email to: ${to} from: ${fromName} <${fromEmail}>`);
    
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: subject,
      html: html,
      text: text || html?.replace(/<[^>]*>/g, ''),
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log('Email sent via Resend:', data?.id);
    return { success: true, messageId: data?.id };
    
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// 1. Send Welcome Email
// ============================================
export const sendWelcomeEmail = async (user) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #c4a47a;">Welcome to ${process.env.COMPANY_NAME || 'Horizon Supplies'}!</h2>
      <p>Dear ${user.name},</p>
      <p>Thank you for registering with us. We're excited to have you on board!</p>
      <p>You can now:</p>
      <ul>
        <li>Shop our complete range of safety equipment</li>
        <li>Track your orders in real-time</li>
        <li>Get exclusive offers and discounts</li>
      </ul>
      <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #c4a47a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
      <p style="margin-top: 20px;">Best regards,<br>${process.env.COMPANY_NAME || 'Horizon Supplies'} Team</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject: `Welcome to ${process.env.COMPANY_NAME || 'Horizon Supplies'}!`, html });
};

// ============================================
// 2. Send Forgot Password OTP
// ============================================
export const sendPasswordResetOTP = async (user, otp) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #c4a47a;">Password Reset Request</h2>
      <p>Dear ${user.name},</p>
      <p>You requested to reset your password. Use the following OTP to proceed:</p>
      <h1 style="background: #f0f0f0; padding: 20px; text-align: center; letter-spacing: 5px;">${otp}</h1>
      <p>This OTP is valid for 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Best regards,<br>${process.env.COMPANY_NAME || 'Horizon Supplies'} Team</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject: 'Password Reset OTP', html });
};

// ============================================
// 3. Send Order Confirmation
// ============================================
export const sendOrderConfirmation = async (order, user) => {
  const itemsHtml = order.orderItems.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">Rs.${item.price.toLocaleString()}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">Rs.${(item.price * item.quantity).toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #c4a47a;">Order Confirmation #${order._id.slice(-8)}</h2>
      <p>Dear ${user.name},</p>
      <p>Thank you for your order! We've received your order and will process it soon.</p>
      
      <h3>Order Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 10px;">Product</th>
            <th style="padding: 10px;">Qty</th>
            <th style="padding: 10px;">Price</th>
            <th style="padding: 10px;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      
      <div style="margin-top: 20px; text-align: right;">
        <p><strong>Subtotal:</strong> Rs.${order.itemsPrice.toLocaleString()}</p>
        <p><strong>Shipping:</strong> Rs.${order.shippingPrice.toLocaleString()}</p>
        <p><strong>Total:</strong> Rs.${order.totalPrice.toLocaleString()}</p>
      </div>
      
      <h3>Shipping Address</h3>
      <p>${order.shippingAddress.fullName}<br>
      ${order.shippingAddress.address}<br>
      ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.zipCode}<br>
      Phone: ${order.shippingAddress.phone}</p>
      
      <p>You can track your order status from your dashboard.</p>
      <a href="${process.env.FRONTEND_URL}/dashboard/orders/${order._id}" style="background: #c4a47a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Track Order</a>
      
      <p style="margin-top: 20px;">Best regards,<br>${process.env.COMPANY_NAME || 'Horizon Supplies'} Team</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject: `Order Confirmation #${order._id.slice(-8)}`, html });
};

// ============================================
// 4. Send Order Status Update
// ============================================
export const sendOrderStatusUpdate = async (order, user, oldStatus, newStatus) => {
  const statusMessages = {
    processing: 'Your order is being processed.',
    shipped: 'Your order has been shipped!',
    delivered: 'Your order has been delivered. Enjoy your purchase!',
    cancelled: 'Your order has been cancelled.'
  };
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #c4a47a;">Order Status Update</h2>
      <p>Dear ${user.name},</p>
      <p>Your order #${order._id.slice(-8)} status has been updated from <strong>${oldStatus}</strong> to <strong>${newStatus}</strong>.</p>
      <p>${statusMessages[newStatus] || ''}</p>
      ${order.trackingNumber ? `<p><strong>Tracking Number:</strong> ${order.trackingNumber}</p>` : ''}
      <a href="${process.env.FRONTEND_URL}/dashboard/orders/${order._id}" style="background: #c4a47a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Order</a>
      <p style="margin-top: 20px;">Best regards,<br>${process.env.COMPANY_NAME || 'Horizon Supplies'} Team</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject: `Order Status Update - ${newStatus.toUpperCase()}`, html });
};

// ============================================
// 5. Send Contact Message Reply to User
// ============================================
export const sendContactReply = async (contact, replyMessage) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #c4a47a;">We've received your message</h2>
      <p>Dear ${contact.name},</p>
      <p>Thank you for contacting us. Here's our response to your inquiry:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Your Message:</strong> ${contact.message}</p>
        <p><strong>Our Reply:</strong> ${replyMessage}</p>
      </div>
      <p>If you have any further questions, feel free to reach out.</p>
      <p>Best regards,<br>${process.env.COMPANY_NAME || 'Horizon Supplies'} Team</p>
    </div>
  `;
  return sendEmail({ to: contact.email, subject: `Re: ${contact.subject}`, html });
};

// ============================================
// 6. Send Contact Form Email to Admin
// ============================================
export const sendContactEmail = async (contactData) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #c4a47a;">New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${contactData.name}</p>
      <p><strong>Email:</strong> ${contactData.email}</p>
      <p><strong>Phone:</strong> ${contactData.phone || 'N/A'}</p>
      <p><strong>Subject:</strong> ${contactData.subject}</p>
      <p><strong>Message:</strong></p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
        ${contactData.message}
      </div>
      <p>Reply to this customer: ${contactData.email}</p>
    </div>
  `;
  
  const adminEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  return sendEmail({ 
    to: adminEmail, 
    subject: `New Contact: ${contactData.subject}`, 
    html 
  });
};

// ============================================
// 7. Send Payment Verification Email
// ============================================
export const sendPaymentVerificationEmail = async (order, user, status, rejectionReason = '') => {
  const statusText = status === 'approved' ? 'APPROVED ✅' : 'REJECTED ❌';
  const statusColor = status === 'approved' ? '#27ae60' : '#e74c3c';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${statusColor};">Payment Verification ${statusText}</h2>
      <p>Dear ${user.name},</p>
      <p>Your payment for order #${order._id.slice(-8)} has been <strong>${status}</strong>.</p>
      
      ${status === 'approved' ? `
        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>✓ Payment Verified!</strong></p>
          <p>Your order is now being processed. You will receive shipping updates soon.</p>
        </div>
        <a href="${process.env.FRONTEND_URL}/dashboard/orders/${order._id}" 
           style="background: #c4a47a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Track Order
        </a>
      ` : `
        <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>✗ Payment Verification Failed</strong></p>
          <p><strong>Reason:</strong> ${rejectionReason || 'Payment proof could not be verified'}</p>
          <p>Please contact our support team to resolve this issue.</p>
        </div>
        <p>If you've already paid, please contact us with your transaction details.</p>
        <a href="${process.env.FRONTEND_URL}/contact" 
           style="background: #e74c3c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Contact Support
        </a>
      `}
      
      <p style="margin-top: 20px;">Best regards,<br>${process.env.COMPANY_NAME || 'Horizon Supplies'} Team</p>
    </div>
  `;
  
  return sendEmail({ 
    to: user.email, 
    subject: `Payment Verification ${statusText} - Order #${order._id.slice(-8)}`, 
    html 
  });
};