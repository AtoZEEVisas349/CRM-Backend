const createFinalizedLead = async (req, res) => {
  try {
    const { ProcessedFinal, FreshLead, ClientLead, Lead } = req.db;
    const { fresh_lead_id } = req.body;

    // Extract logged-in process person ID
    const process_person_id = req.user?.id;

    if (!process_person_id) {
      return res
        .status(401)
        .json({ message: "Unauthorized: process person not found." });
    }

    // Ensure fresh_lead_id is provided
    if (!fresh_lead_id) {
      return res.status(400).json({ message: "fresh_lead_id is required." });
    }

    // Confirm fresh lead exists
    const freshLead = await FreshLead.findByPk(fresh_lead_id, {
      include: {
        model: Lead,
        as: "lead",
        include: {
          model: ClientLead,
          as: "clientLead",
        },
      },
    });
    if (!freshLead) {
      return res.status(404).json({ message: "FreshLead not found." });
    }

    const clientLeadStatus = freshLead.lead?.clientLead?.status;

    if (clientLeadStatus !== "Closed") {
      return res.status(400).json({
        message: "Fresh lead is not closed",
        clientLeadStatus: clientLeadStatus || "Unknown",
      });
    }

    // Prevent duplicate ProcessedFinal entry
    const exists = await ProcessedFinal.findOne({
      where: { freshLeadId: fresh_lead_id },
    });
    if (exists) {
      return res
        .status(409)
        .json({ message: "Already processed final for this lead" });
    }

    // Create new ProcessedFinal entry
    const finalEntry = await ProcessedFinal.create({
      freshLeadId: fresh_lead_id,
      process_person_id,
      name: freshLead.name,
      phone: freshLead.phone,
      email: freshLead.email,
    });

    return res.status(201).json({
      message: "ProcessedFinal entry created successfully",
      data: finalEntry,
    });
  } catch (error) {
    console.error("❌ Error creating ProcessedFinal:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getFinalizedLead = async (req, res) => {
  try {
    const { ProcessedFinal, FreshLead, ProcessPerson } = req.db;

    const finalizedLeads = await ProcessedFinal.findAll({
      include: [
        {
          model: FreshLead,
          as: "freshLead",
          attributes: ["id", "name", "email", "phone", "followUpStatus"],
        },
        {
          model: ProcessPerson,
          as: "processPerson",
          attributes: ["id", "fullName", "email", "phone"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      message: "Finalized leads fetched successfully",
      data: finalizedLeads,
    });
  } catch (error) {
    console.error("❌ Error fetching finalized leads:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  createFinalizedLead,
  getFinalizedLead,
};
