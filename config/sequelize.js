const { Sequelize } = require("sequelize");

module.exports = function initializeModels(sequelize) {
  const db = {};
  db.Sequelize = Sequelize;
  db.sequelize = sequelize;

  // Load models with table names
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
  db.Opportunity = require("../models/Opportunity.model")(
    sequelize,
    Sequelize,
    { tableName: "Opportunities" }
  );
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
    { tableName: "FollowUpHistories" }
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

  db.Users.hasMany(db.ExecutiveActivity, {
    foreignKey: "userId",
    onDelete: "CASCADE",
  });
  db.ExecutiveActivity.belongsTo(db.Users, { foreignKey: "userId" });

  db.ClientLead.hasMany(db.Lead, {
    foreignKey: "clientLeadId",
    onDelete: "CASCADE",
  });
  db.Lead.belongsTo(db.ClientLead, {
    foreignKey: "clientLeadId",
    as: "clientLead",
  });

  db.Lead.hasOne(db.FreshLead, { foreignKey: "leadId", onDelete: "CASCADE" });
  db.FreshLead.belongsTo(db.Lead, { foreignKey: "leadId", as: "lead" });

  db.Lead.hasMany(db.FollowUp, { foreignKey: "leadId", onDelete: "CASCADE" });
  db.FollowUp.belongsTo(db.Lead, { foreignKey: "leadId", as: "lead" });

  db.Lead.hasOne(db.ConvertedClient, {
    foreignKey: "leadId",
    onDelete: "CASCADE",
  });
  db.ConvertedClient.belongsTo(db.Lead, { foreignKey: "leadId", as: "lead" });

  db.Lead.hasMany(db.Deal, { foreignKey: "leadId", onDelete: "CASCADE" });
  db.Deal.belongsTo(db.Lead, { foreignKey: "leadId" });

  db.FreshLead.hasMany(db.FollowUp, {
    foreignKey: "fresh_lead_id",
    onDelete: "CASCADE",
    as: "followUps",
  });
  db.FollowUp.belongsTo(db.FreshLead, {
    foreignKey: "fresh_lead_id",
    as: "freshLead",
  });

  db.FreshLead.hasMany(db.FollowUpHistory, {
    foreignKey: "fresh_lead_id",
    onDelete: "CASCADE",
    as: "followUpHistories",
  });
  db.FollowUpHistory.belongsTo(db.FreshLead, {
    foreignKey: "fresh_lead_id",
    as: "freshLead",
  });

  db.FollowUp.hasMany(db.FollowUpHistory, {
    foreignKey: "follow_up_id",
    onDelete: "CASCADE",
    as: "followUpHistories",
  });
  db.FollowUpHistory.belongsTo(db.FollowUp, {
    foreignKey: "follow_up_id",
    as: "followUp",
  });

  db.FreshLead.hasOne(db.ConvertedClient, {
    foreignKey: "fresh_lead_id",
    onDelete: "CASCADE",
    as: "convertedClient",
  });
  db.ConvertedClient.belongsTo(db.FreshLead, {
    foreignKey: "fresh_lead_id",
    as: "freshLead",
  });

  db.FreshLead.hasOne(db.CloseLead, {
    foreignKey: "freshLeadId",
    onDelete: "CASCADE",
    as: "closeLead",
  });
  db.CloseLead.belongsTo(db.FreshLead, {
    foreignKey: "freshLeadId",
    as: "freshLead",
  });

  db.Users.hasMany(db.Notification, {
    foreignKey: "userId",
    onDelete: "CASCADE",
  });
  db.Notification.belongsTo(db.Users, { foreignKey: "userId" });

  db.Meeting.belongsTo(db.FreshLead, {
    foreignKey: "fresh_lead_id",
    as: "freshLead",
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  });
  db.Meeting.belongsTo(db.Users, {
    foreignKey: "executiveId",
    as: "executive",
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  });
  db.Users.hasMany(db.Meeting, {
    foreignKey: "executiveId",
    onDelete: "SET NULL",
  });

  // ------------------------
  // Sync Models (optional per-tenant)
  // ------------------------
  sequelize
    .sync({ force: false })
    .then(() => console.log("✅ Tenant DB tables synced"))
    .catch((err) => console.error("❌ Error syncing tenant DB:", err));

  return db;
};
