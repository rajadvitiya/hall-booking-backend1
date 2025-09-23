import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    package: { type: String, required: true, trim: true },
    guests: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    specialRequests: { type: String, trim: true },

    // ✅ Booking status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // ✅ Payment tracking
    isPaid: { type: Boolean, default: false },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "failed", "refunded"],
      default: "unpaid",
    },
    paymentId: { type: String, trim: true }, // Razorpay payment ID
    orderId: { type: String, trim: true },   // Razorpay order/payment link ID
    amount: { type: Number, default: 0 },    // Store amount in paise

    // ✅ Admin activity log
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

// ✅ Auto-update timestamps for payment + status
bookingSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    if (this.status === "approved") this.approvedAt = new Date();
    if (this.status === "rejected") this.rejectedAt = new Date();
  }
  if (this.isModified("paymentStatus") && this.paymentStatus === "paid") {
    this.paidAt = new Date();
  }
  next();
});

// ✅ Add text index for faster searching
bookingSchema.index({
  name: "text",
  email: "text",
  phone: "text",
  eventType: "text",
});

// ✅ Prevent duplicate bookings (same user, same date & time)
bookingSchema.index(
  { email: 1, date: 1, time: 1 },
  { unique: true }
);

export default mongoose.model("Booking", bookingSchema);
