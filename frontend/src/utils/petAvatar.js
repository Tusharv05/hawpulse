import catDefaultAvatar from '../assets/vectorcprofile.png';
import dogDefaultAvatar from '../assets/vectordprofile.png';

export { catDefaultAvatar, dogDefaultAvatar };

/**
 * Returns true only if the pet has a genuine user-uploaded photo.
 * Filters out dummy placeholders, default paths, and the old hardcoded golden retriever.
 */
export const hasCustomPetPhoto = (pet) => {
  const url = pet?.avatar_url || pet?.photo_url || (Array.isArray(pet?.photos) && pet.photos.length > 0 ? pet.photos[0] : null);
  if (!url || typeof url !== 'string' || !url.trim()) return false;
  if (
    url.includes('AB6AXuDjeGX1ZppmykOTVDawbyBPlT3EiiJm4uy8Sgbs2vpubmJJn') ||
    url.includes('/assets/defaults/') ||
    url.includes('default-dog') ||
    url.includes('default-cat')
  ) {
    return false;
  }
  return true;
};

/**
 * Resolves pet photo URL:
 * - If user uploaded a photo: returns the valid image URL (prepended with API base if relative /uploads/).
 * - If not added photo:
 *    - Cat (species === 'cat') -> vectorcprofile.png
 *    - Dog / other -> vectordprofile.png
 */
export const resolvePetAvatar = (pet) => {
  const species = pet?.species?.toLowerCase() || 'dog';

  if (!hasCustomPetPhoto(pet)) {
    return species === 'cat' ? catDefaultAvatar : dogDefaultAvatar;
  }

  const url = pet.avatar_url || pet.photo_url || (Array.isArray(pet.photos) && pet.photos.length > 0 ? pet.photos[0] : '');

  if (url.startsWith('/uploads/')) {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    const host = apiBase.replace(/\/api\/v1\/?$/, '');
    return `${host}${url}`;
  }

  return url;
};
