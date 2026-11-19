// Configuration MOURESS Training.
// Tous les prix sont PROVISOIRES (FCFA) : à valider par la direction commerciale.
export const CONFIG = {
  APP_NAME: 'MOURESS Training',
  // Renseigner les deux valeurs pour activer SupabaseStore (adaptateur non testé, voir js/store-supabase.js).
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  PASS_MARK: 70,            // seuil de réussite (%)
  EXAM_QUESTIONS: 20,       // nombre de questions par examen (ou moins si le profil en a moins)
  QUESTION_SECONDS: 90,     // durée fixe par question : 1 min 30 pour toutes les questions
  EXAM_TRANSITION_SECONDS: 5,   // pause entre deux questions
  CURRENCY: 'FCFA',
  // Les candidats invités par un lien RH voient-ils la correction détaillée ?
  SHOW_CORRECTION_FOR_SESSIONS: false,

  // Pass : l'entreprise achète un Pass par personne et par poste. Prix PROVISOIRES (FCFA), à valider par la direction.
  // Un Pass = formation (cours) + entraînement illimité + examen + attestation si réussite + résultat transmis à l'entreprise.
  // Le niveau « sup » (superviseur) est facturé au tarif technicien pour l'instant.
  PASS_PRICES: { tech: 50000, tous: 50000, assist: 50000, sup: 50000, ing: 80000, cadre: 80000, mgr: 80000 },
  ATTEMPTS_PER_PASS: 2,     // examen + 1 repassage

  // Durée de validité d'une attestation (habilitation), en mois. PROVISOIRE : à valider par la direction.
  // Un champ facultatif `validityMonths` dans data/profiles.json l'emporte pour un profil donné.
  VALIDITY_MONTHS_DEFAULT: 24,
  ALERT_DAYS: 90,           // alerte « expire bientôt » : habilitations qui expirent sous ce délai

  CONTACT: {
    address: 'Libreville, Nzeng-Ayong, Carrefour Fobert',
    phone: '+33 7 66 67 27 38',
    phoneHref: 'tel:+33766672738',
    whatsapp: 'https://wa.me/33766672738',
  },
  DEMO_ACCOUNT: { email: 'rh@demo.mouress.ga', password: 'Demo2026!' },
};
