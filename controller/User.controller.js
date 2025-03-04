// controllers/User.controller.js
const { Users } = require("../config/sequelize"); // Import the Users model from db
const { Op } = require("sequelize"); // Import Sequelize operators
const bcrypt = require("bcrypt");
const passport = require("passport");
require("dotenv").config();
const jwt = require("jsonwebtoken");

/*-----------------------Login---------------------*/
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await Users.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: false, // Change this to true in production (HTTPS)
      sameSite: "Lax", // Helps prevent CSRF attacks
      maxAge: 3600000, // 1 hour
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/*-------------------------User Profile--------------*/
const getUserProfile = async (req, res) => {
  try {
    const user = await Users.findByPk(req.user.userId, {
      attributes: { exclude: ["password"] }, // Don't return the password
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

// Local Signup (username/email/password)
const signupLocal = async (req, res) => {
  console.log("Signup request received:", req.body);
  try {
    const { username, email, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    // Additional validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if user already exists
    const existingUser = await Users.findOne({
      where: {
        [Op.or]: [{ username }, { email }], // Use Op.or for Sequelize v6+
      },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ error: "Username or email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = await Users.create({
      username,
      email,
      password: hashedPassword,
      oauth_provider: "local",
    });

    console.log("User created:", user.username);
    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error.message || error);
    let errorMessage = "Internal server error";
    if (error.name === "SequelizeValidationError") {
      errorMessage = error.errors.map((e) => e.message).join(", ");
    } else if (error.name === "SequelizeUniqueConstraintError") {
      errorMessage = "Username or email already exists";
    }
    return res.status(500).json({ error: errorMessage });
  }
};

// OAuth Signup Handler (for Twitter, Facebook, LinkedIn)
const handleOAuthSignup = async (profile, provider, done) => {
  try {
    // Check if user exists with this OAuth ID
    let user = await Users.findOne({
      where: {
        [Op.or]: [
          { oauth_id: profile.id, oauth_provider: provider },
          { email: profile.emails ? profile.emails[0].value : null },
        ],
      },
    });

    if (user) {
      return done(null, false, {
        message: `User already exists with this ${provider} account or email`,
      });
    }

    // Create new user if not found
    user = await Users.create({
      username:
        profile.displayName || `${provider}_${profile.id}`.substring(0, 25), // Truncate if too long
      email: profile.emails ? profile.emails[0].value : null,
      oauth_provider: provider,
      oauth_id: profile.id,
      profile_picture: profile.photos ? profile.photos[0].value : null,
    });

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
};

// Controller methods for each OAuth provider callback
const oauthCallback = (provider) => {
  return async (req, res) => {
    try {
      const user = req.user;

      // Generate JWT token (optional, for authentication state)
      const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.json({
        message: `${provider} signup successful`,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          profile_picture: user.profile_picture,
        },
        token, // Return the JWT token for frontend use (optional)
      });
    } catch (error) {
      res.status(500).json({ error: "Signup failed" });
    }
  };
};

// Twitter signup
const signupTwitter = passport.authenticate("twitter");
const twitterCallback = [
  passport.authenticate("twitter", { session: false }),
  oauthCallback("twitter"),
];

// Export all controller methods
module.exports = {
  login,
  getUserProfile,
  signupLocal,
  signupTwitter,
  twitterCallback,

  // Facebook signup (unchanged, remove if not needed)
  signupFacebook: passport.authenticate("facebook", { scope: ["email"] }),
  facebookCallback: [
    passport.authenticate("facebook", { session: false }),
    oauthCallback("facebook"),
  ],

  // LinkedIn signup (unchanged, remove if not needed)
  signupLinkedin: passport.authenticate("linkedin"),
  linkedinCallback: [
    passport.authenticate("linkedin", { session: false }),
    oauthCallback("linkedin"),
  ],
};
