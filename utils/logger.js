const GuildConfig = require("../models/guildConfig");

module.exports = {
  async sendLog(guild, message, embed = null) {
    const config = await GuildConfig.findOne({ guildId: guild.id });
    if (!config || !config.logChannelId) return;

    const logChannel = guild.channels.cache.get(config.logChannelId);
    if (!logChannel) return;

    if (embed) logChannel.send({ content: message, embeds: [embed] });
    else logChannel.send({ content: message });
  },

  info(msg) {
    console.log(`ℹ️ ${msg}`);
  },

  warn(msg) {
    console.log(`⚠️ ${msg}`);
  },

  error(msg) {
    console.log(`❌ ${msg}`);
  },
};
