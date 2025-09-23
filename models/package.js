import mongoose from "mongoose";

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String },

    pricingType: {
      type: String,
      enum: ["fixed", "perPerson", "custom"],
      required: true,
    },

    fixedPrice: {
      type: Number,
    },

    perPersonPricing: [
      {
        peopleCount: Number,
        price: Number,
      },
    ],

    // ✅ FIX: renamed to match frontend
    included: [{ type: String }],
    excluded: [{ type: String }],

    menu: {
      welcomeSweets: [{ type: String }],
      starters: [{ type: String }],
      mainCourse: [{ type: String }],
    },

    terms: [{ type: String }],

    images: [{ type: String }],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Package", packageSchema);
