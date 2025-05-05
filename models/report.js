const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  name: { type: String, required: true },
  message: { type: String, required: true },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  status: {
    type: String,
    enum: ["pending", "critical", "resolved"],
    required: true,
  },
  disasterType: { type: String, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  image: { type: String, required: false },
  requirements: {
    food: { 
      needed: Boolean, 
      quantity: Number,
      fulfilled: { type: Number, default: 0 },
      remainingNeeded: Number
    },
    water: { 
      needed: Boolean, 
      quantity: Number,
      fulfilled: { type: Number, default: 0 },
      remainingNeeded: Number 
    },
    medicine: { 
      needed: Boolean, 
      quantity: Number,
      fulfilled: { type: Number, default: 0 },
      remainingNeeded: Number 
    },
    clothing: { 
      needed: Boolean, 
      quantity: Number,
      fulfilled: { type: Number, default: 0 },
      remainingNeeded: Number 
    },
    shelter: { 
      needed: Boolean, 
      quantity: Number,
      fulfilled: { type: Number, default: 0 },
      remainingNeeded: Number 
    },
    volunteers: { 
      needed: Boolean, 
      quantity: Number,
      fulfilled: { type: Number, default: 0 },
      remainingNeeded: Number 
    },
    other: { 
      needed: Boolean, 
      details: String,
      fulfilled: Boolean,
      default: false
    }
  },
  reportedBy: { type: String, default: "anonymous" },
  donations: [
    {
      donorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
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
  ],
  alerts: [{
    message: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    seen: {
      type: Boolean,
      default: false
    }
  }]
});

// Middleware to calculate remaining needs before saving
reportSchema.pre('save', function(next) {
  const requirements = this.requirements;
  
  // Calculate remaining needs for each requirement type
  if (requirements) {
    if (requirements.food && requirements.food.needed) {
      requirements.food.remainingNeeded = Math.max(0, requirements.food.quantity - (requirements.food.fulfilled || 0));
    }
    if (requirements.water && requirements.water.needed) {
      requirements.water.remainingNeeded = Math.max(0, requirements.water.quantity - (requirements.water.fulfilled || 0));
    }
    if (requirements.medicine && requirements.medicine.needed) {
      requirements.medicine.remainingNeeded = Math.max(0, requirements.medicine.quantity - (requirements.medicine.fulfilled || 0));
    }
    if (requirements.clothing && requirements.clothing.needed) {
      requirements.clothing.remainingNeeded = Math.max(0, requirements.clothing.quantity - (requirements.clothing.fulfilled || 0));
    }
    if (requirements.shelter && requirements.shelter.needed) {
      requirements.shelter.remainingNeeded = Math.max(0, requirements.shelter.quantity - (requirements.shelter.fulfilled || 0));
    }
    if (requirements.volunteers && requirements.volunteers.needed) {
      requirements.volunteers.remainingNeeded = Math.max(0, requirements.volunteers.quantity - (requirements.volunteers.fulfilled || 0));
    }
  }
  next();
});

module.exports = mongoose.model("Report", reportSchema);