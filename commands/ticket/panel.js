const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const GuildConfig = require("../../models/guildConfig");
const embeds = require("../../utils/embedUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Create a ticket panel with multiple buttons.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName("title").setDescription("Embed title").setRequired(true))
    .addStringOption(opt =>
      opt.setName("description").setDescription("Embed description").setRequired(true))
    .addStringOption(opt =>
      opt.setName("buttons")
        .setDescription("Buttons JSON (label,emoji,color,category,message)")
        .setRequired(true)),

  async execute(interaction) {
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const rawButtons = interaction.options.getString("buttons");

    let buttonsData;
    try {
      buttonsData = JSON.parse(rawButtons);
    } catch (err) {
      return interaction.reply({
        embeds: [embeds.error("❌ Invalid JSON format for buttons.")],
        ephemeral: true,
      });
    }

    const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (!config) {
      return interaction.reply({
        embeds: [embeds.error("Run `/setup` first to configure server!")],
        ephemeral: true,
      });
    }

    // Build ActionRow with multiple buttons
    const row = new ActionRowBuilder();
    const validColors = {
      primary: ButtonStyle.Primary,
      secondary: ButtonStyle.Secondary,
      success: ButtonStyle.Success,
      danger: ButtonStyle.Danger,
    };

    for (const b of buttonsData) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_${b.id}`)
          .setLabel(b.label)
          .setStyle(validColors[b.color?.toLowerCase()] || ButtonStyle.Primary)
          .setEmoji(b.emoji || "")
      );
    }

    // Save button config
    config.ticketButtons = buttonsData.map(b => ({
      id: b.id,
      label: b.label,
      emoji: b.emoji || "",
      color: b.color || "Primary",
      categoryId: b.category,
      message: b.message || "",
    }));

    await config.save();

    const panelEmbed = embeds.createEmbed({
      title,
      description,
      color: "#00bfff",
    });

    const msg = await interaction.channel.send({
      embeds: [panelEmbed],
      components: [row],
    });

    await interaction.reply({
      embeds: [embeds.success(`✅ Ticket panel created successfully!`)], 
      ephemeral: true,
    });
  },
};
