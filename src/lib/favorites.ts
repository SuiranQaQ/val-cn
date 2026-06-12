export interface FavoritePlayer {
  player_name: string;
  subject: string;
  saved_at: string;
}

const KEY = "val_cn_favorites";

export function loadFavorites(): FavoritePlayer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as FavoritePlayer[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveFavorite(entry: FavoritePlayer): FavoritePlayer[] {
  const list = loadFavorites().filter(
    (f) =>
      f.subject !== entry.subject &&
      f.player_name.toLowerCase() !== entry.player_name.toLowerCase(),
  );
  list.unshift(entry);
  const trimmed = list.slice(0, 12);
  localStorage.setItem(KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function removeFavorite(subjectOrName: string): FavoritePlayer[] {
  const key = subjectOrName.toLowerCase();
  const list = loadFavorites().filter(
    (f) =>
      f.subject !== subjectOrName &&
      f.player_name.toLowerCase() !== key,
  );
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function isFavorite(subject: string, playerName: string): boolean {
  const key = playerName.toLowerCase();
  return loadFavorites().some(
    (f) => f.subject === subject || f.player_name.toLowerCase() === key,
  );
}
