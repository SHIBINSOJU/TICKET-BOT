const { Schema, model } = require("mongoose");

const warnDataSchema = new Schema({
  guildId: String,
  ticketId: String,
  warnedUserId: String,
  warnedById: String,
  reason: { type: String, default: "No reason provided" },
  date: { type: Date, default: Date.now }
});

module.exports = model("WarnData", warnDataSchema);
