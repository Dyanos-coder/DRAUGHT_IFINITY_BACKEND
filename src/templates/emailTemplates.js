const getOtpEmailTemplate = (otp, email, frontendUrl) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code de vérification ASC</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #ffffff;
    }
    .header {
      text-align: center;
      padding: 20px 0;
      background-color: #6B46C1;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 30px 20px;
      background-color: #ffffff;
      border-radius: 0 0 8px 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .otp-code {
      background-color: #f8f9fa;
      border: 2px dashed #6B46C1;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 20px 0;
      font-size: 32px;
      font-weight: bold;
      letter-spacing: 5px;
      color: #6B46C1;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #6B46C1;
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 14px;
    }
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .expiry {
      color: #dc3545;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ASC - Code de Vérification</h1>
    </div>
    <div class="content">
      <p>Bonjour,</p>
      <p>Vous avez demandé une réinitialisation de mot de passe. Voici votre code de vérification :</p>
      
      <div class="otp-code">
        ${otp}
      </div>

      <p class="expiry">Ce code est valable pendant 10 minutes.</p>

      <div class="warning">
        Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.
      </div>

      <p>Vous pouvez également cliquer sur le bouton ci-dessous pour accéder directement à la page de vérification :</p>
      
      <div style="text-align: center;">
        <a href="${frontendUrl}/otp-verification?email=${encodeURIComponent(email)}" class="button">
          Vérifier mon code
        </a>
      </div>

      <p>Si le bouton ne fonctionne pas, vous pouvez copier et coller le lien suivant dans votre navigateur :</p>
      <p style="word-break: break-all; color: #6B46C1;">
        ${frontendUrl}/otp-verification?email=${encodeURIComponent(email)}
      </p>
    </div>
    <div class="footer">
      <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
      <p>© ${new Date().getFullYear()} ASC. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>`;

const getVerificationEmailTemplate = (username, verificationUrl) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vérification de votre compte Afrik'Socca Cup</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; padding: 0; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { text-align: center; padding: 20px; background-color: #0c4a6e; border-radius: 8px 8px 0 0; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
    .content { padding: 30px 25px; }
    .content p { margin-bottom: 20px; font-size: 16px; }
    .button-container { text-align: center; margin: 30px 0; }
    .button { display: inline-block; padding: 14px 28px; background-color: #0c4a6e; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
    .link { word-break: break-all; color: #0c4a6e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Bienvenue sur Afrik Soccer Cup !</h1>
    </div>
    <div class="content">
      <p>Bonjour <strong>${username}</strong>,</p>
      <p>Merci de vous être inscrit. Pour activer votre compte et accéder à toutes les fonctionnalités de la plateforme, veuillez vérifier votre adresse e-mail en cliquant sur le bouton ci-dessous :</p>
      <div class="button-container">
        <a href="${verificationUrl}" class="button">Vérifier mon compte</a>
      </div>
      <p>Ce lien de vérification est valide pendant 24 heures.</p>
      <p>Si le bouton ne fonctionne pas, copiez et collez le lien suivant dans votre navigateur :</p>
      <p><a href="${verificationUrl}" class="link">${verificationUrl}</a></p>
      <p>Si vous n'avez pas créé de compte sur Afrik SoccerCup, veuillez ignorer cet e-mail.</p>
    </div>
    <div class="footer">
      <p>L'équipe Afrik Soccer Cup</p>
      <p>© ${new Date().getFullYear()} ASC. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>`;

module.exports = {
  getOtpEmailTemplate,
  getVerificationEmailTemplate
}; 