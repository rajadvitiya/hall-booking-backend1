const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    socialMedia: {
      facebook: { type: String, trim: true },
      instagram: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Contact", contactSchema);
