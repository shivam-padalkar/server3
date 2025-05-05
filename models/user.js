const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  userType: {
    type: String,
    enum: ["donor", "admin"],
    required: true
  },
  name: String,
  phone: String,
  registeredOn: {
    type: Date,
    default: Date.now
  },
  // For donors only
  donationsMade: [
    {
      reportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Report'
      },
      requirementType: String,
      quantity: Number,
      status: {
        type: String,
        enum: ["pending", "delivered", "confirmed"],
        default: "pending"
      },
      donatedOn: {
        type: Date,
        default: Date.now
      }
    }
  ]
});

// Add passport-local-mongoose plugin for authentication
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);