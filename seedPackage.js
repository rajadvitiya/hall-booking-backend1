// seedPackages.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Package from "./models/package.js";

dotenv.config();

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");

    // Clear old data (optional)
    await Package.deleteMany();

    const packages = [
      // ================= Engagement Packages =================
      {
        name: "Engagement Day Program",
        category: "Engagement",
        pricingType: "fixed",
        fixedPrice: 25000,
        included: [
          "2 AC Rooms for Bride's Family",
          "2 AC Rooms for Groom's Family",
          "1 AC Hall for Baraksha / Tilak Ceremony",
          "Stage Hall for Ring Ceremony",
          "Food Serving Stalls",
          "Beautiful Flower Decorations",
          "All Kitchen Utensils",
          "RO Purified Drinking Water",
          "Soft Music with Two Speakers",
          "Flower Arrangement for Blessings",
        ],
        excluded: [
          "Diesel for Generator",
          "Halwai (Cook) Booking",
          "Dish Washing Services",
          "Waiter Services",
          "Coffee / Popcorn Machine and similar items",
          "Cooler (Jumbo) / Water Fan",
        ],
        terms: ["25% of the booking amount is non-refundable"],
      },
      {
        name: "Engagement Night Program",
        category: "Engagement",
        pricingType: "fixed",
        fixedPrice: 35000,
        included: [
          "2 AC Rooms for Bride's Family",
          "2 AC Rooms for Groom's Family",
          "1 AC Hall for Baraksha / Tilak Ceremony",
          "Stage Hall for Ring Ceremony",
          "Food Serving Stalls",
          "Elegant Flower Decorations",
          "All Kitchen Utensils",
          "RO Purified Drinking Water",
          "Soft Music with Two Speakers",
          "Flower Arrangement for Blessings",
        ],
        excluded: [
          "Diesel for Generator",
          "Halwai (Cook) Booking",
          "Dish Washing Services",
          "Waiter Services",
          "Coffee / Popcorn Machine and similar items",
          "Cooler (Jumbo) / Water Fan",
        ],
        terms: ["25% of the booking amount is non-refundable"],
      },
      {
        name: "Engagement Gold Package",
        category: "Engagement",
        pricingType: "perPerson",
        perPersonPricing: [
          { peopleCount: 150, price: 180000 },
          { peopleCount: 200, price: 210000 },
          { peopleCount: 250, price: 240000 },
        ],
        included: [
          "Welcome Sweet (1 Variety)",
          "5 Types of Starter Items",
          "Complete Main Course (3 Sabzi, 1 Dal, 1 Rice)",
          "Stage & Selfie Point Setup",
          "Decorated Gate & Gallery",
          "VIP Lounge Access",
          "Buffet Style Serving Stalls",
          "4 AC Rooms",
          "1 AC Hall and 1 Non-AC Hall",
          "Dance Floor with DJ",
        ],
        terms: [
          "Sweets and snacks served for 90–120 minutes",
          "Day Program: 11:00 AM – 4:00 PM",
          "Night Program: 7:00 PM – 11:00 PM",
          "25% of the booking amount is non-refundable",
        ],
      },
      {
        name: "Engagement Platinum Package",
        category: "Engagement",
        pricingType: "perPerson",
        perPersonPricing: [
          { peopleCount: 150, price: 210000 },
          { peopleCount: 200, price: 240000 },
          { peopleCount: 250, price: 270000 },
        ],
        included: [
          "Welcome Sweet (1 Variety)",
          "8 Types of Starter Items",
          "Grand Main Course (4 Sabzi, 2 Dal, 2 Rice)",
          "Stage & Selfie Point Setup",
          "Decorated Gate & Gallery",
          "VIP Lounge Access",
          "Buffet Style Serving Stalls",
          "4 AC Rooms",
          "1 AC Hall and 1 Non-AC Hall",
          "Dance Floor with DJ",
        ],
        terms: [
          "Sweets and snacks served for 90–120 minutes",
          "Day Program: 11:00 AM – 4:00 PM",
          "Night Program: 7:00 PM – 11:00 PM",
          "25% of the booking amount is non-refundable",
        ],
      },

      // ================= Shaadi Packages =================
      {
        name: "Shaadi Gold Package",
        category: "Shaadi",
        pricingType: "perPerson",
        perPersonPricing: [
          { peopleCount: 200, price: 230000 },
          { peopleCount: 250, price: 260000 },
          { peopleCount: 300, price: 290000 },
          { peopleCount: 400, price: 350000 },
        ],
        included: [
          "Welcome Sweet (1 Variety)",
          "7 Types of Starter Items",
          "Complete Main Course (3 Sabzi, 1 Dal, 1 Rice)",
          "Stage, Mandap & Selfie Point Setup",
          "Decorated Gate & Gallery",
          "VIP Lounge Access",
          "Buffet Style Serving Stalls",
          "4 AC Rooms",
          "1 AC Hall and 1 Non-AC Hall",
          "Dance Floor with DJ",
        ],
        terms: [
          "Sweets and snacks served for 90–120 minutes",
          "Program Timing: From 6:00 PM onwards",
          "25% of the booking amount is non-refundable",
        ],
      },
      {
        name: "Shaadi Platinum Package",
        category: "Shaadi",
        pricingType: "perPerson",
        perPersonPricing: [
          { peopleCount: 200, price: 260000 },
          { peopleCount: 250, price: 290000 },
          { peopleCount: 300, price: 320000 },
          { peopleCount: 400, price: 380000 },
        ],
        included: [
          "Welcome Sweet (1 Variety)",
          "10 Types of Starter Items",
          "Grand Main Course (4 Sabzi, 2 Dal, 2 Rice)",
          "Stage, Mandap & Selfie Point Setup",
          "Decorated Gate & Gallery",
          "VIP Lounge Access",
          "Buffet Style Serving Stalls",
          "4 AC Rooms",
          "1 AC Hall and 1 Non-AC Hall",
          "Dance Floor with DJ",
        ],
        terms: [
          "Sweets and snacks served for 90–120 minutes",
          "Program Timing: From 6:00 PM onwards",
          "25% of the booking amount is non-refundable",
        ],
      },
    ];

    await Package.insertMany(packages);
    console.log("🎉 Packages seeded successfully!");
    process.exit();
  })
  .catch((err) => console.error("❌ DB Error:", err));
