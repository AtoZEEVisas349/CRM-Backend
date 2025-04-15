require("dotenv").config(); // Load environment variables from the .env file
const { Sequelize } = require("sequelize"); // Import Sequelize ORM

// Initialize Sequelize with database credentials from environment variables
const sequelize = new Sequelize(
  process.env.DB_NAME, // Database name
  process.env.DB_USER, // Database username
  process.env.DB_PASSWORD, // Database password
  {
    host: process.env.DB_HOST, // Database host (e.g., localhost or remote server)
    dialect: "mysql", // Specify MySQL as the database dialect
    port: process.env.DB_PORT, // Database port (from .env file)
    logging: console.log, // Enable logging of SQL queries (can be disabled in production)
  }
);

// Test the database connection
sequelize
  .authenticate()
  .then(() => console.log("✅ Connected to MySQL database using Sequelize"))
  .catch((err) => console.error("❌ Unable to connect to the database:", err));

// Initialize an empty object to store models
const db = {};
db.Sequelize = Sequelize; // Store Sequelize package reference
db.sequelize = sequelize; // Store the Sequelize instance

// Define models and associate them with the Sequelize instance
db.Users = require("../models/User.model")(sequelize, Sequelize);
db.Deal = require("../models/Deal.model")(sequelize, Sequelize);
db.Lead = require("../models/Lead.model")(sequelize, Sequelize);
db.Meeting = require("../models/Meeting.model")(sequelize, Sequelize);
db.Opportunity = require("../models/Opportunity.model")(sequelize, Sequelize);
db.ClientLead = require("../models/ClientLead.model")(sequelize, Sequelize);
db.Invoice = require("../models/Invoice.model")(sequelize, Sequelize);
db.ExecutiveActivity = require("../models/ExecutiveActivity.model")(
  sequelize,
  Sequelize
);
db.FollowUp = require("../models/FollowUp.model")(sequelize, Sequelize); // Updated name to FollowUp
db.FreshLead = require("../models/FreshLead.model")(sequelize, Sequelize);

// Define model relationships
db.Lead.hasMany(db.Deal, { foreignKey: "leadId", onDelete: "CASCADE" }); // A lead can have multiple deals
db.Deal.belongsTo(db.Lead, { foreignKey: "leadId" }); // Each deal belongs to a lead

db.Users.hasMany(db.ExecutiveActivity, {
  foreignKey: "userId",
  onDelete: "CASCADE",
}); // A user can have multiple executive activities
db.ExecutiveActivity.belongsTo(db.Users, { foreignKey: "userId" });

db.FreshLead.belongsTo(db.Lead, {
  foreignKey: "leadId",
  onDelete: "CASCADE",
});
db.Lead.hasOne(db.FreshLead, {
  foreignKey: "leadId",
});

db.ClientLead.hasMany(db.Lead, {
  foreignKey: "clientLeadId",
  onDelete: "CASCADE",
});
db.Lead.belongsTo(db.ClientLead, { foreignKey: "clientLeadId" });

// Association for FollowUp
db.FreshLead.hasMany(db.FollowUp, {
  foreignKey: "fresh_lead_id", // The foreign key for the relationship
  onDelete: "CASCADE", // Delete associated follow-ups when a FreshLead is deleted
  as: "followUps", // Alias for the association
});
db.FollowUp.belongsTo(db.FreshLead, {
  foreignKey: "fresh_lead_id", // The foreign key for the relationship
  as: "freshLead", // Alias for the association
});

// Debugging: Log the loaded models to verify correctness
console.log("📌 Loaded models:", Object.keys(db));

module.exports = db; // Export the database object for use in other parts of the application
