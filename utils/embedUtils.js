const { EmbedBuilder } = require("discord.js");

module.exports = {
  createEmbed({ title, description, color = "#ff3131", footer, fields = [] }) {
    const embed = new EmbedBuilder()
      .setColor(color)
      .setDescription(description || null)
      .setFields(fields);

    if (title) embed.setTitle(title);
    if (footer) embed.setFooter({ text: footer });

    return embed;
  },

  success(message) {
    return this.createEmbed({
      color: "#00ff99",
      description: `✅ ${message}`,
    });
  },

  error(message) {
    return this.createEmbed({
      color: "#ff3131",
      description: `❌ ${message}`,
    });
  },
};
