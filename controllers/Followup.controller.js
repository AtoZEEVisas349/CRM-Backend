const { Op, Sequelize } = require("sequelize");

// 📌 Create a new FollowUp
const createFollowUp = async (req, res) => {
  try {
    const {
      connect_via,
      follow_up_type,
      interaction_rating,
      reason_for_follow_up,
      follow_up_date,
      follow_up_time,
      fresh_lead_id,
    } = req.body;

    const { FollowUp, FreshLead, Lead, ClientLead } = req.db; // ✅ Dynamic DB

    if (
      !connect_via ||
      !follow_up_type ||
      !interaction_rating ||
      !reason_for_follow_up ||
      !follow_up_date ||
      !follow_up_time ||
      !fresh_lead_id
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const freshLead = await FreshLead.findByPk(fresh_lead_id);
    if (!freshLead)
      return res.status(404).json({ message: "FreshLead not found" });

    const lead = await Lead.findByPk(freshLead.leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const clientLead = await ClientLead.findByPk(lead.clientLeadId);
    if (!clientLead)
      return res.status(404).json({ message: "ClientLead not found" });

    clientLead.status = "Follow-Up";
    await clientLead.save();

    const newFollowUp = await FollowUp.create({
      connect_via,
      follow_up_type,
      interaction_rating,
      reason_for_follow_up,
      follow_up_date,
      follow_up_time,
      fresh_lead_id,
      follow_up_history: [],
    });

    return res.status(201).json({
      message: "Follow-up created successfully",
      data: newFollowUp,
    });
  } catch (err) {
    console.error("Error creating FollowUp:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// 📌 Update FollowUp with historical tracking
const updateFollowUp = async (req, res) => {
  try {
    const { FollowUp } = req.db; // ✅ Dynamic DB
    const id = req.params.id;
    const existingFollowUp = await FollowUp.findByPk(id);

    if (!existingFollowUp) {
      return res.status(404).json({ message: "Follow-up not found" });
    }

    const previousState = {
      connect_via: existingFollowUp.connect_via,
      follow_up_type: existingFollowUp.follow_up_type,
      interaction_rating: existingFollowUp.interaction_rating,
      reason_for_follow_up: existingFollowUp.reason_for_follow_up,
      follow_up_date: existingFollowUp.follow_up_date,
      follow_up_time: existingFollowUp.follow_up_time,
      updatedAt: new Date().toISOString(),
    };

    let history = existingFollowUp.follow_up_history || [];
    if (typeof history === "string") {
      history = JSON.parse(history);
    }

    history.push(previousState);

    const {
      connect_via,
      follow_up_type,
      interaction_rating,
      reason_for_follow_up,
      follow_up_date,
      follow_up_time,
      fresh_lead_id,
      leadId,
    } = req.body;

    Object.assign(existingFollowUp, {
      connect_via,
      follow_up_type,
      interaction_rating,
      reason_for_follow_up,
      follow_up_date,
      follow_up_time,
      fresh_lead_id,
      leadId,
      follow_up_history: history,
    });

    await existingFollowUp.save();

    return res.status(200).json({
      message: "Follow-up updated and history recorded",
      data: existingFollowUp,
    });
  } catch (err) {
    console.error("Error updating follow-up:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// 📌 Get FollowUps for executive
// const getFollowUps = async (req, res) => {
//   try {
//     const { FollowUp, FreshLead, Lead, ClientLead } = req.db; // ✅ Dynamic DB
//     const username = req.user.username;

//     const leads = await Lead.findAll({
//       where: { assignedToExecutive: username },
//       attributes: ["id"],
//     });

//     const leadIds = leads.map((lead) => lead.id);
//     if (!leadIds.length)
//       return res.status(200).json({ message: "No follow-ups", data: [] });

//     const freshLeads = await FreshLead.findAll({
//       where: { leadId: leadIds },
//       attributes: ["id", "leadId"],
//     });

//     const freshLeadIds = freshLeads.map((fl) => fl.id);
//     if (!freshLeadIds.length)
//       return res.status(200).json({ message: "No follow-ups", data: [] });

//     const followUps = await FollowUp.findAll({
//       where: { fresh_lead_id: freshLeadIds },
//       include: [
//         {
//           model: FreshLead,
//           as: "freshLead",
//           attributes: ["name", "phone", "email"],
//           include: [
//             {
//               model: Lead,
//               as: "lead",
//               attributes: ["id", "clientLeadId"],
//               include: [
//                 {
//                   model: ClientLead,
//                   as: "clientLead",
//                   attributes: ["status"],
//                 },
//               ],
//             },
//           ],
//         },
//       ],
//     });

//     const response = followUps.map((fu) => {
//       const freshLead = fu.freshLead;
//       const clientLeadStatus = freshLead?.lead?.clientLead?.status;

//       return {
//         ...fu.toJSON(),
//         freshLead: {
//           name: freshLead?.name,
//           phone: freshLead?.phone,
//           email: freshLead?.email,
//         },
//         clientLeadStatus: clientLeadStatus || null,
//       };
//     });

//     return res.status(200).json({
//       message: "Follow-ups fetched successfully",
//       data: response,
//     });
//   } catch (err) {
//     console.error("Error fetching follow-ups:", err);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };

const getFollowUps = async (req, res) => {
  try {
    const { FollowUp, FreshLead, Lead, ClientLead } = req.db;
    const username = req.user.username;

    const leads = await Lead.findAll({
      where: { assignedToExecutive: username },
      attributes: ["id"],
    });

    const leadIds = leads.map((lead) => lead.id);
    if (!leadIds.length) {
      return res.status(200).json({ message: "No follow-ups", data: [] });
    }

    const freshLeads = await FreshLead.findAll({
      where: { leadId: leadIds },
      attributes: ["id", "leadId"],
    });

    const freshLeadIds = freshLeads.map((fl) => fl.id);
    if (!freshLeadIds.length) {
      return res.status(200).json({ message: "No follow-ups", data: [] });
    }

    // ✅ Use subquery to get latest follow-up ID per fresh_lead_id
    const latestFollowUps = await FollowUp.findAll({
      attributes: [[Sequelize.fn("MAX", Sequelize.col("id")), "id"]],
      where: { fresh_lead_id: freshLeadIds },
      group: ["fresh_lead_id"],
      raw: true,
    });

    const latestFollowUpIds = latestFollowUps.map((fu) => fu.id);

    const followUps = await FollowUp.findAll({
      where: {
        id: { [Op.in]: latestFollowUpIds },
      },
      include: [
        {
          model: FreshLead,
          as: "freshLead",
          attributes: ["name", "phone", "email"],
          include: [
            {
              model: Lead,
              as: "lead",
              attributes: ["id", "clientLeadId"],
              include: [
                {
                  model: ClientLead,
                  as: "clientLead",
                  attributes: [
                    "status",
                    "education",
                    "experience",
                    "state",
                    "dob",
                    "country",
                  ],
                },
              ],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const response = followUps.map((fu) => {
      const freshLead = fu.freshLead;
      const lead = freshLead?.lead;
      const clientLead = lead?.clientLead;

      return {
        ...fu.toJSON(),
        freshLead: {
          name: freshLead?.name,
          phone: freshLead?.phone,
          email: freshLead?.email,
        },
        clientLeadStatus: clientLead?.status || null,
        education: clientLead?.education || null,
        experience: clientLead?.experience || null,
        state: clientLead?.state || null,
        dob: clientLead?.dob || null,
        country: clientLead?.country || null,
      };
    });

    return res
      .status(200)
      .json({ message: "Follow-ups fetched", data: response });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
// 📌 Get FollowUps for a specific executive (for admin panel)
const getFollowUpsByExecutive = async (req, res) => {
  try {
    const { FollowUp, FreshLead, Lead, ClientLead } = req.db;
    const { executiveName } = req.params;

    if (!executiveName) {
      return res.status(400).json({ message: "Executive name is required" });
    }

    const leads = await Lead.findAll({
      where: { assignedToExecutive: executiveName },
      attributes: ["id"],
    });

    const leadIds = leads.map((lead) => lead.id);
    if (!leadIds.length) {
      return res.status(200).json({ message: "No follow-ups", data: [] });
    }

    const freshLeads = await FreshLead.findAll({
      where: { leadId: leadIds },
      attributes: ["id", "leadId", "name", "phone", "email"],
    });

    const freshLeadIds = freshLeads.map((fl) => fl.id);
    if (!freshLeadIds.length) {
      return res.status(200).json({ message: "No follow-ups", data: [] });
    }

    const followUps = await FollowUp.findAll({
      where: { fresh_lead_id: freshLeadIds },
      include: [
        {
          model: FreshLead,
          as: "freshLead",
          attributes: ["name", "phone", "email"],
          include: [
            {
              model: Lead,
              as: "lead",
              attributes: ["id", "clientLeadId"],
              include: [
                {
                  model: ClientLead,
                  as: "clientLead",
                  attributes: ["status"],
                },
              ],
            },
          ],
        },
      ],
    });

    const formatted = followUps.map((fu) => {
      const freshLead = fu.freshLead;
      return {
        ...fu.toJSON(),
        freshLead: {
          name: freshLead?.name,
          phone: freshLead?.phone,
          email: freshLead?.email,
        },
        clientLeadStatus: freshLead?.lead?.clientLead?.status || null,
      };
    });

    return res.status(200).json({
      message: `All follow-ups by executive ${executiveName} fetched successfully`,
      data: formatted,
    });
  } catch (err) {
    console.error("Error in getFollowUpsByExecutive:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
module.exports = {
  createFollowUp,
  updateFollowUp,
  getFollowUps,
  getFollowUpsByExecutive,
};
