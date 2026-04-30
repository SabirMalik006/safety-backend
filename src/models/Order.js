import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderItems: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    price: Number,
    quantity: { type: Number, required: true, min: 1 },
    image: String,
    color: String,
    size: String
  }],
  shippingAddress: {
    fullName: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
    phone: { type: String, required: true }
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cod', 'easypaisa', 'jazzcash', 'bank_transfer', 'stripe']
  },
  
  // ✅ NEW FIELDS FOR MANUAL PAYMENT VERIFICATION
  paymentProof: {
    screenshotUrl: { type: String, default: '' },     // Cloudinary URL of screenshot
    transactionId: { type: String, default: '' },     // User entered transaction ID
    paymentDate: { type: Date, default: null },       // When user paid
    paymentAccount: { type: String, default: '' },    // Which account user paid to
    remarks: { type: String, default: '' }            // User additional notes
  },
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'pending_verification', 'verified', 'failed', 'refunded'],
    default: 'pending'
  },
  
  paymentVerification: {
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    adminNotes: { type: String, default: '' }
  },
  
  orderStatus: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  
  itemsPrice: { type: Number, required: true, default: 0 },
  shippingPrice: { type: Number, required: true, default: 0 },
  totalPrice: { type: Number, required: true, default: 0 },
  trackingNumber: String,
  deliveredAt: Date,
  isPaid: { type: Boolean, default: false },
  paidAt: Date
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);