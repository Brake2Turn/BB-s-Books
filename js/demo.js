// A sample shelf for trying the app out (open the app with ?demo). Never written to the real library.
const GENRE = {"The Secret History": "Literary fiction", "Circe": "Fantasy", "Piranesi": "Fantasy", "Rebecca": "Classics", "Klara and the Sun": "Science fiction", "Pride and Prejudice": "Classics", "The Night Circus": "Fantasy", "Normal People": "Literary fiction", "Jane Eyre": "Classics", "The Song of Achilles": "Fantasy", "Tomorrow, and Tomorrow, and Tomorrow": "Literary fiction", "A Little Life": "Literary fiction", "Lessons in Chemistry": "Historical fiction", "The Remains of the Day": "Classics"};

// How the finished samples were read.
const FORMAT = {"The Secret History": "physical", "Circe": "audio", "Rebecca": "physical", "Pride and Prejudice": "audio", "Jane Eyre": "physical"};

const SAMPLES = [
  ['The Secret History', 'Donna Tartt', '9781400031702', 559, 'read', 5, 0, 'A small circle of classics students at a remote Vermont college drift beyond the bounds of ordinary morality, and one of them does not survive it.'],
  ['Circe', 'Madeline Miller', '9780316556347', 393, 'read', 4, 0, 'The witch of Aiaia, banished by the gods, tells her own story: of nymphs and monsters, mortals and Olympians, and the power she makes for herself.'],
  ['Piranesi', 'Susanna Clarke', '9781635575637', 272, 'reading', 0, 158, 'Piranesi lives in the House, an endless labyrinth of marble halls and tides. He keeps careful journals. Something in them does not add up.'],
  ['Rebecca', 'Daphne du Maurier', '9780380730407', 410, 'read', 5, 0, 'A young bride arrives at Manderley and finds the memory of the first Mrs de Winter in every room, and in the housekeeper who loved her.'],
  ['Klara and the Sun', 'Kazuo Ishiguro', '9780593318171', 303, 'want', 0, 0, 'Klara, an Artificial Friend, watches the world from a shop window, waiting to be chosen, and learns what it might mean to love someone.'],
  ['Pride and Prejudice', 'Jane Austen', '9780141439518', 480, 'read', 4, 0, 'Elizabeth Bennet and Mr Darcy misjudge each other spectacularly, and Austen makes the slow correction a pleasure.'],
  ['The Night Circus', 'Erin Morgenstern', '9780307744432', 512, 'want', 0, 0, 'A black-and-white circus that opens only at night is the stage for a contest between two young magicians who were never meant to fall in love.'],
  ['Normal People', 'Sally Rooney', '9781984822185', 273, 'dnf', 0, 96, 'Connell and Marianne circle each other from a small Irish town to Trinity College, never quite able to say what they mean.'],
  ['Jane Eyre', 'Charlotte Brontë', '9780141441146', 624, 'read', 5, 0, 'An orphaned governess with a fierce sense of her own worth arrives at Thornfield Hall, and its master has a secret in the attic.'],
  ['The Song of Achilles', 'Madeline Miller', '9780062060624', 416, 'reading', 0, 64, 'Patroclus, an exiled prince, grows up alongside Achilles, and follows him to Troy knowing how the story is meant to end.'],
  ['Tomorrow, and Tomorrow, and Tomorrow', 'Gabrielle Zevin', '9780593321201', 416, 'want', 0, 0, 'Two friends design video games together over thirty years, through success, betrayal and the long work of forgiveness.'],
  ['A Little Life', 'Hanya Yanagihara', '9780804172707', 814, 'want', 0, 0, 'Four college friends move to New York, and their lives come to orbit Jude, whose past shapes everything that follows.'],
  ['Lessons in Chemistry', 'Bonnie Garmus', '9780385547345', 400, 'read', 4, 0, 'Elizabeth Zott, a chemist pushed out of her lab in the 1960s, ends up hosting a television cooking show and teaching a nation to think.'],
  ['The Remains of the Day', 'Kazuo Ishiguro', '9780679731726', 245, 'want', 0, 0, 'Stevens, an English butler, takes a motoring trip in 1956 and reflects on decades of service, dignity and what he never let himself feel.'],
];

export function sampleBooks() {
  const now = Date.now();
  return SAMPLES.map(([title, author, isbn, pages, status, rating, page, blurb], i) => ({
    id: `demo-${i}`,
    title,
    authors: [author],
    isbn,
    pages,
    page,
    status,
    genre: GENRE[title] || '',
    format: FORMAT[title] || '',
    readingAt: status === 'reading' ? now - i * 3600000 : undefined,
    rating,
    blurb,
    review: '',
    cover: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
    publisher: '',
    published: '',
    addedAt: now - i * 86400000,
  }));
}
