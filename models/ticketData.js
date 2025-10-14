const { Schema, model } = require("mongoose");

const ticketDataSchema = new Schema({
  guildId: String,
  channelId: String,
  ticketId: String,          // ex: ticket-shibinsoju-001
  creatorId: String,
  reason: String,
  claimedBy: { type: String, default: null },
  status: { type: String, enum: ["open", "closed"], default: "open" },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null }
});

module.exports = model("TicketData", ticketDataSchema);
