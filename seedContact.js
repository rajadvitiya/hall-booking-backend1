const mongoose = require("mongoose");
const Contact = require("./models/contact.js");
require("dotenv").config();

const hallContact = {
  phone: "8960306353",
  location: "Sanjarpur To Saraimir Mainroad, Sanjar Pur, Azamgarh",
  socialMedia: {
    facebook: "https://www.facebook.com/people/The-Heritage-Marriage-Hall-Hotel/61551881138942/?_rdr",
    instagram: "https://www.instagram.com/heritage.sanjarpur/",
  },
};

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log("MongoDB connected");

    await Contact.deleteMany({});
    console.log("Existing contact cleared");

    await Contact.create(hallContact);
    console.log("Hall contact inserted");

    mongoose.disconnect();
  })
  .catch((err) => console.error(err));
