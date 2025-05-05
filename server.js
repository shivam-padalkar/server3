const express = require("express");
const mongoose = require("mongoose");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const path = require("path");
const multer = require("multer");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const axios = require("axios");

// Load environment variables
dotenv.config();

// Models
const Report = require("./models/report.js");
const User = require("./models/user.js");
const Alert = require("./models/alert.js");

const app = express();
const MONGO_URL = "mongodb://127.0.0.1:27017/disasterDB";

const fs = require("fs");

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME || 'qwertyisop91@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'ijsa exre kvfa oqjs'
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Test email connection on startup
transporter.verify(function(error, success) {
  if (error) {
    console.log("Email configuration error:", error);
  } else {
    console.log("Email server is ready to send messages");
  }
});

// File upload configuration
const uploadPath = "public/uploads";

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// MongoDB Connection
main()
  .then(() => console.log("Connected to Database"))
  .catch((err) => console.log("DB Connection Error:", err));

async function main() {
  await mongoose.connect(MONGO_URL);
}

// Add this function to test email sending directly
async function testEmailSending() {
  try {
    console.log("Testing email configuration...");
    console.log(`Using email: ${process.env.EMAIL_USERNAME}`);
    
    const mailOptions = {
      from: '"Disaster Management Test" <noreply@disastermanage.com>',
      to: process.env.EMAIL_USERNAME,
      subject: "Test Email from Disaster Management App",
      html: "<h2>This is a test email</h2><p>If you're seeing this, email sending is working correctly!</p>"
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log("Test email sent successfully!");
    console.log(info);
    return true;
  } catch (error) {
    console.error("Failed to send test email:");
    console.error(error);
    return false;
  }
}

// Uncomment to run the test on server start
// testEmailSending();

// Create default admin if not exists
async function createDefaultAdmin() {
  try {
    // Check if admin exists
    const adminExists = await User.findOne({ userType: "admin" });
    
    if (!adminExists) {
      // Register a new admin user
      const newAdmin = new User({
        username: "admin",
        email: "admin@disastermanage.com",
        userType: "admin",
        name: "System Administrator"
      });
      
      // Use passport-local-mongoose register method to hash password
      await User.register(newAdmin, "admin123");
      console.log("Default admin created with username: 'admin' and password: 'admin123'");
    }
  } catch (err) {
    console.log("Error creating default admin:", err);
  }
}

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || "this-should-be-a-better-secret",
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // expires in a week
    maxAge: 1000 * 60 * 60 * 24 * 7
  },
  store: MongoStore.create({
    mongoUrl: MONGO_URL,
    touchAfter: 24 * 60 * 60 // in seconds
  })
};

// View Engine Setup
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use(session(sessionConfig));
app.use(flash());

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Global middleware for template access
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// Middleware to check if user is logged in
const isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.returnTo = req.originalUrl;
    req.flash('error', 'You must be signed in first!');
    return res.redirect('/login');
  }
  next();
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.userType !== "admin") {
    req.flash('error', 'Access denied. Admin privileges required.');
    return res.redirect('/reports');
  }
  next();
};

// Middleware to check if user is a donor
const isDonor = (req, res, next) => {
  if (!req.user || req.user.userType !== "donor") {
    req.flash('error', 'Access denied. Donor privileges required.');
    return res.redirect('/reports');
  }
  next();
};

app.get("/admin/email-test", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const mailOptions = {
      from: '"Disaster Management" <noreply@disastermanage.com>',
      to: req.user.email,
      subject: "Test Email",
      html: "<h2>This is a test email</h2><p>If you're seeing this, email sending is working correctly!</p>"
    };
    
    await transporter.sendMail(mailOptions);
    req.flash("success", "Test email sent successfully!");
    res.redirect("/admin");
  } catch (error) {
    console.error("Test email error:", error);
    req.flash("error", "Failed to send test email: " + error.message);
    res.redirect("/admin");
  }
});

app.get("/admin/email-settings", isLoggedIn, isAdmin, async (req, res) => {
  res.render("admin/email-settings", { 
    emailUsername: process.env.EMAIL_USERNAME || "Not configured"
  });
});


// Route for creating a new alert and notifying users
async function createAlert(title, message, reportId, alertType = "new_disaster") {
  try {
    // Create new alert
    const newAlert = new Alert({
      title,
      message,
      reportId,
      alertType
    });
    
    await newAlert.save();
    
    // Get all users to notify them
    const allUsers = await User.find({});
    
    // Get the report details
    const report = await Report.findById(reportId);
    
    // Send emails to all users
    for (const user of allUsers) {
      const mailOptions = {
        from: '"Disaster Management" <noreply@disastermanage.com>',
        to: user.email,
        subject: `ALERT: ${title}`,
        html: `
          <h2>${title}</h2>
          <p>${message}</p>
          <p>Disaster Type: ${report.disasterType}</p>
          <p>Location: Lat ${report.location.lat}, Lng ${report.location.lng}</p>
          <p>Status: ${report.status}</p>
          <p><a href="http://localhost:8080/reports/${reportId}">View Details</a></p>
        `
      };
      
      try {
        // Actually send the email (removed the commenting)
        await transporter.sendMail(mailOptions);
        console.log(`Alert email sent to ${user.email}: ${title}`);
      } catch (emailError) {
        console.error(`Failed to send email to ${user.email}:`, emailError);
      }
    }
    
    return newAlert;
  } catch (error) {
    console.error("Error creating alert:", error);
    return null;
  }
}

// Helper function to check for unfulfilled requirements
function hasUnfulfilledRequirements(report) {
  if (!report.requirements) return false;
  
  const r = report.requirements;
  
  return (
    (r.food?.needed && (r.food.remainingNeeded > 0)) ||
    (r.water?.needed && (r.water.remainingNeeded > 0)) ||
    (r.medicine?.needed && (r.medicine.remainingNeeded > 0)) ||
    (r.clothing?.needed && (r.clothing.remainingNeeded > 0)) ||
    (r.shelter?.needed && (r.shelter.remainingNeeded > 0)) ||
    (r.volunteers?.needed && (r.volunteers.remainingNeeded > 0)) ||
    (r.other?.needed && !r.other.fulfilled)
  );
}

// 🌐 Root Route
app.get("/", (req, res) => {
  res.redirect("/home");
});

// Auth Routes
app.get("/register", (req, res) => {
  res.render("auth/register");
});

app.post("/register", async (req, res) => {
  try {
    const { username, password, email, name, phone } = req.body;
    
    const user = new User({
      username,
      email,
      name,
      phone,
      userType: "donor" // Only donors can register this way
    });
    
    const registeredUser = await User.register(user, password);
    
    req.login(registeredUser, err => {
      if (err) return next(err);
      req.flash("success", "Welcome to Disaster Management!");
      res.redirect("/reports");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/register");
  }
});

app.get("/login", (req, res) => {
  res.render("auth/login");
});

app.post("/login", passport.authenticate("local", {
  failureFlash: true,
  failureRedirect: "/login"
}), (req, res) => {
  req.flash("success", "Welcome back!");
  const redirectUrl = req.session.returnTo || "/reports";
  delete req.session.returnTo;
  res.redirect(redirectUrl);
});

app.get("/logout", (req, res) => {
  req.logout();
  req.flash("success", "Goodbye!");
  res.redirect("/home");
});

// Admin Dashboard
app.get("/admin", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const reports = await Report.find({}).sort({ createdAt: -1 });
    const users = await User.find({ userType: "donor" });
    const alerts = await Alert.find({}).sort({ createdAt: -1 }).limit(10);
    
    res.render("admin/dashboard", { reports, users, alerts });
  } catch (error) {
    req.flash("error", "Error fetching admin data!");
    res.redirect("/reports");
  }
});

// Utility route for testing email functionality
app.get("/test-email", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const mailOptions = {
      from: '"Disaster Management" <noreply@disastermanage.com>',
      to: req.user.email,
      subject: "Test Email",
      html: "<h2>This is a test email</h2><p>If you're seeing this, email sending is working correctly!</p>"
    };
    
    await transporter.sendMail(mailOptions);
    req.flash("success", "Test email sent successfully!");
    res.redirect("/admin");
  } catch (error) {
    console.error("Test email error:", error);
    req.flash("error", "Failed to send test email: " + error.message);
    res.redirect("/admin");
  }
});

// Donor Dashboard
app.get("/donor/dashboard", isLoggedIn, isDonor, async (req, res) => {
  try {
    const donor = await User.findById(req.user._id);
    const donationsMade = donor.donationsMade || [];
    
    // Get reports with active requirements
    const reportsWithNeeds = await Report.find({}).sort({ createdAt: -1 });
    
    // Get unread alerts
    const alerts = await Alert.find({
      "seenBy.userId": { $ne: req.user._id }
    }).sort({ createdAt: -1 }).limit(10);
    
    res.render("donor/dashboard", {
      donor,
      donationsMade,
      reportsWithNeeds,
      alerts
    });
  } catch (error) {
    req.flash("error", "Error fetching donor dashboard!");
    res.redirect("/reports");
  }
});

// Alert Routes
app.get("/alerts", isLoggedIn, async (req, res) => {
  try {
    const alerts = await Alert.find({})
      .sort({ createdAt: -1 })
      .populate("reportId");
    
    // Mark alerts as seen for this user
    for (let alert of alerts) {
      if (!alert.seenBy.some(seen => seen.userId.equals(req.user._id))) {
        alert.seenBy.push({
          userId: req.user._id,
          seenAt: new Date()
        });
        await alert.save();
      }
    }
    
    res.render("alerts/index", { alerts });
  } catch (error) {
    req.flash("error", "Error fetching alerts!");
    res.redirect("/reports");
  }
});

// Donation Routes
app.get("/donate/:reportId", isLoggedIn, isDonor, async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await Report.findById(reportId);
    
    if (!report) {
      req.flash("error", "Report not found!");
      return res.redirect("/reports");
    }
    
    res.render("donor/donate", { report });
  } catch (error) {
    req.flash("error", "Error loading donation page!");
    res.redirect("/reports");
  }
});

app.post("/donate/:reportId", isLoggedIn, isDonor, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { requirementType, quantity } = req.body;
    
    // Find the report
    const report = await Report.findById(reportId);
    
    if (!report) {
      req.flash("error", "Report not found!");
      return res.redirect("/reports");
    }
    
    // Create donation record
    const donation = {
      donorId: req.user._id,
      requirementType,
      quantity: parseInt(quantity),
      status: "pending",
      donatedOn: new Date()
    };
    
    // Add to report's donations
    report.donations.push(donation);
    
    // Update fulfillment status
    if (report.requirements[requirementType]) {
      report.requirements[requirementType].fulfilled = 
        (report.requirements[requirementType].fulfilled || 0) + parseInt(quantity);
    }
    
    await report.save();
    
    // Add to user's donations
    const user = await User.findById(req.user._id);
    user.donationsMade.push({
      reportId: report._id,
      requirementType,
      quantity: parseInt(quantity),
      status: "pending"
    });
    
    await user.save();
    
    // Create alert
    await createAlert(
      "Donation Pledged",
      `${user.name || user.username} has pledged to donate ${quantity} ${requirementType} for the ${report.disasterType} disaster.`,
      report._id,
      "donation_received"
    );
    
    req.flash("success", "Thank you for your donation pledge!");
    res.redirect(`/reports/${reportId}`);
  } catch (error) {
    console.error("Donation error:", error);
    req.flash("error", "Error processing donation!");
    res.redirect(`/reports/${req.params.reportId}`);
  }
});

// Mark donation as delivered (admin)
app.post("/donation/:reportId/:donationIndex/delivered", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { reportId, donationIndex } = req.params;
    
    const report = await Report.findById(reportId);
    if (!report) {
      req.flash("error", "Report not found!");
      return res.redirect("/admin");
    }
    
    // Update donation status
    if (report.donations[donationIndex]) {
      report.donations[donationIndex].status = "delivered";
      await report.save();
      
      // Update donor's donation status
      const donation = report.donations[donationIndex];
      await User.updateOne(
        { _id: donation.donorId, "donationsMade.reportId": reportId },
        { $set: { "donationsMade.$.status": "delivered" } }
      );
      
      req.flash("success", "Donation marked as delivered!");
    } else {
      req.flash("error", "Donation not found!");
    }
    
    res.redirect(`/reports/${reportId}`);
  } catch (error) {
    req.flash("error", "Error updating donation status!");
    res.redirect(`/reports/${req.params.reportId}`);
  }
});

// Mark donation as confirmed (admin)
app.post("/donation/:reportId/:donationIndex/confirmed", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { reportId, donationIndex } = req.params;
    
    const report = await Report.findById(reportId);
    if (!report) {
      req.flash("error", "Report not found!");
      return res.redirect("/admin");
    }
    
    // Update donation status
    if (report.donations[donationIndex]) {
      report.donations[donationIndex].status = "confirmed";
      await report.save();
      
      // Update donor's donation status
      const donation = report.donations[donationIndex];
      await User.updateOne(
        { _id: donation.donorId, "donationsMade.reportId": reportId },
        { $set: { "donationsMade.$.status": "confirmed" } }
      );
      
      req.flash("success", "Donation confirmed!");
    } else {
      req.flash("error", "Donation not found!");
    }
    
    res.redirect(`/reports/${reportId}`);
  } catch (error) {
    req.flash("error", "Error updating donation status!");
    res.redirect(`/reports/${req.params.reportId}`);
  }
});

// ------------------------------
// REPORTS ROUTES
// ------------------------------

// Index - Show all reports
app.get("/reports", async (req, res) => {
  const allReports = await Report.find({});
  
  // Filter reports based on requirements status if specified
  let filteredReports = allReports;
  
  if (req.query.filter === "needs") {
    filteredReports = allReports.filter(report => hasUnfulfilledRequirements(report));
  } else if (req.query.filter === "fulfilled") {
    filteredReports = allReports.filter(report => !hasUnfulfilledRequirements(report));
  }
  
  res.render("reports/index.ejs", { 
    allReports: filteredReports,
    filter: req.query.filter || 'all'
  });
});

// New - Form to add a new report
app.get("/reports/new", (req, res) => {
  res.render("reports/new.ejs");
});

// Create - Save new report
app.post("/reports", upload.single("image"), async (req, res) => {
  try {
    const { name, disasterType, status, message } = req.body.report;
    const { lat, lng } = req.body.report.location;
    
    // Process requirements
    let requirements = {};
    
    if (req.body.report.requirements) {
      const r = req.body.report.requirements;
      
      // Process each requirement type
      requirements = {
        food: r.food ? { 
          needed: r.food.needed === 'true', 
          quantity: r.food.quantity ? Number(r.food.quantity) : 0,
          fulfilled: 0,
          remainingNeeded: r.food.needed === 'true' ? Number(r.food.quantity) : 0
        } : undefined,
        
        water: r.water ? { 
          needed: r.water.needed === 'true', 
          quantity: r.water.quantity ? Number(r.water.quantity) : 0,
          fulfilled: 0,
          remainingNeeded: r.water.needed === 'true' ? Number(r.water.quantity) : 0
        } : undefined,
        
        medicine: r.medicine ? { 
          needed: r.medicine.needed === 'true', 
          quantity: r.medicine.quantity ? Number(r.medicine.quantity) : 0,
          fulfilled: 0,
          remainingNeeded: r.medicine.needed === 'true' ? Number(r.medicine.quantity) : 0
        } : undefined,
        
        clothing: r.clothing ? { 
          needed: r.clothing.needed === 'true', 
          quantity: r.clothing.quantity ? Number(r.clothing.quantity) : 0,
          fulfilled: 0,
          remainingNeeded: r.clothing.needed === 'true' ? Number(r.clothing.quantity) : 0
        } : undefined,
        
        shelter: r.shelter ? { 
          needed: r.shelter.needed === 'true', 
          quantity: r.shelter.quantity ? Number(r.shelter.quantity) : 0,
          fulfilled: 0,
          remainingNeeded: r.shelter.needed === 'true' ? Number(r.shelter.quantity) : 0
        } : undefined,
        
        volunteers: r.volunteers ? { 
          needed: r.volunteers.needed === 'true', 
          quantity: r.volunteers.quantity ? Number(r.volunteers.quantity) : 0,
          fulfilled: 0,
          remainingNeeded: r.volunteers.needed === 'true' ? Number(r.volunteers.quantity) : 0
        } : undefined,
        
        other: r.other ? { 
          needed: r.other.needed === 'true', 
          details: r.other.details,
          fulfilled: false
        } : undefined
      };
    }

    const reportedBy = req.user ? req.user.username : 'Anonymous';

    const newReport = new Report({
      name,
      disasterType,
      location: {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      },
      status,
      message,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      requirements: requirements,
      reportedBy: reportedBy
    });

    await newReport.save();
    
    // Create alert for new report
    await createAlert(
      `New ${disasterType} Disaster Reported`,
      `A new disaster has been reported in the area. Requires immediate attention.`,
      newReport._id,
      "new_disaster"
    );
    
    req.flash("success", "Report submitted successfully!");
    res.redirect("/reports");
  } catch (error) {
    console.error("Error creating report:", error);
    req.flash("error", "Something went wrong. Please check your form.");
    res.redirect("/reports/new");
  }
});

// Show - Show specific report by ID
app.get("/reports/:id", async (req, res) => {
  const { id } = req.params;
  const report = await Report.findById(id).populate({
    path: 'donations.donorId',
    select: 'username name'
  });
  
  if (!report) {
    req.flash("error", "Report not found!");
    return res.redirect("/reports");
  }
  
  res.render("reports/show.ejs", { report });
});

// Edit - Show edit form
app.get("/reports/:id/edit", async (req, res) => {
  const { id } = req.params;
  const report = await Report.findById(id);
  
  if (!report) {
    req.flash("error", "Report not found!");
    return res.redirect("/reports");
  }
  
  res.render("reports/edit.ejs", { report });
});

// Update - Submit edited form
app.put("/reports/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findById(id);
    
    if (!report) {
      req.flash("error", "Report not found!");
      return res.redirect("/reports");
    }
    
    // Save previous status to check if it changed
    const prevStatus = report.status;
    
    // Process requirements into proper boolean values
    let requirements = {};
    
    if (req.body.report.requirements) {
      const r = req.body.report.requirements;
      
      // Process each requirement type
      requirements = {
        food: r.food ? { 
          needed: r.food.needed === 'true', 
          quantity: r.food.quantity ? Number(r.food.quantity) : 0,
          fulfilled: report.requirements?.food?.fulfilled || 0
        } : undefined,
        
        water: r.water ? { 
          needed: r.water.needed === 'true', 
          quantity: r.water.quantity ? Number(r.water.quantity) : 0,
          fulfilled: report.requirements?.water?.fulfilled || 0
        } : undefined,
        
        medicine: r.medicine ? { 
          needed: r.medicine.needed === 'true', 
          quantity: r.medicine.quantity ? Number(r.medicine.quantity) : 0,
          fulfilled: report.requirements?.medicine?.fulfilled || 0
        } : undefined,
        
        clothing: r.clothing ? { 
          needed: r.clothing.needed === 'true', 
          quantity: r.clothing.quantity ? Number(r.clothing.quantity) : 0,
          fulfilled: report.requirements?.clothing?.fulfilled || 0
        } : undefined,
        
        shelter: r.shelter ? { 
          needed: r.shelter.needed === 'true', 
          quantity: r.shelter.quantity ? Number(r.shelter.quantity) : 0,
          fulfilled: report.requirements?.shelter?.fulfilled || 0
        } : undefined,
        
        volunteers: r.volunteers ? { 
          needed: r.volunteers.needed === 'true', 
          quantity: r.volunteers.quantity ? Number(r.volunteers.quantity) : 0,
          fulfilled: report.requirements?.volunteers?.fulfilled || 0
        } : undefined,
        
        other: r.other ? { 
          needed: r.other.needed === 'true', 
          details: r.other.details,
          fulfilled: report.requirements?.other?.fulfilled || false
        } : undefined
      };
    }
    
    // Update the report
    const updatedReport = {
      ...req.body.report,
      requirements: requirements
    };
    
    await Report.findByIdAndUpdate(id, updatedReport);
    
    // If status changed to resolved, create an alert
    if (prevStatus !== "resolved" && req.body.report.status === "resolved") {
      await createAlert(
        "Disaster Status Update",
        `The ${report.disasterType} disaster has been marked as resolved.`,
        id,
        "update"
      );
    }
    
    req.flash("success", "Report updated successfully!");
    res.redirect(`/reports/${id}`);
  } catch (error) {
    console.error("Error updating report:", error);
    req.flash("error", "Something went wrong. Please check your form.");
    res.redirect(`/reports/${req.params.id}/edit`);
  }
});

// Delete - Remove report
app.delete("/reports/:id", async (req, res) => {
  const { id } = req.params;
  await Report.findByIdAndDelete(id);
  req.flash("success", "Report deleted successfully!");
  res.redirect("/reports");
});

// Pages Routes
app.get("/home", (req, res) => {
  res.render("pages/home");
});

app.get("/media", (req, res) => {
  res.render("pages/media");
});

app.get("/livemap", async (req, res) => {
  const reports = await Report.find({});
  res.render("pages/livemap", { reports });
});

// API Routes
app.get("/api/reports", async (req, res) => {
  try {
    const reports = await Report.find({});
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: "Error fetching reports." });
  }
});

// Geocoding API
const GEOCODE_API_URL = "https://nominatim.openstreetmap.org/search";

app.get("/geocode", async (req, res) => {
  const location = req.query.q;
  try {
    const response = await axios.get(GEOCODE_API_URL, {
      params: {
        q: location,
        format: "json",
        limit: 1,
      },
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      res.json({
        lat: result.lat,
        lng: result.lon,
      });
    } else {
      res.status(404).json({ message: "Location not found" });
    }
  } catch (error) {
    console.error("Geocoding error:", error.message);
    res.status(500).json({ message: "Geocoding failed" });
  }
});

// Create default admin on startup
createDefaultAdmin();

// Start Server
app.listen(8080, () => {
  console.log("Server running on http://localhost:8080");
});