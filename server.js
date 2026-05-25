require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/plot_bid_logger";

const USERS = [
  { userId: "USR001", name: "Amit" },
  { userId: "USR002", name: "Priya" },
  { userId: "USR003", name: "Rahul" },
  { userId: "USR004", name: "Neha" }
];

const plotBidSchema = new mongoose.Schema(
  {
    plotId: { type: String, required: true, trim: true },
    details: { type: String, required: true, trim: true },
    bidAmount: { type: Number, required: true, min: 0 },
    loggedBy: {
      userId: { type: String, required: true },
      name: { type: String, required: true }
    },
    logTime: { type: Date, required: true, default: Date.now }
  },
  { timestamps: true }
);

const auditLogSchema = new mongoose.Schema(
  {
    plotBidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlotBid",
      required: true
    },
    action: { type: String, enum: ["CREATE", "UPDATE"], required: true },
    user: {
      userId: { type: String, required: true },
      name: { type: String, required: true }
    },
    changedFields: [
      {
        field: { type: String, required: true },
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed
      }
    ],
    createdAt: { type: Date, required: true, default: Date.now }
  },
  { versionKey: false }
);

const PlotBid = mongoose.model("PlotBid", plotBidSchema);
const AuditLog = mongoose.model("AuditLog", auditLogSchema);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function getUser(userId) {
  return USERS.find((user) => user.userId === userId);
}

function requireUser(req, res, next) {
  const user = getUser(req.body.userId);

  if (!user) {
    return res.status(400).json({
      message: "Invalid user id. Please choose one of the configured users."
    });
  }

  req.currentUser = user;
  next();
}

function normalizeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
}

app.get("/api/users", (req, res) => {
  // Keep frontend API stable (`id`) while server stores canonical `userId`.
  res.json(USERS.map((user) => ({ id: user.userId, name: user.name })));
});

app.get("/api/plot-bids", async (req, res, next) => {
  try {
    const filter = {};
    const userId = String(req.query.userId || "").trim();

    if (userId) {
      filter["loggedBy.userId"] = userId;
    }

    const bids = await PlotBid.find(filter).sort({ logTime: -1 });
    res.json(bids);
  } catch (error) {
    next(error);
  }
});

app.post("/api/plot-bids", requireUser, async (req, res, next) => {
  try {
    const plotId = String(req.body.plotId || "").trim();
    const details = String(req.body.details || "").trim();
    const bidAmount = normalizeAmount(req.body.bidAmount);

    if (!plotId || !details || Number.isNaN(bidAmount) || bidAmount < 0) {
      return res.status(400).json({
        message: "Plot ID, details, and a valid bid amount are required."
      });
    }

    const now = new Date();
    const actor = { userId: req.currentUser.userId, name: req.currentUser.name };
    const bid = await PlotBid.create({
      plotId,
      details,
      bidAmount,
      loggedBy: actor,
      logTime: now
    });

    await AuditLog.create({
      plotBidId: bid._id,
      action: "CREATE",
      user: actor,
      changedFields: [
        { field: "plotId", oldValue: null, newValue: plotId },
        { field: "details", oldValue: null, newValue: details },
        { field: "bidAmount", oldValue: null, newValue: bidAmount }
      ],
      createdAt: now
    });

    res.status(201).json(bid);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/plot-bids/:id", requireUser, async (req, res, next) => {
  try {
    const bid = await PlotBid.findById(req.params.id);

    if (!bid) {
      return res.status(404).json({ message: "Plot bid not found." });
    }

    const nextPlotId = String(req.body.plotId || "").trim();
    const nextDetails = String(req.body.details || "").trim();
    const nextBidAmount = normalizeAmount(req.body.bidAmount);

    if (!nextPlotId || !nextDetails || Number.isNaN(nextBidAmount) || nextBidAmount < 0) {
      return res.status(400).json({
        message: "Plot ID, details, and a valid bid amount are required."
      });
    }

    const changedFields = [];

    if (bid.plotId !== nextPlotId) {
      changedFields.push({
        field: "plotId",
        oldValue: bid.plotId,
        newValue: nextPlotId
      });
      bid.plotId = nextPlotId;
    }

    if (bid.details !== nextDetails) {
      changedFields.push({
        field: "details",
        oldValue: bid.details,
        newValue: nextDetails
      });
      bid.details = nextDetails;
    }

    if (bid.bidAmount !== nextBidAmount) {
      changedFields.push({
        field: "bidAmount",
        oldValue: bid.bidAmount,
        newValue: nextBidAmount
      });
      bid.bidAmount = nextBidAmount;
    }

    if (changedFields.length === 0) {
      return res.json(bid);
    }

    const now = new Date();
    const actor = { userId: req.currentUser.userId, name: req.currentUser.name };
    bid.loggedBy = actor;
    bid.logTime = now;
    await bid.save();

    await AuditLog.create({
      plotBidId: bid._id,
      action: "UPDATE",
      user: actor,
      changedFields,
      createdAt: now
    });

    res.json(bid);
  } catch (error) {
    next(error);
  }
});

app.get("/api/audit-logs", async (req, res, next) => {
  try {
    const logs = await AuditLog.find()
      .populate("plotBidId", "plotId details")
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    message: "Something went wrong on the server.",
    detail: error.message
  });
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Plot Bid Logger running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
