const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const {
  User,
  Tournament,
  Match,
  Dispute,
  Reward,
  SponsorshipLevel,
  AdminLog
} = require('./models');

const MONGO_URI =  process.env.MONGO_URI ||'mongodb+srv://sannicharbel:fzdLOWRUgFCHYqwl@cluster0.fccao1l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function seed() {
  await mongoose.connect(MONGO_URI);
  await Promise.all([
    User.deleteMany({}),
    Tournament.deleteMany({}),
    Match.deleteMany({}),
    Dispute.deleteMany({}),
    Reward.deleteMany({}),
    SponsorshipLevel.deleteMany({}),
    AdminLog.deleteMany({})
  ]);

  // Sponsorship Levels
  const sponsorshipLevels = await SponsorshipLevel.insertMany([
    {
      name: 'Paysan ASC',
      requirements: '3 filleuls actifs',
      benefits: ['1 mois d\'accès gratuit', '1% commission sur gains', '1% sur recharges']
    },
    {
      name: 'Roturier ASC',
      requirements: '10 filleuls actifs',
      benefits: ['3 mois d\'accès gratuit', '2% commission sur gains', '2% sur recharges']
    },
    {
      name: 'Noble ASC',
      requirements: '50 filleuls actifs',
      benefits: ['6 mois d\'accès gratuit', '5% commission sur gains', '5% sur recharges']
    },
    {
      name: 'Roi ASC',
      requirements: '100 filleuls actifs',
      benefits: ['12 mois d\'accès gratuit', '10% commission sur gains', '10% sur recharges']
    }
  ]);

  // Utilisateurs
  const password = await bcrypt.hash('Password123!', 10);
  const users = await User.insertMany([
    {
      email: 'admin@asc.com',
      password: password,
      role: 'admin',
      profile: { username: 'Admin', country: 'CM', createdAt: new Date() },
      statistics: { totalWins: 0, totalLosses: 0, ranking: 1, tournamentsPlayed: 0, tournamentsWon: 0 },
      sponsorship: { referralCode: 'ADMIN123', commissionEarned: 0 },
      twoFactorEnabled: true
    },
    {
      email: 'user1@asc.com',
      password: password,
      role: 'user',
      profile: { username: 'Player123', country: 'CM', createdAt: new Date() },
      statistics: { totalWins: 47, totalLosses: 20, ranking: 42, tournamentsPlayed: 63, tournamentsWon: 3 },
      sponsorship: { referralCode: 'USER123', referredBy: null, commissionEarned: 1000 },
      twoFactorEnabled: false
    },
    {
      email: 'user2@asc.com',
      password: password,
      role: 'user',
      profile: { username: 'GameMaster', country: 'SN', createdAt: new Date() },
      statistics: { totalWins: 30, totalLosses: 25, ranking: 55, tournamentsPlayed: 55, tournamentsWon: 2 },
      sponsorship: { referralCode: 'USER456', referredBy: null, commissionEarned: 2000 },
      twoFactorEnabled: false
    },
    {
      email: 'validator@asc.com',
      password: password,
      role: 'validator',
      profile: { username: 'Validator', country: 'CI', createdAt: new Date() },
      statistics: { totalWins: 10, totalLosses: 5, ranking: 100, tournamentsPlayed: 15, tournamentsWon: 0 },
      sponsorship: { referralCode: 'VALI123', referredBy: null, commissionEarned: 0 },
      twoFactorEnabled: false
    }
  ]);

  // Tournois
  const tournaments = await Tournament.insertMany([
    {
      title: 'ASC Premier League',
      description: 'Le tournoi phare de l\'ASC avec les meilleurs joueurs africains de DLS.',
      prize: '350 000 FCFA',
      status: 'open',
      date: new Date('2025-05-15'),
      maxPlayers: 32,
      players: [users[1]._id, users[2]._id],
      rules: 'Code unique, relance en cas de match nul, respect des horaires',
      type: 'Premier League',
      createdBy: users[0]._id,
      image: '/tournament-1.jpg'
    },
    {
      title: 'Coupe des Nations',
      description: 'Représentez votre pays dans cette compétition internationale de Dream League Soccer.',
      prize: '200 000 FCFA',
      status: 'in-progress',
      date: new Date(),
      maxPlayers: 16,
      players: [users[1]._id],
      rules: 'Code unique, relance en cas de match nul, respect des horaires',
      type: 'International',
      createdBy: users[0]._id,
      image: '/tournament-2.jpg'
    }
  ]);

  // Matchs
  const matches = await Match.insertMany([
    {
      tournamentId: tournaments[0]._id,
      players: [users[1]._id, users[2]._id],
      scores: [
        { userId: users[1]._id, score: 3 },
        { userId: users[2]._id, score: 1 }
      ],
      date: new Date('2024-01-15'),
      status: 'completed',
      winner: users[1]._id,
      proofs: [],
    },
    {
      tournamentId: tournaments[0]._id,
      players: [users[2]._id, users[1]._id],
      scores: [
        { userId: users[2]._id, score: 2 },
        { userId: users[1]._id, score: 1 }
      ],
      date: new Date('2024-01-14'),
      status: 'completed',
      winner: users[2]._id,
      proofs: [],
    }
  ]);

  // Litiges
  const disputes = await Dispute.insertMany([
    {
      matchId: matches[1]._id,
      createdBy: users[1]._id,
      reason: 'Score contesté',
      status: 'open',
      proofs: [],
      validators: [],
      finalDecision: null,
      resolvedAt: null
    }
  ]);

  // Récompenses
  const rewards = await Reward.insertMany([
    {
      userId: users[1]._id,
      tournamentId: tournaments[0]._id,
      type: 'win',
      amount: 200000,
      description: '1ère place ASC Premier League',
      date: new Date('2024-01-16')
    },
    {
      userId: users[2]._id,
      tournamentId: tournaments[0]._id,
      type: 'participation',
      amount: 50000,
      description: 'Participation ASC Premier League',
      date: new Date('2024-01-16')
    }
  ]);

  // Logs admin
  await AdminLog.insertMany([
    {
      adminId: users[0]._id,
      action: 'Création tournoi',
      targetType: 'tournament',
      targetId: tournaments[0]._id,
      details: 'Tournoi ASC Premier League créé',
    },
    {
      adminId: users[0]._id,
      action: 'Validation litige',
      targetType: 'dispute',
      targetId: disputes[0]._id,
      details: 'Litige traité',
    }
  ]);

  console.log('Seed terminé !');
  process.exit();
}

seed().catch(e => { console.error(e); process.exit(1); }); 