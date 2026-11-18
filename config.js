// Configuration MOURESS Académie.
// Tous les prix sont PROVISOIRES (FCFA) : à valider par la direction commerciale.
export const CONFIG = {
  APP_NAME: 'MOURESS Académie',
  // Renseigner les deux valeurs pour activer SupabaseStore (adaptateur non testé, voir js/store-supabase.js).
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  PASS_MARK: 70,            // seuil de réussite (%)
  EXAM_QUESTIONS: 30,       // nombre de questions par examen (ou moins si le profil en a moins)
  EXAM_TRANSITION_SECONDS: 5,   // pause entre deux questions
  // Durée des questions : minimum 1 min 30 ; 2 min pour les cas pratiques / calculs (durée de base >= LONG_THRESHOLD).
  // Une question dont le contenu prévoit plus (mise en situation jusqu'à 3 min) garde sa durée.
  MIN_QUESTION_SECONDS: 90,
  LONG_QUESTION_SECONDS: 120,
  LONG_THRESHOLD: 75,
  CURRENCY: 'FCFA',
  // Les candidats invités par un lien RH voient-ils la correction détaillée ?
  SHOW_CORRECTION_FOR_SESSIONS: false,

  // Packs de crédits : 1 crédit = 1 candidat invité. Prix provisoires.
  PACKS: [
    { id: 'p10',  credits: 10,  price: 50000,  label: 'Essentiel',  note: 'Pour un premier recrutement' },
    { id: 'p50',  credits: 50,  price: 200000, label: 'Équipe',     note: 'Le plus choisi', featured: true },
    { id: 'p200', credits: 200, price: 650000, label: 'Entreprise', note: 'Volume et suivi des équipes' },
  ],
  FREE_CREDITS_ON_SIGNUP: 3,

  CONTACT: {
    address: 'Libreville, Nzeng-Ayong, Carrefour Fobert',
    phone: '+241 07 46 19 132',
    phoneHref: 'tel:+241074619132',
    whatsapp: 'https://wa.me/241074619132',
  },
  DEMO_ACCOUNT: { email: 'rh@demo.mouress.ga', password: 'Demo2026!' },
};
