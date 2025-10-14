const { PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const GuildConfig = require("../models/guildConfig");
const TicketData = require("../models/ticketData");
const WarnData = require("../models/warnData");
const embeds = require("./embedUtils");

module.exports = {
  async createTicket(interaction, buttonConfig, reason) {
    const guild = interaction.guild;
    const member = interaction.member;
    const config = await GuildConfig.findOne({ guildId: guild.id });
    if (!config) return interaction.reply({ embeds: [embeds.error("Server not configured.")], ephemeral: true });

    const count = config.ticketCount + 1;
    const ticketName = `ticket-${member.user.username.toLowerCase()}-${count}`;

    const category = guild.channels.cache.get(buttonConfig.categoryId);
    if (!category) return interaction.reply({ embeds: [embeds.error("Invalid category in config.")], ephemeral: true });

    const channel = await guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        ...config.supportRoles.map(r => ({
          id: r,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        })),
      ],
    });

    // Save ticket
    await TicketData.create({
      guildId: guild.id,
      channelId: channel.id,
      ticketId: ticketName,
      creatorId: member.id,
      reason: reason,
    });

    await GuildConfig.updateOne({ guildId: guild.id }, { $inc: { ticketCount: 1 } });

    // Control buttons
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_ticket").setLabel("Close").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("claim_ticket").setLabel("Claim").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("add_member").setLabel("Add Member").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("warn_user").setLabel("Warn").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("delete_ticket").setLabel("Delete").setStyle(ButtonStyle.Danger)
    );

    const ticketEmbed = embeds.createEmbed({
      title: "🎫 New Ticket Created",
      description: `**Created by:** ${member}\n**Reason:** ${reason}`,
      color: "#00bfff",
      footer: "Ticket System • ShotDevs",
    });

    await channel.send({ content: `<@&${config.supportRoles[0]}>`, embeds: [ticketEmbed], components: [buttons] });
    await interaction.reply({ embeds: [embeds.success(`Ticket created: ${channel}`)], ephemeral: true });
  },

  async warnUser(interaction, ticket) {
    const data = await TicketData.findOne({ channelId: interaction.channel.id });
    if (!data) return interaction.reply({ embeds: [embeds.error("Ticket not found.")], ephemeral: true });

    const user = await interaction.guild.members.fetch(data.creatorId).catch(() => null);
    if (!user) return interaction.reply({ embeds: [embeds.error("User not found.")], ephemeral: true });

    const reason = "Violation of ticket rules";

    await user.send({
      embeds: [
        embeds.createEmbed({
          title: "⚠️ Warning Received",
          description: `You were warned in **${interaction.guild.name}** by ${interaction.user}.\n**Reason:** ${reason}`,
          color: "#ff990
