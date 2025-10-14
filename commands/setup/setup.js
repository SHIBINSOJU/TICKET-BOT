const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const GuildConfig = require("../../models/guildConfig");
const embeds = require("../../utils/embedUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure ticket system for this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName("logchannel")
        .setDescription("Channel to log ticket events")
        .setRequired(true))
    .addRoleOption(opt =>
      opt.setName("supportrole")
        .setDescription("Role allowed to manage tickets")
        .setRequired(true)),

  async execute(interaction) {
    const logChannel = interaction.options.getChannel("logchannel");
    const supportRole = interaction.options.getRole("supportrole");

    let config = await GuildConfig.findOne({ guildId: interaction.guild.id });

    if (!config) {
      config = new GuildConfig({
        guildId: interaction.guild.id,
        logChannelId: logChannel.id,
        supportRoles: [supportRole.id],
      });
    } else {
      config.logChannelId = logChannel.id;
      config.supportRoles = [supportRole.id];
    }

    await config.save();

    await interaction.reply({
      embeds: [embeds.success(`✅ Setup complete!\n**Log Channel:** ${logChannel}\n**Support Role:** ${supportRole}`)],
      ephemeral: true,
    });
  },
};
