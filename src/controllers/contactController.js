import Contact from '../models/Contact.js';
import { sendContactEmail, sendContactReply } from '../utils/emailService.js';
import { asyncHandler, AppError } from '../middleware/errorMiddleware.js';

// @desc    Submit contact form
// @route   POST /api/contact
export const submitContact = asyncHandler(async (req, res) => {
  const contact = await Contact.create(req.body);
  
  // Send email to admin and user
  await sendContactEmail(req.body);
  
  res.status(201).json({
    success: true,
    message: 'Message sent successfully'
  });
});

// @desc    Get all contacts (admin)
// @route   GET /api/contact/all
export const getAllContacts = asyncHandler(async (req, res) => {
  const contacts = await Contact.find().sort('-createdAt');
  res.json({ success: true, data: contacts });
});

// @desc    Mark as read
// @route   PUT /api/contact/:id/read
export const markAsRead = asyncHandler(async (req, res) => {
  const contact = await Contact.findById(req.params.id);
  if (!contact) throw new AppError('Contact not found', 404);
  
  contact.isRead = true;
  await contact.save();
  
  res.json({ success: true, data: contact });
});

// @desc    Delete contact
// @route   DELETE /api/contact/:id
export const deleteContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findById(req.params.id);
  if (!contact) throw new AppError('Contact not found', 404);
  
  await contact.deleteOne();
  res.json({ success: true, message: 'Contact deleted' });
});

