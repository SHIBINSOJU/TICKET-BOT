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
const { createTicket, logTicketAction } = require("../utils/ticketUtils");
const { generateTranscript } = require("../utils/transcriptUtils");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {

    // ================== 🎫 Ticket Button Click ==================
    if (interaction.isButton() && interaction.customId.startsWith("ticket_") && !["ticket_close","ticket_warn","ticket_delete","confirm_close","cancel_close"].includes(interaction.customId)) {
      const buttonId = interaction.customId.replace("ticket_", "");
      const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
      if (!config) return interaction.reply({ content: "❌ Run `/setup` first.", ephemeral: true });

      const buttonConfig = config.ticketButtons.find(b => b.id === buttonId);
      if (!buttonConfig) return interaction.reply({ content: "❌ Invalid button configuration.", ephemeral: true });

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

    // ================== 📝 Modal Submission ==================
    if (interaction.isModalSubmit() && interaction.customId.startsWith("reason_")) {
      const buttonId = interaction.customId.replace("reason_", "");
      const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
      if (!config) return;

      const buttonConfig = config.ticketButtons.find(b => b.id === buttonId);
      if (!buttonConfig) return;

      const reason = interaction.fields.getTextInputValue("ticket_reason");

      // Create ticket using utils
      await createTicket(interaction, config, buttonConfig, reason);
      await logTicketAction(interaction.guild, config, `🟢 Ticket created by ${interaction.user} - ${buttonConfig.label}`);
    }

    // ================== ⚙️ Ticket Controls ==================
    if (interaction.isButton() && ["ticket_close","ticket_warn","ticket_delete","confirm_close","cancel_close"].includes(interaction.customId)) {
      const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
      if (!ticket) return interaction.reply({ content: "❌ Not a valid ticket.", ephemeral: true });

      const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
      if (!config) return;

      const member = await interaction.guild.members.fetch(ticket.userId).catch(() => null);

      // ----- Warn Button -----
      if (interaction.customId === "ticket_warn") {
        if (!member) return interaction.reply({ content: "❌ User not found.", ephemeral: true });

        await member.send(`⚠️ You have been warned by staff in **${interaction.guild.name}** regarding your ticket.`).catch(() => null);
        await logTicketAction(interaction.guild, config, `⚠️ User ${member.user.tag} was warned in ticket ${interaction.channel.name} by ${interaction.user.tag}`);
        return interaction.reply({ content: "✅ User warned successfully.", ephemeral: true });
      }

      // ----- Close Button -----
      if (interaction.customId === "ticket_close") {
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("confirm_close").setLabel("Confirm Close").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("cancel_close").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({ content: "Are you sure you want to close this ticket?", components: [confirmRow], ephemeral: true });
      }

      // ----- Confirm Close -----
      if (interaction.customId === "confirm_close") {
        await interaction.channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: false });
        ticket.status = "closed";
        ticket.closedAt = new Date();
        await ticket.save();

        // Generate transcript
        const filePath = await generateTranscript(interaction.channel);
        if (config.logChannelId) {
          const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
          if (logChannel) {
            await logChannel.send({ content: `📄 Transcript for ticket ${interaction.channel.name}:`, files: [filePath] });
            await logTicketAction(interaction.guild, config, `🔴 Ticket closed by ${interaction.user.tag} - ${interaction.channel.name}`);
          }
        }

        return interaction.reply({ content: "✅ Ticket closed.", ephemeral: true });
      }

      // ----- Cancel Close -----
      if (interaction.customId === "cancel_close") {
        return interaction.update({ content: "❌ Ticket close cancelled.", components: [], ephemeral: true });
      }

      // ----- Delete Button -----
      if (interaction.customId === "ticket_delete") {
        // Generate transcript
        const filePath = await generateTranscript(interaction.channel);
        if (config.logChannelId) {
          const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
          if (logChannel) {
            await logChannel.send({ content: `📄 Transcript for ticket ${interaction.channel.name}:`, files: [filePath] });
            await logTicketAction(interaction.guild, config, `🗑️ Ticket deleted by ${interaction.user.tag} - ${interaction.channel.name}`);
          }
        }

        await Ticket.deleteOne({ channelId: interaction.channel.id });
        return interaction.channel.delete().catch(() => null);
      }
    }
  },
};
