// config/sequelize.js
require("dotenv").config();
const { Sequelize } = require("sequelize");

// Initialize Sequelize
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    port: process.env.DB_PORT,
    logging: console.log,
  }
);

// Test database connection
sequelize.authenticate();

// Define models
const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;
db.Users = require("../models/User.model")(sequelize, Sequelize); // Pass sequelize and Sequelize to the model function

// Debugging: Check if models are loaded
console.log("📌 Loaded models:", Object.keys(db));

module.exports = db;
