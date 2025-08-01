const { Op } = require("sequelize");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { sendExecutiveSignupEmail } = require("../services/signUpemailService"); // Adjust if path is different

require("dotenv").config();

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

//To Verify Executive Email
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/*-----------------------Login---------------------*/
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const Users = req.db.Users;

    const user = await Users.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.can_login) {
      return res
        .status(403)
        .json({ message: "Login access is disabled. Please contact admin." });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    user.is_online = true;
    await user.save();

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 12 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        is_online: user.is_online,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
/*---------------- Admin: Toggle can_login ----------------*/
const toggleUserLoginAccess = async (req, res) => {
  try {
    const Users = req.db.Users;

    // ✳️ Only Admins are allowed
    if (req.user.role !== "Admin") {
      return res
        .status(403)
        .json({ message: "Unauthorized: Only Admin can change login access." });
    }

    const { userId, can_login } = req.body;

    const user = await Users.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.can_login = can_login;
    await user.save();

    res.status(200).json({
      message: `User login access updated to '${can_login}'`,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        can_login: user.can_login,
      },
    });
  } catch (error) {
    console.error("Error toggling login access:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const Users = req.db.Users; // ✅ Dynamically selected DB
    const { id, role } = req.user;

    if (role === "Admin") {
      const users = await Users.findAll({
        attributes: {
          exclude: ["password", "resetPasswordToken", "resetPasswordExpiry"],
        },
      });
      return res.json(users);
    }

    if (role === "TL") {
      // Team Lead can see their team (Executives) and their own profile
      const users = await Users.findAll({
        where: {
          [Op.or]: [{ id: id }, { role: "Executive" }],
        },
        attributes: {
          exclude: ["password", "resetPasswordToken", "resetPasswordExpiry"],
        },
      });
      return res.json(users);
    }

    // Executive: see only own profile
    const user = await Users.findByPk(id, {
      attributes: {
        exclude: ["password", "resetPasswordToken", "resetPasswordExpiry"],
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const signupLocal = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const Users = req.db.Users;

    const validRoles = ["Admin", "TL", "Executive"];

    if (!username || !password || !role || !validRoles.includes(role)) {
      return res.status(400).json({
        error:
          "Username, password, and a valid role (Admin, TL, or Executive) are required.",
      });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format." });
    }

    // Check if username or email already exists
    const existingUser = await Users.findOne({
      where: { [Op.or]: [{ username }, { email }] },
    });

    if (existingUser) {
      let conflictField = "Username or email";
      if (existingUser.username === username) conflictField = "Username";
      else if (existingUser.email === email) conflictField = "Email";

      return res
        .status(400)
        .json({ error: `${conflictField} already exists.` });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await Users.create({
      username,
      email,
      password: hashedPassword,
      role,
    });

    // Send welcome email only for Executives
    if (role === "Executive") {
      const emailResult = await sendExecutiveSignupEmail(email, username);
      if (!emailResult.success) {
        console.warn("Signup email failed:", emailResult.message);
      }
    }

    return res.status(201).json({
      message: "User created successfully.",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    let errorMessage = "Internal server error.";
    if (error.name === "SequelizeValidationError") {
      errorMessage = error.errors.map((e) => e.message).join(", ");
    } else if (error.name === "SequelizeUniqueConstraintError") {
      errorMessage = "Username or email already exists.";
    }
    return res.status(500).json({ error: errorMessage });
  }
};

const getAdminDashboard = async (req, res) => {
  try {
    const Users = req.db.Users;

    const users = await Users.findAll({
      attributes: {
        exclude: ["password", "resetPasswordToken", "resetPasswordExpiry"],
      },
    });

    res.json({
      message: "Welcome to Admin Dashboard",
      users,
      currentUser: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role, // Make sure `req.user` includes this from auth middleware
      },
    });
    console.log("Admin dashboard accessed by user:", req.user.role);
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateAdminProfile = async (req, res) => {
  try {
    // Authentication check
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ message: "Unauthorized: User not authenticated" });
    }

    const Users = req.db.Users;

    if (!Users) {
      return res
        .status(500)
        .json({ message: "Database model Users not available" });
    }

    const userId = req.user.id;
    const user = await Users.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: "Admin not found." });
    }

    const {
      email,
      username,
      profile_picture,
      firstname,
      lastname,
      country,
      city,
      state,
      postal_code,
      tax_id,
    } = req.body;

    // Update only provided fields (fallback to existing values)
    user.username = username || user.username;
    user.email = email || user.email;
    user.profile_picture = profile_picture || user.profile_picture;
    user.firstname = firstname || user.firstname;
    user.lastname = lastname || user.lastname;
    user.country = country || user.country;
    user.city = city || user.city;
    user.state = state || user.state;
    user.postal_code = postal_code || user.postal_code;
    user.tax_id = tax_id || user.tax_id;

    await user.save();

    return res.status(200).json({
      message: "Admin profile updated successfully.",
      user,
    });
  } catch (error) {
    console.error("❌ Error updating admin profile:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const Users = req.db.Users;
    const userId = parseInt(req.params.id, 10);
    const requestingUser = req.user;

    // Only allow the user to update their own profile
    if (requestingUser.id !== userId) {
      return res.status(403).json({ message: "Access denied." });
    }

    const user = await Users.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const {
      username,
      email,
      profile_picture,
      firstname,
      lastname,
      country,
      city,
      state,
      postal_code,
      tax_id,
    } = req.body;

    // Update only allowed fields
    user.username = username || user.username;
    user.email = email || user.email;
    user.profile_picture = profile_picture || user.profile_picture;
    user.firstname = firstname || user.firstname;
    user.lastname = lastname || user.lastname;
    user.country = country || user.country;
    user.city = city || user.city;
    user.state = state || user.state;
    user.postal_code = postal_code || user.postal_code;
    user.tax_id = tax_id || user.tax_id;

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully.",
      user,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const changePassword = async (req, res) => {
  try {
    const Users = req.db.Users; // ✅ Scoped model
    const { currentPassword, newPassword } = req.body;
    const { id } = req.user; // ✅ User ID from token

    if (!id) {
      return res.status(401).json({ message: "Unauthorized access" });
    }

    const user = await Users.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password update error:", error); // ✅ Error log
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getTLDashboard = async (req, res) => {
  try {
    const Users = req.db.Users; // ✅ Use dynamic database

    const users = await Users.findAll({
      where: {
        [Op.or]: [{ id: req.user.id }, { role: "Executive" }],
      },
      attributes: {
        exclude: ["password", "resetPasswordToken", "resetPasswordExpiry"],
      },
    });

    res.json({
      message: "Welcome to Team Lead Dashboard",
      teamMembers: users,
      currentUser: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (error) {
    console.error("TL dashboard error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getExecutiveDashboard = async (req, res) => {
  try {
    const Users = req.db.Users; // ✅ Use the dynamically selected DB

    const user = await Users.findByPk(req.user.id, {
      attributes: {
        exclude: ["password", "resetPasswordToken", "resetPasswordExpiry"],
      },
    });

    res.json({
      message: "Welcome to Executive Dashboard",
      user,
    });
  } catch (error) {
    console.error("Executive dashboard error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
/*-------------------Executive Profile---------------------*/
const getExecutiveById = async (req, res) => {
  try {
    const Users = req.db.Users; // ✅ Dynamic database selection
    const userId = req.params.id;
    const requestingUser = req.user;

    // Restrict Executive from accessing other Executive profiles
    if (
      requestingUser.role === "Executive" &&
      requestingUser.id !== parseInt(userId, 10)
    ) {
      return res.status(403).json({ message: "Access denied." });
    }

    const executive = await Users.findOne({
      where: { id: userId, role: "Executive" },
      attributes: ["id", "username", "email", "role", "createdAt"],
    });

    if (!executive) {
      return res.status(404).json({ message: "Executive not found." });
    }

    res.status(200).json({ executive });
  } catch (error) {
    console.error("Error fetching executive:", error);
    res.status(500).json({ message: "Server error." });
  }
};

const getTLById = async (req, res) => {
  try {
    const Users = req.db.Users; // ✅ Dynamic database selection
    const tlId = req.params.id;
    const requestingUser = req.user;

    // Restrict TL from accessing other TL profiles
    if (
      requestingUser.role === "TL" &&
      requestingUser.id !== parseInt(tlId, 10)
    ) {
      return res.status(403).json({ message: "Access denied." });
    }

    const tl = await Users.findOne({
      where: { id: tlId, role: "TL" },
      attributes: [
        "id",
        "username",
        "email",
        "profile_picture",
        "firstname",
        "lastname",
        "country",
        "city",
        "state",
        "postal_code",
        "role",
        "createdAt",
      ],
    });

    res.status(200).json({ tl });
  } catch (error) {
    console.error("Error fetching TL:", error);
    res.status(500).json({ message: "Server error." });
  }
};
/*----------------------------Admin profile------------------*/
const getAdminById = async (req, res) => {
  try {
    const Users = req.db.Users; // ✅ Dynamic DB selection

    const adminId = req.user.id;

    const admin = await Users.findOne({
      where: { id: adminId, role: "Admin" },
      attributes: ["id", "username", "email", "role", "firstname", "lastname"],
    });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json(admin);
  } catch (error) {
    console.error("Error fetching admin details:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/*-------------------------Forgot Password--------------*/
const forgotPassword = async (req, res) => {
  try {
    const Users = req.db.Users; // ✅ Use dynamic database
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await Users.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

    await user.update({
      resetPasswordToken: resetToken,
      resetPasswordExpiry: resetTokenExpiry,
    });

    const resetUrl = `http://localhost:3000/reset-password?token=${resetToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Request",
      text: `Click this link to reset your password: ${resetUrl}\nThis link expires in 1 hour.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Password reset link sent to your email" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
/*--------------------------Logout----------------------*/
// Logout user by clearing the cookie
const logout = async (req, res) => {
  try {
    const Users = req.db.Users; // ✅ Use dynamic database
    const userId = req.user.id;

    const user = await Users.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.is_online = false;
    await user.save();

    res.clearCookie("token");

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/*-------------------------Reset Password--------------*/
const resetPassword = async (req, res) => {
  try {
    const Users = req.db.Users; // ✅ Use dynamic database
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ error: "Token and new password are required" });
    }

    const user = await Users.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiry: {
          [Op.gt]: Date.now(), // Token must not be expired
        },
      },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await user.update({
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpiry: null,
    });

    res.status(200).json({ message: "Password successfully reset" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// NEW API: Get all Executives
const getAllExecutives = async (req, res) => {
  try {
    const Users = req.db.Users; // ✅ Dynamic DB selection

    const executives = await Users.findAll({
      where: { role: "Executive" },
      attributes: {
        exclude: ["password", "resetPasswordToken", "resetPasswordExpiry"],
      },
    });

    res.status(200).json({
      message: "Executives retrieved successfully",
      executives,
    });
  } catch (error) {
    console.error("Error fetching executives:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
// NEW API: Get all Team Leads
const getAllTeamLeads = async (req, res) => {
  try {
    const Users = req.db.Users; // ✅ Use dynamic DB
    //const { role } = req.user;

    // Access control: Only Admin can access
    // if (role !== "Admin") {
    //   return res.status(403).json({
    //     message: "Unauthorized: Only Admin can view all team leads",
    //   });
    // }

    const teamLeads = await Users.findAll({
      where: { role: "TL" },
      attributes: {
        exclude: ["password", "resetPasswordToken", "resetPasswordExpiry"],
      },
    });

    res.status(200).json({
      message: "Team Leads retrieved successfully",
      teamLeads,
    });
  } catch (error) {
    console.error("Error fetching team leads:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
// NEW API: Get All Online Executives
const getOnlineExecutives = async (req, res) => {
  try {
    const Users = req.db.Users; // ✅ Dynamic database access
    const { role } = req.user;

    // Authorization: Only Admin and TL are allowed
    if (role !== "Admin" && role !== "TL" && role !== "Manager") {
      return res.status(403).json({
        message:
          "Unauthorized: Only Admin and TL,Manager can view online executives",
      });
    }

    const onlineExecutives = await Users.findAll({
      where: {
        role: "Executive",
        is_online: true,
      },
      attributes: ["id", "username", "email", "is_online", "updatedAt"],
    });

    res.status(200).json({
      message: "Online Executives fetched successfully",
      onlineExecutives,
    });
  } catch (error) {
    console.error("Error fetching online executives:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
const createExecutive = async (req, res) => {
  try {
    const Users = req.db.Users;

    const {
      username,
      email,
      password,
      profile_picture,
      team_id,
      firstname,
      lastname,
      country,
      city,
      state,
      postal_code,
      tax_id,
    } = req.body;

    // Basic validation
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required." });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format." });
    }

    // Prevent creating non-executive roles via this endpoint
    if (req.body.role && req.body.role !== "Executive") {
      return res
        .status(400)
        .json({ error: "This route only allows creation of Executives." });
    }

    // Check for duplicate username or email
    const existing = await Users.findOne({
      where: {
        [Op.or]: [{ username }, { email }],
      },
    });

    if (existing) {
      const conflictField =
        existing.username === username ? "Username" : "Email";
      return res
        .status(400)
        .json({ error: `${conflictField} already exists.` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newExecutive = await Users.create({
      username,
      email,
      password: hashedPassword,
      profile_picture,
      team_id,
      firstname,
      lastname,
      country,
      city,
      state,
      postal_code,
      tax_id,
      role: "Executive",
    });

    // Send welcome email
    if (email) {
      const emailResult = await sendExecutiveSignupEmail(email, username);
      if (!emailResult.success) {
        console.warn("Failed to send signup email:", emailResult.message);
      }
    }

    return res.status(201).json({
      message: "Executive created successfully.",
      executive: {
        id: newExecutive.id,
        username: newExecutive.username,
        email: newExecutive.email,
        role: newExecutive.role,
        team_id: newExecutive.team_id,
        firstname: newExecutive.firstname,
        lastname: newExecutive.lastname,
        createdAt: newExecutive.createdAt,
      },
    });
  } catch (error) {
    console.error("Create Executive error:", error);
    let msg = "Internal server error.";
    if (error.name === "SequelizeValidationError") {
      msg = error.errors.map((e) => e.message).join(", ");
    } else if (error.name === "SequelizeUniqueConstraintError") {
      msg = "Username or email already exists.";
    }
    return res.status(500).json({ error: msg });
  }
};
const createTeamLead = async (req, res) => {
  try {
    const Users = req.db.Users;

    const {
      username,
      email,
      password,
      profile_picture,
      team_id,
      firstname,
      lastname,
      country,
      city,
      state,
      postal_code,
      tax_id,
    } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required." });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format." });
    }

    if (req.body.role && req.body.role !== "TL") {
      return res
        .status(400)
        .json({ error: "This route only allows creation of Team Leads." });
    }

    const existing = await Users.findOne({
      where: {
        [Op.or]: [{ username }, { email }],
      },
    });

    if (existing) {
      const conflictField =
        existing.username === username ? "Username" : "Email";
      return res
        .status(400)
        .json({ error: `${conflictField} already exists.` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newTL = await Users.create({
      username,
      email,
      password: hashedPassword,
      profile_picture,
      team_id,
      firstname,
      lastname,
      country,
      city,
      state,
      postal_code,
      tax_id,
      role: "TL",
    });

    // Send welcome email
    if (email) {
      const emailResult = await sendExecutiveSignupEmail(email, username);
      if (!emailResult.success) {
        console.warn("Failed to send signup email:", emailResult.message);
      }
    }

    return res.status(201).json({
      message: "Team Lead created successfully.",
      team_lead: {
        id: newTL.id,
        username: newTL.username,
        email: newTL.email,
        role: newTL.role,
        team_id: newTL.team_id,
        firstname: newTL.firstname,
        lastname: newTL.lastname,
        createdAt: newTL.createdAt,
      },
    });
  } catch (error) {
    console.error("Create TL error:", error);
    let msg = "Internal server error.";
    if (error.name === "SequelizeValidationError") {
      msg = error.errors.map((e) => e.message).join(", ");
    } else if (error.name === "SequelizeUniqueConstraintError") {
      msg = "Username or email already exists.";
    }
    return res.status(500).json({ error: msg });
  }
};
const createAdmin = async (req, res) => {
  try {
    const Users = req.db.Users;

    const {
      username,
      email,
      password,
      profile_picture,
      firstname,
      lastname,
      country,
      city,
      state,
      postal_code,
      tax_id,
    } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required." });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format." });
    }

    if (req.body.role && req.body.role !== "Admin") {
      return res
        .status(400)
        .json({ error: "This route only allows creation of Admins." });
    }

    const existing = await Users.findOne({
      where: {
        [Op.or]: [{ username }, { email }],
      },
    });

    if (existing) {
      const conflictField =
        existing.username === username ? "Username" : "Email";
      return res
        .status(400)
        .json({ error: `${conflictField} already exists.` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = await Users.create({
      username,
      email,
      password: hashedPassword,
      profile_picture,
      firstname,
      lastname,
      country,
      city,
      state,
      postal_code,
      tax_id,
      role: "Admin",
    });

    // Send welcome email
    if (email) {
      const emailResult = await sendExecutiveSignupEmail(email, username);
      if (!emailResult.success) {
        console.warn("Failed to send signup email:", emailResult.message);
      }
    }

    return res.status(201).json({
      message: "Admin created successfully.",
      admin: {
        id: newAdmin.id,
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role,
        firstname: newAdmin.firstname,
        lastname: newAdmin.lastname,
        createdAt: newAdmin.createdAt,
      },
    });
  } catch (error) {
    console.error("Create Admin error:", error);
    let msg = "Internal server error.";
    if (error.name === "SequelizeValidationError") {
      msg = error.errors.map((e) => e.message).join(", ");
    } else if (error.name === "SequelizeUniqueConstraintError") {
      msg = "Username or email already exists.";
    }
    return res.status(500).json({ error: msg });
  }
};

const createExecutiveWithOtp = async (req, res) => {
  try {
    const { Users, UnverifiedUser } = req.db;

    const {
      username,
      email,
      password,
      profile_picture,
      team_id,
      firstname,
      lastname,
      country,
      city,
      state,
      postal_code,
      tax_id,
    } = req.body;

    // Basic validation
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required." });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format." });
    }

    // Prevent creating non-executive roles via this endpoint
    if (req.body.role && req.body.role !== "Executive") {
      return res
        .status(400)
        .json({ error: "This route only allows creation of Executives." });
    }

    // Check for duplicate username or email
    const existing = await Users.findOne({
      where: {
        [Op.or]: [{ username }, { email }],
      },
    });

    if (existing) {
      const conflictField =
        existing.username === username ? "Username" : "Email";
      return res
        .status(400)
        .json({ error: `${conflictField} already exists.` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    const newExecutive = await UnverifiedUser.create({
      username,
      email,
      password: hashedPassword,
      profile_picture,
      team_id,
      firstname,
      lastname,
      country,
      city,
      state,
      postal_code,
      tax_id,
      role: "Executive",
      otp,
      otpExpiry,
    });

    // Send OTP email
    if (email) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "OTP Verification - Executive Account",
        text: `Hello ${username},\n\nYour OTP for email verification is: ${otp}\nThis OTP will expire in 10 minutes.\n\nThank you.`,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (emailErr) {
        console.warn("⚠️ Failed to send OTP email:", emailErr.message);
        // Optional: rollback user creation here
      }
    }

    return res.status(201).json({
      message: "Executive created successfully. OTP sent to email.",
      executive: {
        id: newExecutive.id,
        username: newExecutive.username,
        email: newExecutive.email,
        role: newExecutive.role,
        team_id: newExecutive.team_id,
        firstname: newExecutive.firstname,
        lastname: newExecutive.lastname,
        createdAt: newExecutive.createdAt,
      },
    });
  } catch (error) {
    console.error("Create Executive error:", error);
    let msg = "Internal server error.";
    if (error.name === "SequelizeValidationError") {
      msg = error.errors.map((e) => e.message).join(", ");
    } else if (error.name === "SequelizeUniqueConstraintError") {
      msg = "Username or email already exists.";
    }
    return res.status(500).json({ error: msg });
  }
};

const verifyExecutiveOTP = async (req, res) => {
  const { email, otp } = req.body;
  const { Users, UnverifiedUser } = req.db;

  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required." });
  }

  const pendingUser = await UnverifiedUser.findOne({ where: { email } });

  if (!pendingUser) {
    return res
      .status(404)
      .json({ error: "No pending registration found for this email." });
  }

  if (pendingUser.otp !== otp) {
    return res.status(400).json({ error: "Invalid OTP." });
  }

  if (Date.now() > pendingUser.otpExpiry) {
    return res.status(400).json({ error: "OTP has expired." });
  }

  // Check again in Users to avoid duplicates
  const existing = await Users.findOne({
    where: {
      [Op.or]: [{ email }, { username: pendingUser.username }],
    },
  });

  if (existing) {
    return res.status(400).json({ error: "User already exists in system." });
  }

  // Create verified user
  const verifiedUser = await Users.create({
    username: pendingUser.username,
    email: pendingUser.email,
    password: pendingUser.password,
    profile_picture: pendingUser.profile_picture,
    team_id: pendingUser.team_id,
    firstname: pendingUser.firstname,
    lastname: pendingUser.lastname,
    country: pendingUser.country,
    city: pendingUser.city,
    state: pendingUser.state,
    postal_code: pendingUser.postal_code,
    tax_id: pendingUser.tax_id,
    role: pendingUser.role,
    can_login: true,
  });

  // Delete from unverified
  await pendingUser.destroy();

  return res.status(200).json({
    message: "OTP verified and user activated.",
    user: {
      id: verifiedUser.id,
      username: verifiedUser.username,
      email: verifiedUser.email,
      role: verifiedUser.role,
    },
  });
};

const resendExecutiveOtp = async (req, res) => {
  const { email } = req.body;
  const { UnverifiedUser } = req.db;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email is required." });
  }

  try {
    const unverified = await UnverifiedUser.findOne({ where: { email } });

    if (!unverified) {
      return res
        .status(404)
        .json({ error: "No unverified user found with this email." });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    unverified.otp = otp;
    unverified.otpExpiry = otpExpiry;
    await unverified.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Resend OTP - Executive Account",
      text: `Hello ${unverified.username},\n\nYour new OTP is: ${otp}\nThis OTP will expire in 10 minutes.\n\nThank you.`,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ message: "OTP resent successfully." });
  } catch (err) {
    console.error("Error resending OTP:", err.message, err.stack);
    return res.status(500).json({
      message: "Something went wrong while resending OTP.",
      error: err.stack,
    });
  }
};

// Export all controller methods
module.exports = {
  login,
  getUserProfile,
  signupLocal,
  forgotPassword,
  resetPassword,

  getAdminDashboard,
  updateAdminProfile,
  updateUserProfile,
  changePassword,

  getTLDashboard,
  getAdminById,
  logout,
  getExecutiveDashboard,
  getAllExecutives,
  getExecutiveById,
  getAllTeamLeads,
  getOnlineExecutives,
  toggleUserLoginAccess,
  createExecutive,
  createTeamLead,
  createAdmin,
  getTLById,
  createExecutiveWithOtp,
  verifyExecutiveOTP,
  resendExecutiveOtp,
};
