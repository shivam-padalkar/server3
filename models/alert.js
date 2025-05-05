const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Track which users have seen this alert
  seenBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    seenAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Alert type (for different styling)
  alertType: {
    type: String,
    enum: ["new_disaster", "update", "donation_needed", "donation_received"],
    default: "new_disaster"
  }
});

module.exports = mongoose.model("Alert", alertSchema);