// const mongoose = require("mongoose");
// const initData = require("./data.js");
// const Report = require("../models/Report.js");

// const MONGO_URL = "mongodb://127.0.0.1:27017/disasterDB";

// main()
//   .then(() => {
//     console.log("Connected to DB");
//   })
//   .catch((err) => {
//     console.log("DB Connection Error:", err);
//   });

// async function main() {
//   await mongoose.connect(MONGO_URL);
// }

// const initDB = async () => {
//   await Report.deleteMany({});
//   await Report.insertMany(initData.data);
//   console.log("Database seeded successfully!");
// };

// initDB();

const mongoose = require("mongoose");
const Report = require("./models/report.js");
const data = require("./data"); // your sample 15 reports

mongoose
  .connect("mongodb://127.0.0.1:27017/disasterDB")
  .then(() => {
    console.log("Connected to DB");
  })
  .catch((err) => {
    console.log("Connection Error:", err);
  });

const initDB = async () => {
  await Report.deleteMany({});
  await Report.insertMany(data);
  console.log("Database seeded!");
  mongoose.connection.close();
};

initDB();
