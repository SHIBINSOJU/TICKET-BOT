const { InteractionType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const GuildConfig = require('../../models/guildConfig');
const Ticket = require('../../models/ticket');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // --- 1. HANDLE SLASH COMMANDS ---
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing command ${interaction.commandName}:`, error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
            return;
        }

        // --- 2. HANDLE BUTTON INTERACTIONS ---
        if (interaction.isButton()) {
            const { customId } = interaction;

            if (customId.startsWith('ticket_create_')) {
                return await handleTicketCreation(interaction, client);
            }

            switch (customId) {
                case 'close_ticket':
                    await handleCloseTicket(interaction);
                    break;
                case 'confirm_close':
                    await handleConfirmClose(interaction);
                    break;
                case 'cancel_close':
                    await interaction.message.delete();
                    break;
                case 'claim_ticket':
                    await handleClaimTicket(interaction);
                    break;
                // --- NEW BUTTON HANDLERS ---
                case 'add_member':
                    await handleAddMember(interaction);
                    break;
                case 'warn_user':
                    await handleWarnUser(interaction);
                    break;
                case 'confirm_warn':
                    await handleConfirmWarn(interaction, client);
                    break;
                case 'cancel_warn':
                    await interaction.message.delete();
                    break;
                case 'delete_ticket':
                    await handleDeleteTicket(interaction);
                    break;
                case 'confirm_delete':
                    await handleConfirmDelete(interaction, client);
                    break;
                case 'cancel_delete':
                    await interaction.message.delete();
                    break;
            }
        }

        // --- 3. HANDLE MODAL SUBMISSIONS ---
        if (interaction.type === InteractionType.ModalSubmit) {
            if (interaction.customId.startsWith('ticket_modal_')) {
                await handleModalSubmit(interaction, client);
            }
            // --- NEW MODAL HANDLER ---
            if (interaction.customId === 'add_member_modal') {
                await handleAddMemberModalSubmit(interaction, client);
            }
        }
    },
};


// --- TICKET CREATION & SUBMISSION (No changes, but updated with Add Member button) ---
async function handleTicketCreation(interaction, client) {
    try {
        const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
        if (!guildConfig) return await interaction.reply({ content: 'The ticket system has not been configured.', ephemeral: true });
        const existingTicket = await Ticket.findOne({ guildId: interaction.guild.id, creatorId: interaction.user.id, status: 'open' });
        if (existingTicket) return await interaction.reply({ content: `You already have an open ticket in <#${existingTicket.channelId}>.`, ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`ticket_modal_${interaction.customId.split('_')[2]}`).setTitle('Create a New Ticket');
        const reasonInput = new TextInputBuilder().setCustomId('ticket_reason').setLabel("What is the reason for this ticket?").setStyle(TextInputStyle.Paragraph).setPlaceholder('Please provide details.').setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
    } catch (error) { console.error('Error in handleTicketCreation:', error); }
}

async function handleModalSubmit(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const reason = interaction.fields.getTextInputValue('ticket_reason');
    const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
    try {
        guildConfig.ticketCount += 1;
        await guildConfig.save();
        const ticketNumber = guildConfig.ticketCount;
        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username.substring(0, 10)}-${ticketNumber}`, type: ChannelType.GuildText, parent: guildConfig.ticketCategoryId,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles] },
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] },
                ...guildConfig.supportRoleIds.map(roleId => ({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] })),
            ],
        });
        await Ticket.create({ guildId: interaction.guild.id, channelId: channel.id, creatorId: interaction.user.id, reason: reason });
        const ticketEmbed = new EmbedBuilder().setTitle(`Ticket #${ticketNumber}`).setDescription(`**Creator:** <@${interaction.user.id}>\n**Reason:**\n\`\`\`${reason}\`\`\``).setColor('Green').setTimestamp();
        const ticketButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('✅'),
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Primary).setEmoji('🧍'),
            new ButtonBuilder().setCustomId('add_member').setLabel('Add Member').setStyle(ButtonStyle.Success).setEmoji('➕'),
            new ButtonBuilder().setCustomId('warn_user').setLabel('Warn User').setStyle(ButtonStyle.Secondary).setEmoji('⚠️')
        );
        await channel.send({ content: `<@&${guildConfig.supportRoleIds.join('>, <@&')}>, a new ticket has been created by <@${interaction.user.id}>.`, embeds: [ticketEmbed], components: [ticketButtons] });
        await interaction.editReply({ content: `Your ticket has been created in <#${channel.id}>.`, ephemeral: true });
    } catch (error) { console.error('Error handling modal submission:', error); }
}


// --- CLOSE & CLAIM (No changes) ---
async function handleCloseTicket(interaction) {
    const confirmationEmbed = new EmbedBuilder().setTitle('Confirmation').setDescription('Are you sure you want to close this ticket?').setColor('Yellow');
    const confirmationButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_close').setLabel('Confirm').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancel_close').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({ embeds: [confirmationEmbed], components: [confirmationButtons] });
}
async function handleConfirmClose(interaction) {
    await interaction.deferUpdate();
    try {
        const ticket = await Ticket.findOne({ guildId: interaction.guild.id, channelId: interaction.channel.id });
        if (!ticket || ticket.status === 'closed') return;
        ticket.status = 'closed';
        await ticket.save();
        await interaction.channel.permissionOverwrites.edit(ticket.creatorId, { SendMessages: false, ViewChannel: true });
        const closeEmbed = new EmbedBuilder().setTitle('Ticket Closed').setDescription(`This ticket has been closed by <@${interaction.user.id}>.`).setColor('Red').setTimestamp();
        const deleteButton = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('delete_ticket').setLabel('Delete Ticket').setStyle(ButtonStyle.Danger).setEmoji('🗑️'));
        await interaction.channel.send({ embeds: [closeEmbed], components: [deleteButton] });
        await interaction.channel.setTopic(`Closed by ${interaction.user.tag}`);
        await interaction.message.delete();
    } catch (error) { console.error("Error during ticket close confirmation:", error); }
}
async function handleClaimTicket(interaction) {
    await interaction.deferUpdate();
    try {
        const ticket = await Ticket.findOne({ guildId: interaction.guild.id, channelId: interaction.channel.id });
        if (!ticket || ticket.claimedById) return;
        const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
        if (!interaction.member.roles.cache.some(role => guildConfig.supportRoleIds.includes(role.id))) {
            return interaction.followUp({ content: 'You do not have permission to claim tickets.', ephemeral: true });
        }
        ticket.claimedById = interaction.user.id;
        await ticket.save();
        const originalMessage = interaction.message;
        const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0]).addFields({ name: 'Claimed By', value: `<@${interaction.user.id}>` });
        const originalComponents = originalMessage.components[0];
        originalComponents.components.forEach(button => { if (button.customId === 'claim_ticket') button.setDisabled(true); });
        await originalMessage.edit({ embeds: [updatedEmbed], components: [originalComponents] });
        await interaction.followUp({ content: `You have successfully claimed this ticket!`, ephemeral: true });
    } catch (error) { console.error("Error claiming ticket:", error); }
}

// --- NEW! ADD MEMBER FUNCTIONS ---
async function handleAddMember(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('add_member_modal')
        .setTitle('Add Member to Ticket');
    const memberIdInput = new TextInputBuilder()
        .setCustomId('member_id')
        .setLabel("Enter the User ID of the member to add")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(memberIdInput));
    await interaction.showModal(modal);
}
async function handleAddMemberModalSubmit(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const memberId = interaction.fields.getTextInputValue('member_id');
    try {
        const member = await interaction.guild.members.fetch(memberId);
        if (!member) {
            return await interaction.editReply({ content: 'Could not find a member with that ID.' });
        }
        await interaction.channel.permissionOverwrites.edit(member.id, {
            ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true
        });
        await interaction.editReply({ content: `Successfully added <@${memberId}> to this ticket.` });
    } catch (error) {
        console.error("Error adding member:", error);
        await interaction.editReply({ content: 'An error occurred. Please make sure you provided a valid User ID.' });
    }
}

// --- NEW! WARN USER FUNCTIONS ---
async function handleWarnUser(interaction) {
    const confirmationEmbed = new EmbedBuilder().setTitle('Confirm Warning').setDescription('Are you sure you want to send a warning to the ticket creator?').setColor('Yellow');
    const confirmationButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_warn').setLabel('Confirm').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancel_warn').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({ embeds: [confirmationEmbed], components: [confirmationButtons], ephemeral: true });
}
async function handleConfirmWarn(interaction, client) {
    await interaction.deferUpdate();
    try {
        const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
        const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
        if (!ticket) return;
        const ticketCreator = await client.users.fetch(ticket.creatorId);
        const logChannel = await client.channels.fetch(guildConfig.logChannelId);

        const dmEmbed = new EmbedBuilder().setTitle('⚠️ Warning').setDescription(`You have received a warning in your ticket by <@${interaction.user.id}>.\nPlease follow server rules while communicating.`).setColor('Orange').setTimestamp();
        await ticketCreator.send({ embeds: [dmEmbed] }).catch(() => console.log("Couldn't DM the user."));

        const logEmbed = new EmbedBuilder().setTitle('User Warned').setDescription(`**User:** <@${ticketCreator.id}>\n**Staff:** <@${interaction.user.id}>\n**Ticket:** <#${interaction.channel.id}>`).setColor('Orange').setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });

        await interaction.followUp({ content: `A warning has been sent to ${ticketCreator.tag}.`, ephemeral: true });
        await interaction.message.delete();
    } catch (error) { console.error("Error confirming warn:", error); }
}

// --- NEW! DELETE TICKET FUNCTIONS ---
async function handleDeleteTicket(interaction) {
    const confirmationEmbed = new EmbedBuilder().setTitle('DELETE TICKET').setDescription('This action is irreversible. Are you sure you want to permanently delete this ticket?').setColor('Red');
    const confirmationButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_delete').setLabel('Confirm Delete').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancel_delete').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({ embeds: [confirmationEmbed], components: [confirmationButtons], ephemeral: true });
}
async function handleConfirmDelete(interaction, client) {
    try {
        await interaction.reply({ content: 'Deleting ticket in 5 seconds...', ephemeral: true });
        // Delete ticket from DB
        await Ticket.findOneAndDelete({ channelId: interaction.channel.id });
        // Delete channel after 5 seconds
        setTimeout(() => {
            interaction.channel.delete('Ticket deleted by staff.');
        }, 5000);
    } catch (error) { console.error("Error confirming delete:", error); }
            }
