import { Mic, Plane, CalendarCheck, Sparkles, Globe2, ShieldCheck } from 'lucide-react';

// Photo libre de droits (Unsplash License, gratuite) — à remplacer par une
// photo de l'agence si tu en as une sous la main.
const HERO_IMAGE = '/img-accueil.avif';

export default function HomePage() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* ─── HERO ─── */}
      <section className="relative flex-shrink-0 min-h-[420px] md:min-h-[520px] flex items-end overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt="Un conseiller Selectour Alltour échangeant avec un client en agence"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Voile pour garder le texte lisible sur la photo */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-gray-900/10" />

        <div className="relative z-10 px-8 pb-10 pt-24 w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/90 text-white text-xs font-medium tracking-wide mb-4">
            <Sparkles size={12} />
            Selectour Alltour
          </div>
          <h1 className="font-serif text-3xl md:text-5xl font-semibold text-white leading-tight max-w-2xl">
            Bienvenue. Votre prochain voyage commence par une conversation.
          </h1>
          <p className="text-white/80 text-sm md:text-base mt-3 max-w-xl">
            Un conseiller à votre écoute, et Nestor, notre concierge vocal, disponible à tout moment pour organiser vos billets et vos rendez-vous.
          </p>
        </div>
      </section>

      <div className="px-8 py-10 space-y-10 max-w-4xl">

        {/* ─── ALLTOUR ─── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
              <Globe2 size={15} className="text-orange-500" />
            </div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Selectour Alltour</h2>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Une agence de voyage, un vrai conseiller</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Selectour Alltour fait partie du réseau Selectour, premier réseau français d'agences de voyage
            indépendantes. Ici, chaque dossier est suivi par un conseiller qui prend le temps de comprendre vos
            attentes : destination, budget, contraintes, envies. Pas d'algorithme anonyme entre vous et votre
            voyage juste des personnes qui connaissent le métier et le font depuis longtemps.
          </p>
        </section>

        {/* ─── NESTOR VOCAL ─── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
              <Mic size={15} className="text-orange-500" />
            </div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">L'application</h2>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Nestor, votre concierge vocal</h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-5">
            Nestor prolonge le travail de votre conseiller entre deux rendez-vous. Parlez-lui simplement, comme à
            un interlocuteur de l'agence : il recherche vos vols avec de vrais prix, prend et gère vos
            rendez-vous, et garde une trace de tout ce que vous réservez dans la langue de votre choix.
          </p>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="card">
              <Plane size={16} className="text-orange-500 mb-2" />
              <p className="text-sm font-medium text-gray-800">Recherche de vols</p>
              <p className="text-xs text-gray-400 mt-1">Origine, destination, date prix réels en quelques secondes.</p>
            </div>
            <div className="card">
              <CalendarCheck size={16} className="text-orange-500 mb-2" />
              <p className="text-sm font-medium text-gray-800">Rendez-vous en agence</p>
              <p className="text-xs text-gray-400 mt-1">Disponibilités, confirmation et liste d'attente gérées pour vous.</p>
            </div>
            <div className="card">
              <ShieldCheck size={16} className="text-orange-500 mb-2" />
              <p className="text-sm font-medium text-gray-800">Toujours sous contrôle</p>
              <p className="text-xs text-gray-400 mt-1">Nestor demande toujours confirmation avant de réserver quoi que ce soit.</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}