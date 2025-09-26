import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import fs from "fs";
import crypto from "crypto"; // ✅ for verifying Razorpay signature
import { Server } from "socket.io"; // ✅ Socket.IO
import Booking from "./models/booking.js";
import Package from "./models/package.js";
import Contact from "./models/contact.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import GalleryImage from "./models/galleryImage.js";
import sgMail from "@sendgrid/mail";
// import Admin from "./models/Admin.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// 🔒 No-cache middleware
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// --- MongoDB Connection ---
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("✅ MongoDB connected");

    // Attempt to create a unique index on `date` to prevent duplicates (best-effort).
    // If your schema stores date as string "YYYY-MM-DD", this index will enforce uniqueness.
    // If it stores Date objects, the index still helps when exact Date objects are used.
    try {
      await Booking.collection.createIndex(
        { date: 1 },
        {
          unique: true,
          partialFilterExpression: { date: { $exists: true } },
        }
      );
      console.log("✅ Ensured unique index on Booking.date (best-effort)");
    } catch (err) {
      console.warn("⚠️ Could not create unique index on Booking.date (existing duplicates?).", err.message);
    }
  })
  .catch((err) => console.error("❌ MongoDB error:", err));

// --- Razorpay Setup ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --- Email Setup ---
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

transporter.verify((err, success) => {
  if (err) console.error("Mailer error:", err);
  else console.log("✅ Mailer is ready to send emails");
});

// --- Middleware: Verify Admin Token ---
function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).json({ message: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Unauthorized" });
    req.admin = decoded;
    next();
  });
}

// --- Admin Login ---
app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: admin._id, email: admin.email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Helper: normalizeDateString
 * Accepts:
 *  - a "YYYY-MM-DD" string
 *  - a Date-like string
 *  - a Date object
 * Returns "YYYY-MM-DD" (local date)
 */
function normalizeDateString(d) {
  if (!d) return null;
  try {
    // If it's already 'YYYY-MM-DD'
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;

    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;

    // Build local YYYY-MM-DD
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return null;
  }
}

/**
 * Public GET /api/bookings
 * Returns bookedDates: array of "YYYY-MM-DD" for all current & future bookings
 */
app.get("/api/bookings", async (req, res) => {
  try {
    const today = new Date();
    // Fetch bookings with date >= start of today
    // We'll return an array of normalized date strings (YYYY-MM-DD)
    const allBookings = await Booking.find({});
    const bookedDates = allBookings
      .map((b) => normalizeDateString(b.date))
      .filter(Boolean)
      .sort();

    res.json({ bookedDates });
  } catch (error) {
    console.error("Error fetching public booked dates:", error);
    res.status(500).json({ message: "Error fetching booked dates", error });
  }
});

// --- Create Booking (Public) ---
// Prevent double-booking on the same date (returns 409 if already booked)
app.post("/api/bookings", async (req, res) => {
  try {
    const { date } = req.body;
    const normalized = normalizeDateString(date);

    if (!normalized) {
      return res.status(400).json({ message: "Invalid or missing date (expected YYYY-MM-DD or valid date)" });
    }

    // Check if a booking already exists for the same calendar day.
    // We do two checks:
    // 1) If date field is stored as 'YYYY-MM-DD' string
    // 2) If date field is stored as Date, check documents whose date is within that day range
    const startOfDay = new Date(normalized + "T00:00:00.000Z");
    const endOfDay = new Date(normalized + "T23:59:59.999Z");

    // First, check exact string match (useful if date stored as string)
    const existingByString = await Booking.findOne({ date: normalized });

    // Second, check Date-type storage (range query)
    const existingByRange = await Booking.findOne({
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (existingByString || existingByRange) {
      return res.status(409).json({ message: "Selected date is already booked" });
    }

    // Create & save booking
    const booking = new Booking(req.body);

    // If your schema expects Date object for `date` and the client sent 'YYYY-MM-DD',
    // you may want to convert. We'll leave it as sent; model should handle the field type.
    await booking.save();

    // Notify admin by email (best-effort)
    const admin = await Admin.findOne({});
     const adminEmail = admin?.email;
    try {
      await transporter.sendMail({
        from: `"Booking App" <${process.env.EMAIL_FROM}>`,
        to: adminEmail,
        subject: "New Booking Request",
        text: `A new booking request has been submitted by ${booking.name}.`,
      });
    } catch (mailErr) {
      console.warn("Failed sending booking notification email:", mailErr.message);
    }

    // Return updated bookedDates to the client
    const allBookings = await Booking.find({});
    const bookedDates = allBookings
      .map((b) => normalizeDateString(b.date))
      .filter(Boolean)
      .sort();

    res.status(201).json({ message: "Booking request submitted", booking, bookedDates });
  } catch (error) {
    // If unique index exists and insertion fails due to duplicate key, send 409
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Selected date is already booked (duplicate key)" });
    }

    console.error("Booking save error:", error);
    res.status(500).json({ message: "Error saving booking", error });
  }
});

// --- Get All Bookings (Admin Only) with automatic past-booking deletion ---
app.get("/api/admin/bookings", verifyAdmin, async (req, res) => {
  try {
    const today = new Date();

    // 1️⃣ Delete past bookings automatically (if date is stored as Date)
    // For robustness, we delete if a booking's normalized date is < todayNormalized
    const todayNormalized = normalizeDateString(today);
    // Delete documents whose normalized date is less than todayNormalized:
    // This is best-effort; if date is Date object, we use range query
    const deletedByRange = await Booking.deleteMany({
      date: { $lt: new Date(todayNormalized + "T00:00:00.000Z") },
    });

    if (deletedByRange.deletedCount > 0) {
      console.log(`🗑️ ${deletedByRange.deletedCount} past bookings removed`);
      const io = req.app.get("io");
      io?.emit("pastBookingsDeleted");
    }

    // 2️⃣ Fetch current/future bookings
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    console.error("Error fetching bookings:", err);
    res.status(500).json({ message: "Error fetching bookings", error: err });
  }
});

// --- Approve Booking & Generate Razorpay Payment Link ---
app.post("/api/admin/bookings/:id/approve", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (!id) return res.status(400).json({ message: "Booking ID is required" });
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    booking.status = "approved";
    await booking.save();

    // ✅ Razorpay payment link
    const paymentLink = await razorpay.paymentLink.create({
      amount: Number(amount) * 100, // in paise
      currency: "INR",
      customer: {
        name: booking.name,
        email: booking.email,
        contact: booking.phone,
      },
      notify: {
        sms: true,
        email: true,
      },
      reminder_enable: true,
      notes: {
        bookingId: booking._id.toString(),
      },
      callback_url: `${process.env.FRONTEND_URL}/payment-success?bookingId=${booking._id}`,
      callback_method: "get",
    });

    // ✅ Send email
    if (booking.email) {
      await transporter.sendMail({
        from: `"Booking App" <${process.env.EMAIL_FROM}>`,
        to: booking.email,
        subject: "Booking Approved - Complete Payment",
        html: `
          <p>Hello ${booking.name},</p>
          <p>Your booking has been <b>approved</b>.</p>
          <p>Please complete your payment by clicking the link below:</p>
          <a href="${paymentLink.short_url}" target="_blank">Pay Now</a>
          <p>Amount: ₹${amount}</p>
          <p>Booking ID: ${booking._id}</p>
        `,
      });
    }

    res.json({ message: "Booking approved, payment link sent", booking, paymentLink });
  } catch (error) {
    console.error("Approve booking error:", error);
    res.status(500).json({ message: "Error approving booking", error });
  }
});

// --- Razorpay Webhook ---
app.post("/api/razorpay/webhook", express.json({ type: "*/*" }), async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    const body = JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    const event = req.body.event;

    if (event === "payment.captured") {
      const payment = req.body.payload.payment.entity;
      const bookingId = payment.notes?.bookingId;

      const booking = await Booking.findOneAndUpdate(
        { _id: bookingId },
        { isPaid: true, paymentId: payment.id },
        { new: true }
      );

      if (booking) {
        console.log(`✅ Booking ${booking._id} marked as PAID`);

        // 🔔 Real-time update
        const io = req.app.get("io");
        io.emit("paymentUpdate", { bookingId: booking._id, isPaid: true, name: booking.name });
      }
    }

    res.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ message: "Webhook error", error });
  }
});

// --- Reject Booking ---
app.post("/api/admin/bookings/:id/reject", verifyAdmin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    await booking.deleteOne();

    if (booking.email) {
      await transporter.sendMail({
        from: `"Booking App" <${process.env.EMAIL_FROM}>`,
        to: booking.email,
        subject: "Booking Rejected",
        text: `Sorry, your booking request has been rejected and removed from our system.`,
      });
    }

    res.json({ message: "Booking rejected and deleted", bookingId: req.params.id });
  } catch (error) {
    console.error("Reject booking error:", error);
    res.status(500).json({ message: "Error rejecting booking", error });
  }
});

// --- Create Package (Admin only) ---
app.post("/api/admin/packages", verifyAdmin, async (req, res) => {
  try {
    const pkg = new Package({ ...req.body, createdBy: req.admin?.id });
    await pkg.save();
    res.status(201).json({ message: "Package created", package: pkg });
  } catch (error) {
    console.error("Create package error:", error);
    res.status(500).json({ message: "Error creating package", error });
  }
});
// --- Get All Packages (Public) ---
app.get("/api/packages", async (req, res) => {
  try {
    const packages = await Package.find().sort({ createdAt: -1 });
    res.json(packages);
  } catch (error) {
    res.status(500).json({ message: "Error fetching packages", error });
  }
});

// --- Get Single Package (Public) ---
app.get("/api/packages/:id", async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.json(pkg);
  } catch (error) {
    res.status(500).json({ message: "Error fetching package", error });
  }
});

// --- Update Package (Admin only) ---
app.put("/api/admin/packages/:id", verifyAdmin, async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });

    Object.keys(req.body).forEach((key) => {
      if (Array.isArray(req.body[key])) {
        // ✅ Replace array instead of appending
        pkg[key] = req.body[key];
      } else if (typeof req.body[key] === "object" && !Array.isArray(req.body[key])) {
        // ✅ Merge objects safely
        pkg[key] = { ...pkg[key], ...req.body[key] };
      } else {
        pkg[key] = req.body[key];
      }
    });

    await pkg.save();
    res.json({ message: "Package updated", package: pkg });
  } catch (error) {
    console.error("Update package error:", error);
    res.status(500).json({ message: "Error updating package", error });
  }
});




// --- Delete Package (Admin only) ---
app.delete("/api/admin/packages/:id", verifyAdmin, async (req, res) => {
  try {
    const pkg = await Package.findByIdAndDelete(req.params.id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.json({ message: "Package deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting package", error });
  }
});


// contact routes 

app.get("/api/admin/contacts", async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json({ contacts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET single contact by ID (optional)
app.get("/api/admin/contacts/:id", async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    res.json(contact);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST create a new contact (only admin)
app.post("/api/admin/contacts", verifyAdmin, async (req, res) => {
  try {
    const { phone, location, socialMedia } = req.body;
    const contact = new Contact({ phone, location, socialMedia });
    await contact.save();
    res.status(201).json(contact);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT update contact by ID (only admin)
app.put("/api/admin/contacts/:id", verifyAdmin, async (req, res) => {
  try {
    const { phone, location, socialMedia } = req.body;
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { phone, location, socialMedia },
      { new: true }
    );
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    res.json(contact);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// DELETE contact by ID (optional, only admin)
app.delete("/api/admin/contacts/:id", verifyAdmin, async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    res.json({ message: "Contact deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- Admin Schema & Model ---
import mongoosePkg from "mongoose";
const adminSchema = new mongoosePkg.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

// hash password before saving
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const Admin = mongoose.models.Admin || mongoose.model("Admin", adminSchema);

// --- Update Admin Email & Password ---
app.put("/api/admin/update", verifyAdmin, async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    if (email) admin.email = email;
    if (password) admin.password = password; // will hash automatically due to pre("save")

    await admin.save();

    res.json({ message: "Admin updated successfully" });
  } catch (err) {
    console.error("Update admin error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Multer memory storage
const upload = multer({ storage: multer.memoryStorage() });

// --- Upload Image (Admin only) ---
app.post("/api/admin/gallery/upload", verifyAdmin, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "gallery" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const galleryImage = new GalleryImage({
      url: result.secure_url,
      publicId: result.public_id,
      createdBy: req.admin.id,
    });

    await galleryImage.save();
    res.status(201).json({ message: "Image uploaded successfully", image: galleryImage });
  } catch (err) {
    console.error("Gallery upload error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

// --- Get All Gallery Images (Admin) ---
app.get("/api/admin/gallery",  async (req, res) => {
  try {
    const images = await GalleryImage.find().sort({ createdAt: -1 });
    res.json(images);
  } catch (err) {
    console.error("Fetch gallery error:", err);
    res.status(500).json({ message: "Failed to fetch gallery images", error: err.message });
  }
});

// --- Delete Image by ID (Admin only) ---
app.delete("/api/admin/gallery/:id", verifyAdmin, async (req, res) => {
  try {
    const image = await GalleryImage.findById(req.params.id);
    if (!image) return res.status(404).json({ message: "Image not found" });

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(image.publicId);

    // Delete from MongoDB
    await image.deleteOne();

    res.json({ message: "Image deleted successfully" });
  } catch (err) {
    console.error("Delete gallery error:", err);
    res.status(500).json({ message: "Failed to delete image", error: err.message });
  }
});





// --- Start Server + Socket.IO ---
const server = app.listen(process.env.PORT || 5000, () =>
  console.log(`✅ Server running on port ${process.env.PORT || 5000}`)
);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
app.set("io", io);
