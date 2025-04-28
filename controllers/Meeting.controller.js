const {
  Meeting,
  ClientLead,
  Lead,
  FreshLead,
  Users,
} = require("../config/sequelize");

// 📌 Get all meetings with pagination
exports.getAllMeetings = async (req, res) => {
  const { page = 1, limit = 20 } = req.query; // Default to page 1 and limit 20
  const offset = (page - 1) * limit; // Calculate offset

  try {
    const { count, rows: meetings } = await Meeting.findAndCountAll({
      limit: parseInt(limit), // Number of records to fetch
      offset: parseInt(offset), // Number of records to skip
      order: [["startTime", "DESC"]], // Optional: sort by startTime, latest first
    });

    const totalPages = Math.ceil(count / limit); // Calculate total pages

    res.status(200).json({
      meetings,
      pagination: {
        totalMeetings: count,
        currentPage: parseInt(page),
        totalPages,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getMeetingByExecutive = async (req, res) => {
  const executiveUsername = req.user?.username;

  if (!executiveUsername) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Executive username missing in token" });
  }

  try {
    // Find the executive's ID based on username
    const executive = await Users.findOne({
      where: { username: executiveUsername },
      attributes: ["id"],
    });

    if (!executive) {
      return res.status(404).json({ error: "Executive not found" });
    }

    const meetings = await Meeting.findAll({
      where: { executiveId: executive.id },
      attributes: [
        "id",
        "clientName",
        "clientEmail",
        "clientPhone",
        "reasonForFollowup",
        "startTime",
        "endTime",
      ],
      include: [
        {
          model: FreshLead,
          as: "freshLead",
          attributes: ["id"],
          include: [
            {
              model: Lead,
              as: "lead",
              attributes: ["id"],
              include: [
                {
                  model: ClientLead,
                  as: "clientLead",
                  attributes: ["id", "status", "name", "email"],
                },
              ],
            },
          ],
        },
      ],
    });

    if (meetings.length === 0) {
      return res
        .status(404)
        .json({ message: "No meetings found for this executive" });
    }

    const response = meetings.map((meeting) => {
      const freshLead = meeting.freshLead;
      const lead = freshLead?.lead;
      const clientLead = lead?.clientLead;

      return {
        ...meeting.toJSON(),
        clientLead: clientLead
          ? {
              id: clientLead.id,
              name: clientLead.name,
              email: clientLead.email,
              status: clientLead.status,
            }
          : null,
      };
    });

    return res.status(200).json({ data: response });
  } catch (error) {
    console.error("Error fetching meetings by executive:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// 📌 Create a new meeting

exports.createMeeting = async (req, res) => {
  try {
    const {
      clientName,
      clientEmail,
      clientPhone,
      reasonForFollowup,
      startTime,
      endTime,
      fresh_lead_id,
    } = req.body;
    const executiveId = req.user.id; // Extract executiveId from decoded token

    // Validate required fields
    if (
      !clientName ||
      !clientEmail ||
      !clientPhone ||
      !startTime ||
      !fresh_lead_id
    ) {
      return res.status(400).json({
        message:
          "clientName, clientEmail, clientPhone, startTime, and fresh_lead_id are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate startTime format and ensure it's a future date
    const startDate = new Date(startTime);
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ message: "Invalid startTime format" });
    }
    if (startDate < new Date()) {
      return res
        .status(400)
        .json({ message: "startTime must be in the future" });
    }

    // Validate endTime if provided
    if (endTime) {
      const endDate = new Date(endTime);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid endTime format" });
      }
      if (endDate <= startDate) {
        return res
          .status(400)
          .json({ message: "endTime must be after startTime" });
      }
    }

    // Find the related FreshLead
    const freshLead = await FreshLead.findByPk(fresh_lead_id);
    if (!freshLead) {
      return res.status(404).json({ message: "FreshLead not found" });
    }

    // Find the related Lead
    const lead = await Lead.findByPk(freshLead.leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Find the related ClientLead
    const clientLead = await ClientLead.findByPk(lead.clientLeadId);
    if (!clientLead) {
      return res.status(404).json({ message: "ClientLead not found" });
    }

    // Use a transaction to ensure data consistency
    const transaction = await Meeting.sequelize.transaction();
    try {
      // Update ClientLead status to "Meeting"
      await clientLead.update({ status: "Meeting" }, { transaction });

      // Create the meeting
      const meeting = await Meeting.create(
        {
          clientName,
          clientEmail,
          clientPhone,
          reasonForFollowup,
          startTime,
          endTime,
          executiveId,
          fresh_lead_id,
        },
        { transaction }
      );

      // Commit the transaction
      await transaction.commit();

      res.status(201).json({
        message: "Meeting created successfully",
        data: meeting,
      });
    } catch (error) {
      // Rollback the transaction on error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error creating meeting:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 📌 Update a meeting
exports.updateMeeting = async (req, res) => {
  try {
    const { title, description, startTime, endTime } = req.body;

    let meeting = await Meeting.findByPk(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    await meeting.update({ title, description, startTime, endTime });
    res.status(200).json(meeting);
  } catch (error) {
    console.error("Error updating meeting:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 📌 Delete a meeting
exports.deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findByPk(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    await meeting.destroy();
    res.status(200).json({ message: "Meeting deleted successfully" });
  } catch (error) {
    console.error("Error deleting meeting:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
