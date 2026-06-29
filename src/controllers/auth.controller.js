const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const config = require('../config/config');
const { sendMail } = require('../utils/mailer');
const axios = require('axios');
const Transaction = require('../models/transaction.model');
const mongoose = require('mongoose');
const { getOtpEmailTemplate, getVerificationEmailTemplate } = require('../templates/emailTemplates');
const crypto = require('crypto');
const gameDatabaseService = require('../services/gameDatabaseService');
const Game = require('../models/game.model');

// Fonction pour générer un code de parrainage à partir de l'ID
function generateReferralCodeFromId(id) {
  const hex = id.toString(); // Obtenir la représentation de l'ObjectId
  const intId = BigInt('0x' + hex); // Convertir en entier
  const base36 = intId.toString(36).toUpperCase(); // Encodage base36
  return base36.slice(0, 11); // Limiter à 11 caractères
}

// Register a new user
exports.register = async (req, res) => {
  try {
    console.log('📝 Tentative d\'inscription:', { email: req.body.email, username: req.body.username, gameName: req.body.gameName });
    const { username, email, password, referralCode } = req.body;
    const gameInput = req.body.gameName || req.body.game || null;

    // Si un jeu est spécifié, on inscrit UNIQUEMENT dans la BD du jeu (pas dans users)
    if (gameInput) {
      console.log(`🎮 Inscription pour le jeu uniquement: ${gameInput}`);
      
      try {
        // helper pour échapper une chaîne pour une regex
        const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        let game = null;

        // Si l'utilisateur a envoyé un ID Mongo (24 hex), tenter findById pour compatibilité
        if (/^[0-9a-fA-F]{24}$/.test(gameInput)) {
          game = await Game.findById(gameInput);
        }

        // Sinon essayer de retrouver le jeu par son nom (insensible à la casse, correspondance exacte)
        if (!game) {
          const q = { name: { $regex: `^${escapeRegex(String(gameInput).trim())}$`, $options: 'i' } };
          game = await Game.findOne(q);
        }

        // Si toujours pas trouvé, tenter une recherche plus permissive (slug ou inclusion)
        if (!game) {
          const permissiveQ = {
            $or: [
              { slug: { $regex: escapeRegex(String(gameInput).trim()), $options: 'i' } },
              { name: { $regex: escapeRegex(String(gameInput).trim()), $options: 'i' } }
            ]
          };
          game = await Game.findOne(permissiveQ);
        }

        if (!game) {
          console.warn(`⚠️ Jeu introuvable: ${gameInput}`);
          return res.status(400).json({ 
            message: `Le jeu "${gameInput}" est introuvable. Vérifiez le nom du jeu.`
          });
        }

        // Créer la DB du jeu si elle n'existe pas
        if (!gameDatabaseService.hasGameDatabase(game._id.toString())) {
          console.log(`🔧 Création / initialisation de la DB pour le jeu ${game.name} (ID ${game._id})`);
          await gameDatabaseService.createGameDatabase(game);
        }

        const connection = gameDatabaseService.getGameConnection(game._id.toString());
        if (!connection) {
          console.warn(`⚠️ Impossible d'obtenir la connexion du jeu ${game._id}`);
          return res.status(500).json({ 
            message: 'Erreur lors de la création du compte dans le jeu.'
          });
        }

        // Vérifier si le player existe déjà dans la DB du jeu (par email ou inGameUsername)
        const Player = connection.model('Player');
        const existingPlayer = await Player.findOne({ 
          $or: [{ inGameEmail: email }, { inGameUsername: username }] 
        });

        if (existingPlayer) {
          console.log(`❌ Player déjà existant dans le jeu ${game.name}:`, { inGameEmail: email, inGameUsername: username });
          return res.status(400).json({ 
            message: 'Un compte avec cet email ou ce pseudo existe déjà dans ce jeu.' 
          });
        }

        // Hacher le mot de passe manuellement (car on ne passe pas par le modèle User)
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        const inGameUsername = req.body.inGameUsername || username;
        
        // Créer le Player dans la DB du jeu
        const newPlayer = await Player.create({
          userId: null, // Pas de référence à la collection users principale
          inGameUsername: inGameUsername,
          inGameEmail: email,
          inGamePassword: hashedPassword,
          inGameId: inGameUsername, // Le pseudo est utilisé comme ID in-game
          soldePiece: 0,
          soldeEnergie: 0
        });

        console.log(`✅ Player créé dans la DB du jeu '${game.name}' avec inGameId: ${inGameUsername}`);

        return res.status(201).json({
          message: `Inscription réussie au jeu "${game.name}". Vous pouvez maintenant vous connecter.`,
          game: game.name,
          inGameUsername: inGameUsername,
          redirectTo: '/login'
        });

      } catch (gameErr) {
        console.error('❌ Erreur lors de l\'inscription au jeu:', gameErr);
        return res.status(500).json({ 
          message: 'Erreur lors de la création du compte dans le jeu.',
          error: gameErr.message
        });
      }
    }

    // SINON : Inscription classique dans la BD principale (users) - pour le site web général
    console.log('🌐 Inscription classique dans la BD principale');

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      console.log('❌ Utilisateur déjà existant:', { email, username });
      return res.status(400).json({ 
        message: 'User with this email or username already exists' 
      });
    }

    // Rechercher le parrain si un code a été fourni
    let referringUser = null;
    if (referralCode) {
      referringUser = await User.findOne({ 'sponsorship.referralCode': referralCode });
      if (!referringUser) {
        console.log('❌ Code de parrainage invalide:', referralCode);
        // Arrêter l'inscription si le code de parrainage est invalide
        return res.status(400).json({ 
          message: 'Le code de parrainage saisi ne correspond à aucun utilisateur' 
        });
      } else {
        console.log('✅ Parrain trouvé:', { id: referringUser._id, username: referringUser.username });
      }
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create new user instance without saving yet
    const newUser = new User({
      username,
      email,
      password, // Le mot de passe en clair, le hook `pre('save')` le hachera
      role: 'user',
      sponsorship: {
        codeParrain: referralCode || null
      },
      verificationToken,
      verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    // Générer un code de parrainage unique pour le nouvel utilisateur et l'associer au parrain
    const generatedReferralCode = generateReferralCodeFromId(newUser._id); // L'ID est généré par Mongoose avant la sauvegarde
    newUser.sponsorship.referralCode = generatedReferralCode;

    if (referringUser) {
      newUser.sponsorship.referredBy = referringUser._id;
      referringUser.sponsorship.referrals.push(newUser._id);
      // On sauvegarde le parrain, c'est une opération séparée
      await referringUser.save();
      console.log('✅ Utilisateur ajouté aux filleuls du parrain');
    }

    // Sauvegarde finale et atomique du nouvel utilisateur avec toutes ses informations
    await newUser.save();
    console.log('✅ Nouvel utilisateur créé, haché et sauvegardé avec toutes les informations.');

    // Send verification email
    try {
      const verificationUrl = `${config.frontendUrl}/verify-email/${verificationToken}`;
      await sendMail({
        to: newUser.email,
        subject: 'Vérifiez votre adresse e-mail pour Afrik Soccer Cup',
        html: getVerificationEmailTemplate(newUser.username, verificationUrl)
      });
      console.log(`✅ E-mail de vérification envoyé à ${newUser.email}`);
    } catch (emailError) {
      console.error(`❌ Erreur lors de l'envoi de l'e-mail de vérification à ${newUser.email}:`, emailError);
      // Optionnel : Gérer l'échec de l'envoi de l'e-mail. 
      // Pour l'instant, on continue le processus mais on log l'erreur.
    }

    res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.',
      redirectTo: '/dashboard' // Rediriger vers la page de connexion avec un message
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'inscription:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    console.log('🔑 Tentative de connexion:', { email: req.body.email, gameName: req.body.gameName });
    const { email, password } = req.body;
    const gameInput = req.body.gameName || req.body.game || null;

    // Si un jeu est spécifié, connexion pour le jeu UNIQUEMENT (pas users)
    if (gameInput) {
      console.log(`🎮 Connexion pour le jeu: ${gameInput}`);
      
      try {
        // helper pour échapper une chaîne pour une regex
        const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        let game = null;

        // Si l'utilisateur a envoyé un ID Mongo (24 hex), tenter findById pour compatibilité
        if (/^[0-9a-fA-F]{24}$/.test(gameInput)) {
          game = await Game.findById(gameInput);
        }

        // Sinon essayer de retrouver le jeu par son nom (insensible à la casse, correspondance exacte)
        if (!game) {
          const q = { name: { $regex: `^${escapeRegex(String(gameInput).trim())}$`, $options: 'i' } };
          game = await Game.findOne(q);
        }

        // Si toujours pas trouvé, tenter une recherche plus permissive (slug ou inclusion)
        if (!game) {
          const permissiveQ = {
            $or: [
              { slug: { $regex: escapeRegex(String(gameInput).trim()), $options: 'i' } },
              { name: { $regex: escapeRegex(String(gameInput).trim()), $options: 'i' } }
            ]
          };
          game = await Game.findOne(permissiveQ);
        }

        if (!game) {
          console.log(`⚠️ Jeu introuvable: ${gameInput}`);
          return res.status(400).json({ 
            message: `Le jeu "${gameInput}" est introuvable. Vérifiez le nom du jeu.`
          });
        }

        // Vérifier si la DB du jeu existe, sinon la créer/reconnecter
        let connection = gameDatabaseService.getGameConnection(game._id.toString());
        
        if (!connection) {
          console.log(`🔄 Connexion à la DB du jeu ${game.name} non établie, tentative de connexion...`);
          
          // Si le jeu a un databaseName, cela veut dire que la BD existe mais la connexion n'est pas active
          if (game.databaseName) {
            try {
              await gameDatabaseService.createGameDatabase(game);
              connection = gameDatabaseService.getGameConnection(game._id.toString());
              console.log(`✅ Connexion rétablie à la DB du jeu ${game.name}`);
            } catch (err) {
              console.error(`❌ Erreur lors de la connexion à la BD du jeu:`, err);
              return res.status(500).json({ 
                message: 'Erreur lors de la connexion au jeu.'
              });
            }
          } else {
            // Aucune BD n'existe pour ce jeu
            console.log(`⚠️ DB du jeu ${game.name} n'existe pas encore`);
            return res.status(400).json({ 
              message: `Aucun compte n'existe pour le jeu "${game.name}". Veuillez d'abord créer un compte.`
            });
          }
        }
        
        if (!connection) {
          console.warn(`⚠️ Impossible d'obtenir la connexion du jeu ${game._id}`);
          return res.status(500).json({ 
            message: 'Erreur lors de la connexion au jeu.'
          });
        }

        const Player = connection.model('Player');
        
        console.log(`🔍 Recherche du Player par email: ${email} dans la DB du jeu ${game.name}`);
        
        const playerInGame = await Player.findOne({ inGameEmail: email });
        
        if (!playerInGame) {
          console.log(`❌ Aucun Player avec l'email ${email} dans la DB du jeu ${game.name}`);
          return res.status(400).json({ 
            message: 'Email ou mot de passe incorrect.'
          });
        }

        // Vérifier le mot de passe (compare avec inGamePassword qui est haché)
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(password, playerInGame.inGamePassword);
        
        if (!isMatch) {
          console.log(`❌ Mot de passe incorrect pour le Player ${email} dans le jeu ${game.name}`);
          return res.status(400).json({ 
            message: 'Email ou mot de passe incorrect.'
          });
        }

        console.log(`✅ Connexion réussie au jeu ${game.name}:`, {
          inGameUsername: playerInGame.inGameUsername,
          inGameId: playerInGame.inGameId,
          playerId: playerInGame._id
        });

        // Lier le Player à un User dans la BD principale (nécessaire pour profil/amis)
        try {
          const playerIdStr = playerInGame._id.toString();
          let user = await User.findOne({
            $or: [
              { email: playerInGame.inGameEmail },
              { 'linkedGames': { $elemMatch: { gameId: game._id, playerId: playerIdStr } } }
            ]
          });

          if (!user) {
            // Créer un User minimal pour ce joueur (connexion au jeu uniquement)
            const crypto = require('crypto');
            user = new User({
              email: playerInGame.inGameEmail,
              username: playerInGame.inGameUsername,
              password: crypto.randomBytes(24).toString('hex'), // haché par le pre-save hook
            });
          }

          const alreadyLinked = user.linkedGames.some(
            g => g.gameId.toString() === game._id.toString() && g.playerId === playerIdStr
          );
          if (!alreadyLinked) {
            user.linkedGames.push({
              gameId: game._id,
              gameName: game.name,
              playerId: playerIdStr,
              inGameUsername: playerInGame.inGameUsername,
              inGameEmail: playerInGame.inGameEmail,
            });
            await user.save();
            console.log(`🔗 User <-> Player lié: ${user.username} <-> ${playerInGame.inGameUsername}`);
          }
        } catch (linkErr) {
          console.error('⚠️ Lien User-Player échoué (non bloquant):', linkErr.message);
        }

        // Générer un token JWT avec les infos du Player (pas du User)
        const token = jwt.sign(
          { 
            playerId: playerInGame._id,
            gameId: game._id,
            inGameUsername: playerInGame.inGameUsername,
            role: 'player' 
          },
          config.jwtSecret,
          { expiresIn: '1d' }
        );

        return res.status(200).json({
          message: 'Login successful',
          player: {
            _id: playerInGame._id,
            inGameUsername: playerInGame.inGameUsername,
            inGameEmail: playerInGame.inGameEmail,
            inGameId: playerInGame.inGameId,
            level: playerInGame.level,
            experience: playerInGame.experience,
            wins: playerInGame.wins,
            losses: playerInGame.losses,
            draws: playerInGame.draws,
            soldePiece: playerInGame.soldePiece || 0,
            soldeEnergie: playerInGame.soldeEnergie || 0
          },
          game: {
            _id: game._id,
            name: game.name
          },
          token,
          redirectTo: '/game'
        });

      } catch (gameErr) {
        console.error('❌ Erreur lors de la connexion au jeu:', gameErr);
        return res.status(500).json({ 
          message: 'Erreur lors de la connexion au jeu.',
          error: gameErr.message
        });
      }
    }

    // SINON : Connexion classique (dans la BD principale users) - pour le site web général
    console.log('🌐 Connexion classique dans la BD principale');

    // D'abord trouver l'utilisateur avec le mot de passe pour la vérification
    const userWithPassword = await User.findOne({ email });
    if (!userWithPassword) {
      console.log('❌ Utilisateur non trouvé:', { email });
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Vérifier si l'utilisateur est banni
    if (userWithPassword.isBanned) {
      console.log('⛔ Tentative de connexion d\'un utilisateur banni:', { email });
      return res.status(403).json({ 
        message: 'Votre compte a été banni définitivement. Contactez l\'administrateur pour plus d\'informations.',
        status: 'banned'
      });
    }

    // Vérifier si l'utilisateur est suspendu
    if (userWithPassword.isSuspended) {
      const now = new Date();
      const suspendedUntil = new Date(userWithPassword.suspendedUntil);
      
      // Si la date de suspension est dépassée, on lève la suspension
      if (suspendedUntil <= now) {
        userWithPassword.isSuspended = false;
        userWithPassword.suspendedUntil = null;
        await userWithPassword.save();
        console.log('🔓 Suspension expirée, compte débloqué:', { email });
      } else {
        // Formatage de la date pour l'affichage
        const formatDate = (date) => {
          return new Date(date).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        };
        
        console.log('⏳ Tentative de connexion d\'un utilisateur suspendu:', { email, suspendedUntil });
        return res.status(403).json({ 
          message: `Votre compte est temporairement suspendu jusqu'au ${formatDate(suspendedUntil)}`,
          status: 'suspended',
          suspendedUntil: suspendedUntil
        });
      }
    }

    // Vérifier le mot de passe
    const isMatch = await userWithPassword.comparePassword(password);
    if (!isMatch) {
      console.log('❌ Mot de passe incorrect pour:', { email });
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Récupérer l'utilisateur complet avec toutes les relations
    const user = await User.findById(userWithPassword._id)
      .select('-password')
      .populate('rewards')
      .populate('sponsorship.referredBy')
      .populate('sponsorship.referrals');

    console.log('✅ Connexion réussie:', { 
      id: user._id, 
      email: user.email, 
      role: user.role,
      username: user.username
    });

    // Log all user data for debugging
    console.log('📊 Données utilisateur complètes:', JSON.stringify(user, null, 2));

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    // Déterminer la redirection en fonction du rôle
    let redirectTo = '/dashboard'; // Default to user dashboard
    if (user.role === 'admin') {
      redirectTo = '/admin';
    }

    res.status(200).json({
      message: 'Login successful',
      user: user,
      token,
      redirectTo
    });
  } catch (error) {
    console.error('❌ Erreur lors de la connexion:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Verify email
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ 
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    user.isEmailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Resend verification email
exports.resendVerificationEmail = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    const verificationUrl = `${config.frontendUrl}/verify-email/${verificationToken}`;
    await sendMail({
      to: user.email,
      subject: 'Vérifiez votre adresse e-mail',
      html: getVerificationEmailTemplate(user.username, verificationUrl)
    });

    res.status(200).json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Error resending verification email:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Logout user
exports.logout = async (req, res) => {
  try {
    // Dans une implémentation avec sessions, on détruirait la session ici
    // Avec JWT, le logout est géré côté client (suppression du token)
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    console.log('🔍 Récupération utilisateur actuel:', { 
      userId: req.user?.id, 
      playerId: req.user?.playerId,
      gameId: req.user?.gameId
    });

    // Si c'est un Player (connexion via jeu)
    if (req.user.playerId && req.user.gameId) {
      console.log('🎮 Mode Player - Récupération depuis BD du jeu');
      
      const Game = require('../models/game.model');
      const game = await Game.findById(req.user.gameId);
      
      if (!game) {
        return res.status(404).json({ message: 'Game not found' });
      }

      const connection = gameDatabaseService.getGameConnection(req.user.gameId);
      if (!connection) {
        return res.status(500).json({ message: 'Game database connection not found' });
      }

      const Player = connection.model('Player');
      const player = await Player.findById(req.user.playerId);

      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }

      console.log('✅ Player trouvé:', { 
        id: player._id, 
        username: player.inGameUsername,
        soldePiece: player.soldePiece,
        soldeEnergie: player.soldeEnergie
      });

      return res.status(200).json({ 
        player: {
          _id: player._id,
          inGameUsername: player.inGameUsername,
          inGameEmail: player.inGameEmail,
          inGameId: player.inGameId,
          level: player.level,
          experience: player.experience,
          wins: player.wins,
          losses: player.losses,
          draws: player.draws,
          soldePiece: player.soldePiece,
          soldeEnergie: player.soldeEnergie,
          ownedThemes: player.ownedThemes || [],
          registeredAt: player.registeredAt,
          lastActive: player.lastActive
        },
        game: {
          _id: game._id,
          name: game.name
        }
      });
    }

    // Sinon c'est un User (connexion via site)
    console.log('🌐 Mode User - Récupération depuis BD principale');
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('rewards')
      .populate('sponsorship.referredBy')
      .populate('sponsorship.referrals');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `${config.frontendUrl}/reset-password/${resetToken}`;
    await sendMail({
      to: user.email,
      subject: 'Réinitialisation de mot de passe',
      html: `<p>Cliquez sur ce lien pour réinitialiser votre mot de passe: <a href="${resetUrl}">${resetUrl}</a></p>`
    });

    res.status(200).json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Error in forgot password:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Request OTP
exports.requestOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Générer un OTP de 6 chiffres
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 600000; // 10 minutes
    await user.save();

    await sendMail({
      to: user.email,
      subject: 'Votre code OTP',
      html: getOtpEmailTemplate(user.username, otp)
    });

    res.status(200).json({ message: 'OTP sent to email' });
  } catch (error) {
    console.error('Error requesting OTP:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ 
      email,
      otp,
      otpExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // OTP valide - générer un token temporaire pour la réinitialisation
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({ 
      message: 'OTP verified',
      resetToken 
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reset password with OTP
exports.resetPasswordOtp = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password = newPassword; // Le hook pre('save') hashera automatiquement
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}; 