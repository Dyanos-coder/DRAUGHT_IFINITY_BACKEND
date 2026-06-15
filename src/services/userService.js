const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const {
  substitutePlayersProfiles,
  SUBSTITUTE_PLAYER_DEFAULT_PASSWORD,
  SUBSTITUTE_PLAYER_EMAIL_DOMAIN
} = require('../config/substitutePlayers.config.js');

const NUM_SUBSTITUTE_PLAYERS =150;
const SUBSTITUTE_PLAYER_BASE_NAME = "";

async function ensureSubstitutePlayers() {
  try {
    console.log('[UserService] Checking for substitute players based on config...');
    const hashedPassword = await bcrypt.hash(SUBSTITUTE_PLAYER_DEFAULT_PASSWORD, 10);
    let createdCount = 0;

    for (const profile of substitutePlayersProfiles) {
      const email = `${profile.baseEmail}${SUBSTITUTE_PLAYER_EMAIL_DOMAIN}`.toLowerCase();
      const username = profile.baseUsername;

      const existingUser = await User.findOne({ $or: [{ email }, { username }] });

      if (existingUser) {
        // Optionally, update existing substitute if needed (e.g., ensure isSubstitute flag is set)
        if (!existingUser.isSubstitute || existingUser.role !== 'substitute') {
          existingUser.isSubstitute = true;
          existingUser.role = 'substitute';
          // Ensure password is the default one if you want to reset it on start, otherwise skip password update.
          // existingUser.password = hashedPassword; // Uncomment to enforce default password on existing subs
          await existingUser.save();
          console.log(`[UserService] Updated existing user ${username} to be a substitute.`);
        }
        continue; // Skip creation if user exists
      }

      // Create new substitute player
      await User.create({
        username: username,
        email: email,
        password: hashedPassword,
        role: 'substitute',
        isSubstitute: true,
        profile: {
          username: username,
          country: profile.country || 'N/A',
        },
        statistics: { totalWins: 0, totalLosses: 0, ranking: 0, tournamentsPlayed: 0, tournamentsWon: 0 },
        emailVerified: true,
        sponsorship: { referralCode: `SUB_${username.replace(/\s+/g, '').toUpperCase()}` },
      });
      createdCount++;
      console.log(`[UserService] Created substitute player: ${username}`);
    }

    if (createdCount > 0) {
      console.log(`[UserService] Successfully created ${createdCount} new substitute players.`);
    } else {
      console.log('[UserService] All configured substitute players already exist or were updated.');
    }

  } catch (error) {
    console.error('[UserService] Error ensuring substitute players:', error);
  }
}

module.exports = {
  ensureSubstitutePlayers,
}; 