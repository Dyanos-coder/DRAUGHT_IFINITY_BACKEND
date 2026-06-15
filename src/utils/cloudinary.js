const cloudinary = require('cloudinary').v2;

// Configuration de Cloudinary
cloudinary.config({
  cloud_name: 'dyezeobrj',
  api_key: '4786658275182231', 
  api_secret: process.env.CLOUDINARY_API_SECRET || 'your_api_secret',
  secure: true
});

/**
 * Utilitaires Cloudinary pour la gestion des médias
 */
exports.uploadImage = async (imagePath) => {
  try {
    const result = await cloudinary.uploader.upload(imagePath, {
      folder: 'avatars', // Dossier où stocker les images
      use_filename: true,
      unique_filename: true,
      overwrite: true,
      resource_type: 'auto'
    });
    
    console.log('✅ Image téléchargée vers Cloudinary:', result.public_id);
    return result.secure_url;
  } catch (error) {
    console.error('❌ Erreur lors du téléchargement vers Cloudinary:', error);
    throw new Error('Échec du téléchargement de l\'image');
  }
};

/**
 * Supprime une image de Cloudinary
 * @param {string} publicId - L'ID public de l'image
 * @returns {Promise<Object>} - Le résultat de la suppression
 */
exports.deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log('✅ Image supprimée de Cloudinary:', publicId);
    return result;
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de l\'image:', error);
    throw new Error('Échec de la suppression de l\'image');
  }
};

/**
 * Extrait l'ID public d'une URL Cloudinary
 * @param {string} url - L'URL de l'image Cloudinary
 * @returns {string|null} - L'ID public ou null si non trouvé
 */
exports.getPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  try {
    // Format typique: https://res.cloudinary.com/cloud_name/image/upload/v123456/folder/filename.jpg
    const urlParts = url.split('/');
    // Trouver la partie après 'upload' (généralement commence par v12345)
    const uploadIndex = urlParts.findIndex(part => part === 'upload');
    
    if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
      // Extraire la partie après le numéro de version (vXXXXX)
      const versionAndRest = urlParts.slice(uploadIndex + 1);
      // Ignorer la partie version et construire le public_id
      const publicIdParts = versionAndRest.slice(1);
      // Obtenir le nom de fichier sans extension
      const lastPart = publicIdParts[publicIdParts.length - 1];
      const fileNameWithoutExt = lastPart.split('.')[0];
      
      // Reconstruire le public_id
      publicIdParts[publicIdParts.length - 1] = fileNameWithoutExt;
      return publicIdParts.join('/');
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erreur lors de l\'extraction du public_id:', error);
    return null;
  }
}; 