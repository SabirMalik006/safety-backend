import { Resend } from 'resend';

// NOTE:
// This project uses ESM imports in `server.js`. Static imports are executed
// before `dotenv.config()` runs, so we must NOT read env at module-load time.
// Always read env lazily at send-time.

const stripHtmlToText = (html = '') =>
  html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const getEmailConfig = () => {
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'send@thehorizonhub.com';
  const fromName = process.env.RESEND_FROM_NAME || process.env.COMPANY_NAME || 'Horizon Supplies';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const adminContactEmail = process.env.ADMIN_CONTACT_EMAIL || 'horizonintegeratedsolutions@gmail.com';

  return { fromEmail, fromName, frontendUrl, adminContactEmail };
};

let resendClient = null;
let resendKeyUsed = null;
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  // Re-init if key changes between environments
  if (!resendClient || resendKeyUsed !== apiKey) {
    resendClient = new Resend(apiKey);
    resendKeyUsed = apiKey;
  }

  return resendClient;
};

// Generic sendEmail(to, subject, html, replyTo)
export const sendEmail = async (to, subject, html, replyTo) => {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, error: 'Email service not configured. Missing RESEND_API_KEY.' };
  }

  try {
    const { fromEmail, fromName } = getEmailConfig();

    const payload = {
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: stripHtmlToText(html)
    };

    if (replyTo) {
      payload.replyTo = replyTo;
    }

    const { data, error } = await resend.emails.send(payload);

    if (error) {
      return { success: false, error: error.message || 'Resend failed' };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    return { success: false, error: err.message || 'Email send failed' };
  }
};

// ============================================
// 1) Welcome email (New user registration)
// ============================================
export const sendWelcomeEmail = async (email, name) => {
  const company = process.env.COMPANY_NAME || 'Horizon Supplies';
  const { frontendUrl } = getEmailConfig();
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #c4a47a;">Welcome to ${company}!</h2>
      <p>Dear ${name || 'Customer'},</p>
      <p>Thank you for registering with us. We're excited to have you on board.</p>
      <p>
        <a href="${frontendUrl}/dashboard" style="background: #c4a47a; color: white; padding: 10px 18px; text-decoration: none; border-radius: 8px; display: inline-block;">
          Go to Dashboard
        </a>
      </p>
      <p style="margin-top: 18px;">Best regards,<br>${company} Team</p>
    </div>
  `;

  return sendEmail(email, `Welcome to ${company}!`, html);
};

// ============================================
// 2) Password reset email (Forgot password)
// resetToken expires in 1 hour (handled in auth controller)
// ============================================
export const sendPasswordResetEmail = async (email, name, resetToken) => {
  const company = process.env.COMPANY_NAME || 'Horizon Supplies';
  const { frontendUrl } = getEmailConfig();
  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(email)}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #c4a47a;">Reset your password</h2>
      <p>Dear ${name || 'Customer'},</p>
      <p>We received a request to reset your password. This link will expire in <strong>1 hour</strong>.</p>
      <p>
        <a href="${resetUrl}" style="background: #0f172a; color: white; padding: 10px 18px; text-decoration: none; border-radius: 8px; display: inline-block;">
          Reset Password
        </a>
      </p>
      <p style="color:#666; font-size: 13px; line-height: 1.5;">
        If you didn’t request this, you can ignore this email.
      </p>
      <p style="margin-top: 18px;">Best regards,<br>${company} Team</p>
    </div>
  `;

  return sendEmail(email, 'Password Reset', html);
};

// ============================================
// 3) Order confirmation email (Order placed)
// ============================================
export const sendOrderConfirmationEmail = async (email, name, orderDetails) => {
  const company = process.env.COMPANY_NAME || 'Horizon Supplies';
  const { frontendUrl } = getEmailConfig();
  const orderId = orderDetails?._id || orderDetails?.id || '';
  const items = orderDetails?.orderItems || orderDetails?.items || [];

  const itemsHtml = items.map((item) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">Rs.${Number(item.price || 0).toLocaleString()}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">Rs.${(Number(item.price || 0) * Number(item.quantity || 0)).toLocaleString()}</td>
    </tr>
  `).join('');

  const trackUrl = orderId ? `${frontendUrl}/dashboard/orders/${orderId}` : `${frontendUrl}/dashboard/orders`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
      <h2 style="color: #c4a47a;">Order Confirmation ${orderId ? `#${String(orderId).slice(-8)}` : ''}</h2>
      <p>Dear ${name || 'Customer'},</p>
      <p>Thank you for your order. We’ve received it and will process it soon.</p>

      <h3 style="margin: 18px 0 10px;">Order Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 10px; text-align:left;">Product</th>
            <th style="padding: 10px; text-align:left;">Qty</th>
            <th style="padding: 10px; text-align:left;">Price</th>
            <th style="padding: 10px; text-align:left;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml || '<tr><td colspan="4" style="padding: 10px;">(No items)</td></tr>'}</tbody>
      </table>

      <p style="margin-top: 18px;">
        <a href="${trackUrl}" style="background: #c4a47a; color: white; padding: 10px 18px; text-decoration: none; border-radius: 8px; display: inline-block;">
          Track Order
        </a>
      </p>

      <p style="margin-top: 18px;">Best regards,<br>${company} Team</p>
    </div>
  `;

  return sendEmail(email, `Order Confirmation${orderId ? ` #${String(orderId).slice(-8)}` : ''}`, html);
};

// ============================================
// 4) Contact form emails (admin + user auto-reply)
// userData: { name, email, phone?, subject, message }
// ============================================
export const sendContactEmails = async (userData) => {
  const company = process.env.COMPANY_NAME || 'Horizon Supplies';
  const { adminContactEmail } = getEmailConfig();

  const adminHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
      <h2 style="color: #c4a47a;">New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${userData?.name || '-'}</p>
      <p><strong>Email:</strong> ${userData?.email || '-'}</p>
      <p><strong>Phone:</strong> ${userData?.phone || 'N/A'}</p>
      <p><strong>Subject:</strong> ${userData?.subject || '-'}</p>
      <p><strong>Message:</strong></p>
      <div style="background: #f5f5f5; padding: 14px; border-radius: 10px; margin: 12px 0;">
        ${String(userData?.message || '').replace(/\n/g, '<br/>')}
      </div>
      <p style="color:#666; font-size: 13px;">Reply to: ${userData?.email || '-'}</p>
    </div>
  `;

  const userHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
      <h2 style="color: #c4a47a;">We received your message</h2>
      <p>Dear ${userData?.name || 'Customer'},</p>
      <p>Thank you for contacting ${company}. Our team has received your message and will get back to you shortly.</p>
      <div style="background: #f8fafc; padding: 14px; border-radius: 10px; margin: 12px 0;">
        <p style="margin:0;"><strong>Your Subject:</strong> ${userData?.subject || '-'}</p>
        <p style="margin:10px 0 0;"><strong>Your Message:</strong><br/>${String(userData?.message || '').replace(/\n/g, '<br/>')}</p>
      </div>
      <p style="margin-top: 18px;">Best regards,<br>${company} Team</p>
    </div>
  `;

  const [adminRes, userRes] = await Promise.all([
    sendEmail(adminContactEmail, `New Contact: ${userData?.subject || 'Message'}`, adminHtml, userData?.email),
    sendEmail(userData?.email, `We received your message - ${company}`, userHtml)
  ]);

  return { success: adminRes.success && userRes.success, admin: adminRes, user: userRes };
};

// ------------------------------------------------------------------
// Backward-compatible exports used by existing controllers
// ------------------------------------------------------------------
export const sendPasswordResetOTP = async (user, otp) => {
  // Keep old OTP email flow for current frontend (ResetPassword.jsx uses otp)
  const company = process.env.COMPANY_NAME || 'Horizon Supplies';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #c4a47a;">Password Reset OTP</h2>
      <p>Dear ${user?.name || 'Customer'},</p>
      <p>Use the following OTP to reset your password (valid for 10 minutes):</p>
      <h1 style="background: #f0f0f0; padding: 16px; text-align: center; letter-spacing: 4px;">${otp}</h1>
      <p style="margin-top: 18px;">Best regards,<br>${company} Team</p>
    </div>
  `;
  return sendEmail(user.email, 'Password Reset OTP', html);
};

export const sendOrderConfirmation = async (order, user) => {
  return sendOrderConfirmationEmail(user?.email, user?.name, order);
};

export const sendOrderStatusUpdate = async (order, user, oldStatus, newStatus) => {
  const company = process.env.COMPANY_NAME || 'Horizon Supplies';
  const { frontendUrl } = getEmailConfig();
  const orderId = order?._id || '';
  const viewUrl = orderId ? `${frontendUrl}/dashboard/orders/${orderId}` : `${frontendUrl}/dashboard/orders`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
      <h2 style="color: #c4a47a;">Order Status Update</h2>
      <p>Dear ${user?.name || 'Customer'},</p>
      <p>Your order ${orderId ? `#${String(orderId).slice(-8)}` : ''} status has been updated from <strong>${oldStatus}</strong> to <strong>${newStatus}</strong>.</p>
      <p>
        <a href="${viewUrl}" style="background: #c4a47a; color: white; padding: 10px 18px; text-decoration: none; border-radius: 8px; display: inline-block;">
          View Order
        </a>
      </p>
      <p style="margin-top: 18px;">Best regards,<br>${company} Team</p>
    </div>
  `;

  return sendEmail(user?.email, `Order Status Update - ${String(newStatus || '').toUpperCase()}`, html);
};

export const sendContactEmail = async (contactData) => {
  // Admin-only email (legacy). New flow is sendContactEmails()
  const company = process.env.COMPANY_NAME || 'Horizon Supplies';
  const { adminContactEmail } = getEmailConfig();
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
      <h2 style="color: #c4a47a;">New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${contactData?.name || '-'}</p>
      <p><strong>Email:</strong> ${contactData?.email || '-'}</p>
      <p><strong>Phone:</strong> ${contactData?.phone || 'N/A'}</p>
      <p><strong>Subject:</strong> ${contactData?.subject || '-'}</p>
      <p><strong>Message:</strong></p>
      <div style="background: #f5f5f5; padding: 14px; border-radius: 10px; margin: 12px 0;">
        ${String(contactData?.message || '').replace(/\n/g, '<br/>')}
      </div>
      <p style="color:#666; font-size: 13px;">Reply to: ${contactData?.email || '-'}</p>
      <p style="margin-top: 18px;">${company}</p>
    </div>
  `;
  return sendEmail(adminContactEmail, `New Contact: ${contactData?.subject || 'Message'}`, html, contactData?.email);
};

export const sendContactReply = async (contact, replyMessage) => {
  const company = process.env.COMPANY_NAME || 'Horizon Supplies';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
      <h2 style="color: #c4a47a;">Response to your message</h2>
      <p>Dear ${contact?.name || 'Customer'},</p>
      <div style="background: #f5f5f5; padding: 14px; border-radius: 10px; margin: 12px 0;">
        <p style="margin:0 0 8px;"><strong>Your Message:</strong><br/>${String(contact?.message || '').replace(/\n/g, '<br/>')}</p>
        <p style="margin:0;"><strong>Our Reply:</strong><br/>${String(replyMessage || '').replace(/\n/g, '<br/>')}</p>
      </div>
      <p style="margin-top: 18px;">Best regards,<br>${company} Team</p>
    </div>
  `;
  return sendEmail(contact.email, `Re: ${contact?.subject || 'Contact message'}`, html);
};

// ============================================
// Existing: Payment verification (kept as-is)
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
  
  return sendEmail(
    user.email,
    `Payment Verification ${statusText} - Order #${order._id.slice(-8)}`,
    html
  );
};