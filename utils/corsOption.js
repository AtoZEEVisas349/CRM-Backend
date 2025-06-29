const allowedOrigins = [
  "http://localhost:3000",
  "https://crm-frontend-atozeevisas.vercel.app",
  "https://crm-frontend-live.vercel.app",
  "https://crm-frontend-eta-olive.vercel.app",
];

module.exports = {
  origin: allowedOrigins,
  credentials: true,
};

// const allowedOrigins = [
//   "http://localhost:3000",
//   "https://crm-frontend-atozeevisas.vercel.app",
//   "https://crm-frontend-live.vercel.app",
//   "https://crm-frontend-eta-olive.vercel.app",
// ];

// const corsOptions = {
//   origin: function (origin, callback) {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: [
//     "Content-Type",
//     "Authorization",
//     "x-company-id", // if you're using this
//   ],
// };

// module.exports = corsOptions;
