const GuildConfig = require('../models/guildConfig');

module.exports = async (interaction) => {
    if (!interaction.isButton()) return;

    // Check if it's one of our role buttons
    if (!interaction.customId.startsWith('role-button:')) return;

    await interaction.deferReply({ ephemeral: true });

    const roleId = interaction.customId.split(':')[1];

    try {
        // Find the server's configuration in the database
        const config = await GuildConfig.findOne({ guildId: interaction.guildId });
        if (!config || !config.buttonCategories.some(cat => cat.roleId === roleId)) {
            return interaction.editReply({ content: 'This button is part of an outdated configuration.' });
        }

        const role = await interaction.guild.roles.fetch(roleId);
        if (!role) {
            return interaction.editReply({ content: 'The role associated with this button no longer exists.' });
        }
        
        const member = interaction.member;

        // Toggle the role
        if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            await interaction.editReply(`✅ The **${role.name}** role has been removed.`);
        } else {
            await member.roles.add(role);
            await interaction.editReply(`✅ You have been given the **${role.name}** role!`);
        }

    } catch (error) {
        console.error('Error handling button interaction:', error);
        await interaction.editReply({ content: 'An error occurred while processing your request.' });
    }
};
