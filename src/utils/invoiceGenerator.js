import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateInvoicePDF = (order, user) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      
      // Header
      doc.fontSize(20)
        .font('Helvetica-Bold')
        .text(`${process.env.COMPANY_NAME}`, { align: 'center' })
        .fontSize(10)
        .font('Helvetica')
        .text(process.env.COMPANY_ADDRESS, { align: 'center' })
        .text(`Tel: ${process.env.COMPANY_PHONE} | Email: ${process.env.COMPANY_EMAIL}`, { align: 'center' })
        .moveDown();
      
      // Line separator
      doc.strokeColor('#c4a47a').lineWidth(2).moveTo(50, 120).lineTo(550, 120).stroke();
      
      // Invoice Title
      doc.fontSize(16)
        .font('Helvetica-Bold')
        .text('TAX INVOICE', { align: 'center' })
        .moveDown();
      
      // Invoice Details
      doc.fontSize(10)
        .font('Helvetica')
        .text(`Invoice No: INV-${order._id.slice(-10)}`, 50, 160)
        .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 400, 160)
        .text(`Order ID: ${order._id}`, 50, 180)
        .text(`Payment Method: ${order.paymentMethod.toUpperCase()}`, 400, 180)
        .moveDown();
      
      // Billing & Shipping
      doc.fontSize(10)
        .font('Helvetica-Bold')
        .text('Bill To:', 50, 220);
      doc.font('Helvetica')
        .text(user.name, 50, 235)
        .text(user.email, 50, 250);
      
      doc.font('Helvetica-Bold')
        .text('Ship To:', 350, 220);
      doc.font('Helvetica')
        .text(order.shippingAddress.fullName, 350, 235)
        .text(order.shippingAddress.address, 350, 250)
        .text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.zipCode}`, 350, 265)
        .text(`Phone: ${order.shippingAddress.phone}`, 350, 280);
      
      // Table Header
      let y = 320;
      doc.fillColor('#f5f5f5').rect(50, y, 500, 20).fill();
      doc.fillColor('#000000')
        .font('Helvetica-Bold')
        .text('Product', 60, y + 5)
        .text('Qty', 300, y + 5)
        .text('Price', 380, y + 5)
        .text('Total', 460, y + 5);
      
      // Table Rows
      y += 25;
      order.orderItems.forEach((item, index) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        
        doc.font('Helvetica')
          .text(item.name.substring(0, 40), 60, y)
          .text(item.quantity.toString(), 300, y)
          .text(`Rs.${item.price.toLocaleString()}`, 380, y)
          .text(`Rs.${(item.price * item.quantity).toLocaleString()}`, 460, y);
        y += 20;
      });
      
      // Totals
      y += 20;
      doc.font('Helvetica-Bold')
        .text(`Subtotal: Rs.${order.itemsPrice.toLocaleString()}`, 400, y);
      y += 15;
      doc.text(`Shipping: Rs.${order.shippingPrice.toLocaleString()}`, 400, y);
      y += 15;
      doc.fontSize(12)
        .fillColor('#c4a47a')
        .text(`Total: Rs.${order.totalPrice.toLocaleString()}`, 400, y);
      
      // Footer
      doc.fontSize(8)
        .fillColor('#888888')
        .text('Thank you for your business!', 50, 750, { align: 'center' })
        .text('This is a computer generated invoice, no signature required.', 50, 765, { align: 'center' });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Controller function
export const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('user');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const pdfBuffer = await generateInvoicePDF(order, order.user);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};