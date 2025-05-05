const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema({
  donor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  report: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    required: true
  },
  items: [{
    type: {
      type: String,
      enum: ['food', 'water', 'medicine', 'clothing', 'shelter', 'volunteers', 'other'],
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pledged', 'delivered', 'verified'],
      default: 'pledged'
    },
    details: String
  }],
  donationDate: {
    type: Date,
    default: Date.now
  },
  deliveryDate: Date,
  verificationDate: Date,
  comments: String,
  status: {
    type: String,
    enum: ['pledged', 'in-transit', 'delivered', 'verified'],
    default: 'pledged'
  }
});

module.exports = mongoose.model("Donation", donationSchema);