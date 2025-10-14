const {
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require("discord.js");

const GuildConfig = require("../models/guildConfig");
const Ticket = require("../models/ticket");
const embeds = require("../utils/embedUtils");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {

    // ========== 🎫 Ticket Button Click ==========
    if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
      const buttonId = interaction.customId.replace("ticket_", "");
      const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
      if (!config) return interaction.reply({ content: "❌ Run `/setup` first.", ephemeral: true });

      const buttonConfig = config.ticketButtons.find(b => b.id === buttonId);
      if (!buttonConfig)
        return interaction.reply({ content: "❌ Invalid button config.", ephemeral: true });

      // Show modal for ticket reason
      const modal = new ModalBuilder()
        .setCustomId(`reason_${buttonId}`)
        .setTitle(`Ticket - ${buttonConfig.label}`);

      const reasonInput = new TextInputBuilder()
        .setCustomId("ticket_reason")
        .setLabel("Why are you opening this ticket?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      await interaction.showModal(modal);
    }

    // ========== 📝 Modal Submission (Reason) ==========
    if (interaction.isModalSubmit() && interaction.customId.startsWith("reason_")) {
      const buttonId = interaction.customId.replace("reason_", "");
      const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
      if (!config) return;

      const buttonConfig = config.ticketButtons.find(b => b.id === buttonId);
      if (!buttonConfig) return;

      const reason = interaction.fields.getTextInputValue("ticket_reason");

      const category = interaction.guild.channels.cache.get(buttonConfig.categoryId);
      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category?.id || null,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          ...config.supportRoles.map(rid => ({
            id: rid,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages],
          })),
        ],
      });

      // Save to DB
      await Ticket.create({
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        channelId: channel.id,
        reason,
        status: "open",
        createdAt: new Date(),
      });

      // Buttons inside ticket channel
      const controlRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_close").setLabel("Close").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ticket_warn").setLabel("Warn").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("ticket_delete").setLabel("Delete").setStyle(ButtonStyle.Danger)
      );

      const openEmbed = new EmbedBuilder()
        .setTitle(`🎟️ Ticket Opened: ${buttonConfig.label}`)
        .setColor("Blue")
        .setDescription(`**Opened by:** ${interaction.user}\n**Reason:** ${reason}`)
        .setTimestamp();

      await channel.send({
        content: `${interaction.user} <@&${config.supportRoles[0]}>`,
        embeds: [openEmbed],
        components: [controlRow],
      });

      await interaction.reply({ content: `✅ Your ticket has been created: ${channel}`, ephemeral: true });
    }

    // ========== ⚙️ Ticket Controls ==========
    if (interaction.isButton() && ["ticket_close", "ticket_warn", "ticket_delete"].includes(interaction.customId)) {
      const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
      if (!ticket) return interaction.reply({ content: "❌ Not a valid ticket.", ephemeral: true });

      const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
      const member = await interaction.guild.members.fetch(ticket.userId);

      // Warn
      if (interaction.customId === "ticket_warn") {
        await member.send(`⚠️ You have been warned by staff in **${interaction.guild.name}** regarding your ticket.`)
          .catch(() => null);
        return interaction.reply({ content: "✅ User has been warned via DM.", ephemeral: true });
      }

      // Close
      if (interaction.customId === "ticket_close") {
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("confirm_close").setLabel("Confirm Close").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("cancel_close").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({ content: "Are you sure you want to close this ticket?", components: [confirmRow], ephemeral: true });
      }

      // Confirm close
      if (interaction.customId === "confirm_close") {
        await interaction.channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: false });
        ticket.status = "closed";
        await ticket.save();
        return interaction.reply({ content: "✅ Ticket closed.", ephemeral: true });
      }

      // Delete
      if (interaction.customId === "ticket_delete") {
        await interaction.channel.delete().catch(() => null);
        await Ticket.deleteOne({ channelId: interaction.channel.id });
      }
    }
  },
};
