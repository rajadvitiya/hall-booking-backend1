import Admin from "./models/Admin.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();


mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log("MongoDB connected");
  });


const createAdmin = async () => {
  const existingAdmin = await Admin.findOne({ email: "admin@example.com" });
  if (!existingAdmin) {
    const admin = new Admin({
      email: "rajadvitiya72@gmail.com",
      password: "Ansh112003",
    });
    await admin.save();
    console.log("✅ Admin created!");
  }
};
createAdmin();
