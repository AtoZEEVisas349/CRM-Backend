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

// Test connection
sequelize
  .authenticate()
  .then(() => console.log("✅ Connected to MySQL database using Sequelize"))
  .catch((err) => console.error("❌ Unable to connect to the database:", err));

// Initialize models
const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models with explicit tableName
db.Users = require("../models/User.model")(sequelize, Sequelize, {
  tableName: "Users",
});
db.Deal = require("../models/Deal.model")(sequelize, Sequelize, {
  tableName: "Deals",
});
db.Lead = require("../models/Lead.model")(sequelize, Sequelize, {
  tableName: "Leads",
});
db.Meeting = require("../models/Meeting.model")(sequelize, Sequelize, {
  tableName: "Meetings",
});
db.Opportunity = require("../models/Opportunity.model")(sequelize, Sequelize, {
  tableName: "Opportunities",
});
db.ClientLead = require("../models/ClientLead.model")(sequelize, Sequelize, {
  tableName: "ClientLeads",
});
db.Invoice = require("../models/Invoice.model")(sequelize, Sequelize, {
  tableName: "Invoices",
});
db.ExecutiveActivity = require("../models/ExecutiveActivity.model")(
  sequelize,
  Sequelize,
  { tableName: "ExecutiveActivities" }
);
db.FollowUp = require("../models/FollowUp.model")(sequelize, Sequelize, {
  tableName: "FollowUps",
});
db.FollowUpHistory = require("../models/FollowUpHistory.model")(
  sequelize,
  Sequelize,
  {
    tableName: "FollowUpHistories",
  }
);
db.FreshLead = require("../models/FreshLead.model")(sequelize, Sequelize, {
  tableName: "FreshLeads",
});
db.ConvertedClient = require("../models/ConvertedClient.model")(
  sequelize,
  Sequelize,
  { tableName: "ConvertedClients" }
);
db.CloseLead = require("../models/CloseLead.model")(sequelize, Sequelize, {
  tableName: "CloseLeads",
});
db.Notification = require("../models/Notification.model")(
  sequelize,
  Sequelize,
  { tableName: "Notifications" }
);

// ------------------------
// Define Associations
// ------------------------

// Users → ExecutiveActivity
db.Users.hasMany(db.ExecutiveActivity, {
  foreignKey: "userId",
  onDelete: "CASCADE",
});
db.ExecutiveActivity.belongsTo(db.Users, { foreignKey: "userId" });

// ClientLead → Lead
db.ClientLead.hasMany(db.Lead, {
  foreignKey: "clientLeadId",
  onDelete: "CASCADE",
});
db.Lead.belongsTo(db.ClientLead, {
  foreignKey: "clientLeadId",
  as: "clientLead",
});

// Lead → FreshLead
db.Lead.hasOne(db.FreshLead, {
  foreignKey: "leadId",
  onDelete: "CASCADE",
});
db.FreshLead.belongsTo(db.Lead, {
  foreignKey: "leadId",
  as: "lead",
});

// Lead → FollowUp
db.Lead.hasMany(db.FollowUp, {
  foreignKey: "leadId",
  onDelete: "CASCADE",
});
db.FollowUp.belongsTo(db.Lead, {
  foreignKey: "leadId",
  as: "lead",
});

// Lead → ConvertedClient
db.Lead.hasOne(db.ConvertedClient, {
  foreignKey: "leadId",
  onDelete: "CASCADE",
});
db.ConvertedClient.belongsTo(db.Lead, {
  foreignKey: "leadId",
  as: "lead",
});

// Lead → Deal
db.Lead.hasMany(db.Deal, {
  foreignKey: "leadId",
  onDelete: "CASCADE",
});
db.Deal.belongsTo(db.Lead, {
  foreignKey: "leadId",
});

// FreshLead → FollowUps
db.FreshLead.hasMany(db.FollowUp, {
  foreignKey: "fresh_lead_id",
  onDelete: "CASCADE",
  as: "followUps",
});
db.FollowUp.belongsTo(db.FreshLead, {
  foreignKey: "fresh_lead_id",
  as: "freshLead",
});

// FreshLead → FollowUpHistory
db.FreshLead.hasMany(db.FollowUpHistory, {
  foreignKey: "fresh_lead_id",
  onDelete: "CASCADE",
  as: "followUpHistories",
});
db.FollowUpHistory.belongsTo(db.FreshLead, {
  foreignKey: "fresh_lead_id",
  as: "freshLead",
});

// FollowUp → FollowUpHistory
db.FollowUp.hasMany(db.FollowUpHistory, {
  foreignKey: "follow_up_id",
  onDelete: "CASCADE",
  as: "followUpHistories",
});
db.FollowUpHistory.belongsTo(db.FollowUp, {
  foreignKey: "follow_up_id",
  as: "followUp",
});

// FreshLead → ConvertedClient
db.FreshLead.hasOne(db.ConvertedClient, {
  foreignKey: "fresh_lead_id",
  onDelete: "CASCADE",
  as: "convertedClient",
});
db.ConvertedClient.belongsTo(db.FreshLead, {
  foreignKey: "fresh_lead_id",
  as: "freshLead",
});

// FreshLead → CloseLead
db.FreshLead.hasOne(db.CloseLead, {
  foreignKey: "freshLeadId",
  onDelete: "CASCADE",
  as: "closeLead",
});
db.CloseLead.belongsTo(db.FreshLead, {
  foreignKey: "freshLeadId",
  as: "freshLead",
});

// Users → Notifications
db.Users.hasMany(db.Notification, {
  foreignKey: "userId",
  onDelete: "CASCADE",
});
db.Notification.belongsTo(db.Users, {
  foreignKey: "userId",
});

// Meeting → FreshLead
db.Meeting.belongsTo(db.FreshLead, {
  foreignKey: "fresh_lead_id",
  as: "freshLead",
  onUpdate: "CASCADE",
  onDelete: "CASCADE",
});

// Meeting → Users
db.Meeting.belongsTo(db.Users, {
  foreignKey: "executiveId",
  as: "executive",
  onUpdate: "CASCADE",
  onDelete: "SET NULL",
});

// Users → Meeting
db.Users.hasMany(db.Meeting, {
  foreignKey: "executiveId",
  onDelete: "SET NULL",
});

// ------------------------
// Validate Schema
// ------------------------
async function validateSchema() {
  try {
    console.log("📌 Validating FollowUps table schema...");
    const followUpSchema = await db.FollowUp.describe();
    console.log("FollowUps schema:", followUpSchema);

    console.log("📌 Validating FollowUpHistories table schema...");
    const followUpHistorySchema = await db.FollowUpHistory.describe();
    console.log("FollowUpHistories schema:", followUpHistorySchema);

    // Check if FollowUps table exists
    const [followUpResults] = await sequelize.query(
      "SHOW TABLES LIKE 'FollowUps'"
    );
    if (followUpResults.length === 0) {
      console.error("❌ FollowUps table does not exist in the database!");
    } else {
      console.log("✅ FollowUps table exists");
    }

    // Check if FollowUpHistories table exists
    const [followUpHistoryResults] = await sequelize.query(
      "SHOW TABLES LIKE 'FollowUpHistories'"
    );
    if (followUpHistoryResults.length === 0) {
      console.error(
        "❌ FollowUpHistories table does not exist in the database!"
      );
    } else {
      console.log("✅ FollowUpHistories table exists");
    }
  } catch (err) {
    console.error("❌ Error validating schema:", err);
  }
}
validateSchema();

// ------------------------
// Sync Models (Non-destructive)
// ------------------------
sequelize
  .sync({ force: false })
  .then(() => console.log("✅ Database tables synced"))
  .catch((err) => console.error("❌ Error syncing database:", err));

// ------------------------
// Debug
// ------------------------
console.log("📌 Loaded models:", Object.keys(db));

module.exports = db;
