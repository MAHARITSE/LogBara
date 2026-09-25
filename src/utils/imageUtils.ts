/**
 * Utilitaires pour le chargement, redimensionnement et compression des images
 * Développeur: MAHARITSE Hiacinthe Bertrand
 */

export interface ProcessImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Lit un fichier image (PNG, JPG, ICO, WEBP, GIF, SVG) et retourne une Data URL Base64 optimisée
 */
export async function fileToDataUrl(
  file: File,
  options: ProcessImageOptions = { maxWidth: 300, maxHeight: 300, quality: 0.85 }
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Aucun fichier fourni'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) {
        reject(new Error('Impossible de lire le fichier'));
        return;
      }

      // Si c'est un SVG ou un ICO très petit, on peut le garder tel quel
      if (file.type === 'image/svg+xml' || (file.name.toLowerCase().endsWith('.ico') && file.size < 50000)) {
        resolve(result);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxWidth = options.maxWidth || 300;
        const maxHeight = options.maxHeight || 300;
        let width = img.width;
        let height = img.height;

        // Calcul du ratio pour préserver les proportions
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(result);
          return;
        }

        // Lissage de haute qualité
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Format de sortie adapté
        const isPng = file.type === 'image/png';
        const outputMime = isPng ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outputMime, isPng ? undefined : (options.quality || 0.85));
        resolve(dataUrl);
      };

      img.onerror = () => {
        // En cas d'erreur de chargement Image, fallback sur le dataUrl brut
        resolve(result);
      };

      img.src = result;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
