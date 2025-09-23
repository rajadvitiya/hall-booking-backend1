// models/galleryImage.js
import mongoose from "mongoose";

const galleryImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    title: { type: String, default: "" }, // optional caption
    publicId: { type: String, required: true }, // Cloudinary public_id for deletion
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }, 
  },
  { timestamps: true }
);

const GalleryImage = mongoose.models.GalleryImage || mongoose.model("GalleryImage", galleryImageSchema);
export default GalleryImage;
