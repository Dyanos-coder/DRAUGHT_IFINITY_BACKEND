const User = require('./user.model');
const Tournament = require('./tournament.model');
const Match = require('./match.model');
const Dispute = require('./dispute.model');
const Reward = require('./reward.model');
const SponsorshipLevel = require('./sponsorshipLevel.model');
const AdminLog = require('./adminLog.model');
const Communication = require('./communication.model');
const Transaction = require('./transaction.model');

module.exports = {
  User,
  Tournament,
  Match,
  Dispute,
  Reward,
  SponsorshipLevel,
  AdminLog,
  Communication,
  Transaction
}; 