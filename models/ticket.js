const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  guildId: String,
  userId: String,
  channelId: String,
  buttonId: String,
  reason: String,
  createdAt: { type: Date, default: Date.now },
  claimedBy: { type: String, default: null },
  status: { type: String, default: "open" },
});

module.exports = mongoose.model("Ticket", ticketSchema);
