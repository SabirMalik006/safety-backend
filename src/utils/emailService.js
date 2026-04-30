const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Horizon Supplies" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html
    });
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Email Error:', error);
    return false;
  }
};

const sendWelcomeEmail = async (user) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1e3c72;">Welcome to Horizon Supplies! 🎉</h1>
      <p>Hello <strong>${user.name}</strong>,</p>
      <p>Thank you for creating an account with Horizon Supplies.</p>
      <p>Start shopping now and get the best deals!</p>
      <a href="${process.env.FRONTEND_URL}" style="display: inline-block; background: #1e3c72; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Start Shopping →</a>
    </div>
  `;
  return await sendEmail(user.email, 'Welcome to Horizon Supplies!', html);
};

const sendOrderConfirmation = async (user, order) => {
  const itemsHtml = order.orderItems.map(item => `
    <tr>
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>Rs.${item.price}</td>
      <td>Rs.${item.price * item.quantity}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h1>Order Confirmation #${order._id}</h1>
      <p>Hello ${user.name},</p>
      <p>Your order has been placed successfully!</p>
      <h2>Order Details:</h2>
      <table border="1" cellpadding="10">
        <tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>
        ${itemsHtml}
        <tr><td colspan="3"><strong>Total</strong></td><td><strong>Rs.${order.total}</strong></td></tr>
      </table>
      <p>Order Status: ${order.orderStatus}</p>
      <p>Thank you for shopping with Horizon Supplies!</p>
    </div>
  `;
  return await sendEmail(user.email, `Order Confirmation #${order._id}`, html);
};

const sendOrderStatusUpdate = async (user, order, oldStatus, newStatus) => {
  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h1>Order Status Updated</h1>
      <p>Hello ${user.name},</p>
      <p>Your order #${order._id} status has been updated from <strong>${oldStatus}</strong> to <strong>${newStatus}</strong>.</p>
      ${newStatus === 'shipped' && order.trackingNumber ? `<p>Tracking Number: ${order.trackingNumber}</p>` : ''}
    </div>
  `;
  return await sendEmail(user.email, `Order ${newStatus.toUpperCase()}`, html);
};

module.exports = {
  sendWelcomeEmail,
  sendOrderConfirmation,
  sendOrderStatusUpdate
};