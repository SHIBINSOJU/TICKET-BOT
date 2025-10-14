const { Schema, model } = require("mongoose");

const ticketButtonSchema = new Schema({
  id: String,              // internal button ID
  label: String,           // button text
  emoji: String,           // optional emoji
  color: String,           // Primary, Secondary, Success, Danger
  categoryId: String,      // category for ticket creation
  message: String          // first embed message in ticket
});

const guildConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  logChannelId: { type: String, default: null },
  supportRoles: { type: [String], default: [] },
  ticketButtons: { type: [ticketButtonSchema], default: [] },
  ticketCount: { type: Number, default: 0 }
});

module.exports = model("GuildConfig", guildConfigSchema);
