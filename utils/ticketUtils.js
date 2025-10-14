const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const Ticket = require("../models/ticket");

/**
 * Creates a ticket channel with appropriate permissions & embed
 */
async function createTicket(interaction, config, buttonConfig, reason) {
  const existing = await Ticket.findOne({
    guildId: interaction.guild.id,
    userId: interaction.user.id,
    status: "open",
  });

  if (existing) {
    return interaction.reply({
      content: `❌ You already have an open ticket: <#${existing.channelId}>`,
      ephemeral: true,
    });
  }

  const category = interaction.guild.channels.cache.get(buttonConfig.categoryId);
  const channelName = `ticket-${interaction.user.username}`.toLowerCase();

  const channel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category?.id || null,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ...config.supportRoles.map(rid => ({
        id: rid,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages,
        ],
      })),
    ],
  });

  await Ticket.create({
    guildId: interaction.guild.id,
    userId: interaction.user.id,
    channelId: channel.id,
    reason,
    status: "open",
    createdAt: new Date(),
  });

  // Ticket control buttons
  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_close").setLabel("Close").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ticket_warn").setLabel("Warn").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("ticket_delete").setLabel("Delete").setStyle(ButtonStyle.Danger)
  );

  const openEmbed = new EmbedBuilder()
    .setTitle(`🎟️ Ticket Opened: ${buttonConfig.label}`)
    .setDescription(`**Opened by:** ${interaction.user}\n**Reason:** ${reason}`)
    .setColor("Blue")
    .setTimestamp();

  await channel.send({
    content: `${interaction.user} <@&${config.supportRoles[0]}>`,
    embeds: [openEmbed],
    components: [controls],
  });

  await interaction.reply({
    content: `✅ Your ticket has been created: ${channel}`,
    ephemeral: true,
  });
}

/**
 * Logs ticket events to the configured log channel
 */
async function logTicketAction(guild, config, description) {
  if (!config.logChannelId) return;
  const logChannel = guild.channels.cache.get(config.logChannelId);
  if (!logChannel) return;

  const logEmbed = new EmbedBuilder()
    .setTitle("🎫 Ticket Log")
    .setDescription(description)
    .setColor("Grey")
    .setTimestamp();

  await logChannel.send({ embeds: [logEmbed] });
}

module.exports = {
  createTicket,
  logTicketAction,
};
