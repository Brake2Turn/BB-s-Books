// Turning the databases' messy categories into a short list of genres a reader would use.
// Google Books gives broad "categories" ("Fiction / Fantasy / Epic"); Open Library gives
// dozens of free-form "subjects". Both are matched against these rules, first match wins.

export const GENRES = [
  'Fantasy',
  'Science fiction',
  'Mystery & thriller',
  'Romance',
  'Horror',
  'Historical fiction',
  'Literary fiction',
  'Classics',
  'Young adult',
  'Children’s',
  'Graphic novels',
  'Poetry',
  'Biography & memoir',
  'History',
  'Self-help',
  'Science & nature',
  'Food & drink',
  'Non-fiction',
];

// Order matters: specific audiences and forms before broad genres, broad "fiction" last.
const RULES = [
  ['Children’s', /juvenile (fiction|nonfiction)|children'?s (books|stories|fiction)|picture books/],
  ['Young adult', /young adult|\bya\b|teen fiction/],
  ['Graphic novels', /comics|graphic novel|manga/],
  ['Poetry', /\bpoetry\b|\bpoems\b/],
  ['Fantasy', /fantasy|dragons|magic|wizards|fairy tales|mythology/],
  ['Science fiction', /science fiction|sci-fi|dystopia|space opera|cyberpunk|time travel/],
  ['Horror', /horror|ghost stories|vampires|supernatural/],
  ['Mystery & thriller', /mystery|thriller|suspense|crime|detective|psychological fiction|murder/],
  ['Romance', /romance|love stories/],
  ['Historical fiction', /historical fiction|fiction.*historical|historical.*fiction/],
  ['Classics', /classics|classic literature/],
  ['Biography & memoir', /biography|autobiography|memoir/],
  ['Self-help', /self-help|self help|personal growth|psychology|motivation|mindfulness/],
  ['Science & nature', /\bscience\b|nature|natural history|biology|physics|astronomy|mathematics/],
  ['Food & drink', /cooking|cookery|recipes|food|wine/],
  ['History', /\bhistory\b/],
  ['Literary fiction', /literary|fiction/],
];

/** The single best genre for a book from its categories/subjects, or '' if nothing fits. */
export function pickGenre(labels = []) {
  const text = labels.join(' | ').toLowerCase();
  if (!text.trim()) return '';
  for (const [genre, re] of RULES) if (re.test(text)) return genre;
  return 'Non-fiction';
}
