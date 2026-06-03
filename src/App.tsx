import { type FormEvent, type PointerEvent, useEffect, useMemo, useRef, useState, Component, ReactNode } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Role = 'joueur' | 'coach' | 'admin' | 'super_admin' | 'parent'

type ChatMessageRow = {
  id: string
  club_id: string
  author_id: string
  author_name: string
  text: string
  created_at: string
}

type ProfileRow = {
  id: string
  role: Role
  nom: string
  club_id: string | null
  needs_club_setup: boolean
  equipe_id: string | null
  is_approved: boolean
}

type ParentChildrenRow = {
  parent_id: string
  child_id: string
  created_at: string
  child_profile?: ProfileRow | null
}

type ClubRow = {
  id: string
  slug: string
  nom: string
  logo_path: string | null
  chat_restricted: boolean
}

type EquipeRow = {
  id: string
  nom: string
  categorie: string
  strategy_shared?: boolean
  strategy_zoom?: string
}

type EvenementRow = {
  id: string
  club_id: string | null
  equipe_id: string | null
  type: 'match' | 'entrainement'
  date: string
  lieu: string
  infos: string | null
}

type PresenceRow = {
  evenement_id: string
  profile_id: string
  statut: 'present' | 'absent' | 'retard'
  created_at: string
  profiles?: { nom?: string } | null
}

type EventConvocationRow = {
  evenement_id: string
  profile_id: string
  created_at: string
  profiles?: { nom?: string } | null
}

type EventVehicleRow = {
  id: string
  evenement_id: string
  owner_profile_id: string | null
  label: string | null
  seats_total: number
  driver_gender?: 'pere' | 'mere' | 'autre' | null
  has_child_present?: boolean | null
  passenger_preference?: 'all' | 'women_and_children' | 'men_and_children' | null
  profiles?: { nom?: string } | null
}

type EventVehicleAssignmentRow = {
  evenement_id: string
  vehicle_id: string
  profile_id: string
  status?: 'pending' | 'approved' | 'rejected'
  profiles?: { nom?: string } | null
}

type TacticalSlotRow = {
  id: string
  equipe_id: string
  slot_index: number
  x: number
  y: number
  profile_id: string | null
  color: string
  profiles?: { nom?: string } | null
}

const roleCards: Array<{ role: Role; title: string; subtitle: string }> = [
  { role: 'joueur', title: 'Joueur', subtitle: 'Suivre matchs et stats' },
  { role: 'coach', title: 'Coach', subtitle: 'Piloter equipe et tests' },
  { role: 'parent', title: 'Parent', subtitle: 'Gérer ses enfants' },
  { role: 'admin', title: 'Admin', subtitle: 'Gestion globale du club' },
]

type SkillLevelDef = {
  level: number
  title: string
  description: string
}

type SkillItemDef = {
  name: string
  levels: SkillLevelDef[]
}

type SkillCategoryDef = {
  id: 'technique' | 'mental' | 'tactique' | 'physique' | 'perceptif' | 'cognitif'
  label: string
  summary: string
  items: SkillItemDef[]
}

const skillCategories: SkillCategoryDef[] = [
  {
    id: 'technique',
    label: 'Technique',
    summary: 'Conduite de balle, passe et gestes sous pression.',
    items: [
      {
        name: 'Conduite de balle',
        levels: [
          { level: 1, title: 'Decouverte', description: 'Conduit le ballon lentement avec controle irregulier.' },
          { level: 2, title: 'En progression', description: 'Garde le controle en mouvement avec peu de pertes.' },
          { level: 3, title: 'Maitrise', description: 'Alterne rythmes et directions avec ballon proche du pied.' },
          { level: 4, title: 'Reference', description: 'Conduit vite, protege et elimine sous pression reelle.' },
        ],
      },
      {
        name: 'Passe sous pression',
        levels: [
          { level: 1, title: 'Decouverte', description: 'Passe reussie sans adversaire proche.' },
          { level: 2, title: 'En progression', description: 'Trouve un partenaire avec opposition moderee.' },
          { level: 3, title: 'Maitrise', description: 'Choisit la bonne passe dans un espace reduit.' },
          { level: 4, title: 'Reference', description: 'Enchaine passe juste et rapide sous pressing intense.' },
        ],
      },
    ],
  },
  {
    id: 'mental',
    label: 'Mental',
    summary: 'Concentration, engagement, gestion emotionnelle.',
    items: [
      {
        name: 'Concentration',
        levels: [
          { level: 1, title: 'Decouverte', description: 'Perd vite le fil de la consigne en seance.' },
          { level: 2, title: 'En progression', description: 'Reste concentre sur des sequences courtes.' },
          { level: 3, title: 'Maitrise', description: 'Maintient son attention meme apres une erreur.' },
          { level: 4, title: 'Reference', description: 'Concentration stable du debut a la fin.' },
        ],
      },
      {
        name: 'Gestion emotionnelle',
        levels: [
          { level: 1, title: 'Decouverte', description: 'Reagit fortement a la frustration.' },
          { level: 2, title: 'En progression', description: 'Retrouve son calme avec accompagnement.' },
          { level: 3, title: 'Maitrise', description: 'Controle ses reactions dans les temps faibles.' },
          { level: 4, title: 'Reference', description: 'Reste lucide et positif dans les moments critiques.' },
        ],
      },
    ],
  },
  {
    id: 'tactique',
    label: 'Tactique',
    summary: 'Placement, timing, lecture collective du jeu.',
    items: [
      {
        name: 'Placement defensif',
        levels: [
          { level: 1, title: 'Decouverte', description: 'Repere tardivement sa zone et son role.' },
          { level: 2, title: 'En progression', description: 'Occupe globalement la bonne zone.' },
          { level: 3, title: 'Maitrise', description: 'Ajuste son placement selon ballon et partenaires.' },
          { level: 4, title: 'Reference', description: 'Anticipe et ferme les espaces avant le danger.' },
        ],
      },
      {
        name: 'Lecture des transitions',
        levels: [
          { level: 1, title: 'Decouverte', description: 'Reagit tard aux pertes et recuperations.' },
          { level: 2, title: 'En progression', description: 'Declenche un replacement simple.' },
          { level: 3, title: 'Maitrise', description: 'Fait le bon choix en transition offensive/defensive.' },
          { level: 4, title: 'Reference', description: 'Influence positivement la transition de toute l equipe.' },
        ],
      },
    ],
  },
  {
    id: 'physique',
    label: 'Physique',
    summary: 'Vitesse, endurance, repetition des efforts.',
    items: [
      {
        name: 'VMA / capacite aerobie',
        levels: [
          { level: 1, title: 'Decouverte', description: 'Difficulte a tenir les blocs d effort.' },
          { level: 2, title: 'En progression', description: 'Tient l intensite sur des sequences limitees.' },
          { level: 3, title: 'Maitrise', description: 'Repete les courses avec recuperation correcte.' },
          { level: 4, title: 'Reference', description: 'Maintient haute intensite sur toute la seance.' },
        ],
      },
      {
        name: 'Sprint 20m',
        levels: [
          { level: 1, title: 'Decouverte', description: 'Depart et acceleration encore lents.' },
          { level: 2, title: 'En progression', description: 'Acceleration correcte sur les premiers metres.' },
          { level: 3, title: 'Maitrise', description: 'Bonne frequence et vitesse terminale stable.' },
          { level: 4, title: 'Reference', description: 'Sprint explosif et reproductible en serie.' },
        ],
      },
    ],
  },
  {
    id: 'perceptif',
    label: 'Perceptif',
    summary: 'Prise d information visuelle et orientation.',
    items: [
      {
        name: 'Vision peripherique',
        levels: [
          { level: 1, title: 'Decouverte', description: 'Observe surtout le ballon, peu l environnement.' },
          { level: 2, title: 'En progression', description: 'Identifie quelques options autour de lui.' },
          { level: 3, title: 'Maitrise', description: 'Scanne frequemment avant de recevoir.' },
          { level: 4, title: 'Reference', description: 'Utilise infos peripheriques pour devancer le jeu.' },
        ],
      },
      {
        name: 'Orientation du corps',
        levels: [
          { level: 1, title: 'Decouverte', description: 'Orientation fermee, options de jeu limitees.' },
          { level: 2, title: 'En progression', description: 'Ouvre son corps dans des situations simples.' },
          { level: 3, title: 'Maitrise', description: 'Oriente son controle selon la pression.' },
          { level: 4, title: 'Reference', description: 'Orientation optimale et constante avant reception.' },
        ],
      },
    ],
  },
  {
    id: 'cognitif',
    label: 'Cognitif',
    summary: 'Decision, memoire tactique, adaptation rapide.',
    items: [
      {
        name: 'Vitesse de decision',
        levels: [
          { level: 1, title: 'Decouverte', description: 'Hesite souvent avant de choisir.' },
          { level: 2, title: 'En progression', description: 'Prend des decisions simples avec delai reduit.' },
          { level: 3, title: 'Maitrise', description: 'Choisit vite et juste dans des contextes variables.' },
          { level: 4, title: 'Reference', description: 'Decision immediate et pertinente sous forte pression.' },
        ],
      },
      {
        name: 'Memoire tactique',
        levels: [
          { level: 1, title: 'Decouverte', description: 'Retient partiellement les principes collectifs.' },
          { level: 2, title: 'En progression', description: 'Applique les consignes recurrentes.' },
          { level: 3, title: 'Maitrise', description: 'Transfere les schemas vus a l entrainement.' },
          { level: 4, title: 'Reference', description: 'Mobilise automatiquement les reperes tactiques.' },
        ],
      },
    ],
  },
]

function getClubSlugFromHost() {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname
  if (host === 'localhost' || /^[0-9.]+$/.test(host)) return null
  const parts = host.split('.')
  if (parts.length < 3) return null
  return parts[0]
}

function slugify(input: string) {
  if (!input) return ''
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function formatSupabaseError(caught: unknown) {
  if (caught instanceof Error) {
    return caught.message
  }

  if (typeof caught === 'string') {
    return caught
  }

  if (caught && typeof caught === 'object') {
    const maybe = caught as {
      message?: unknown
      details?: unknown
      hint?: unknown
      code?: unknown
      statusCode?: unknown
      error?: unknown
    }

    const parts: string[] = []
    if (maybe.message) parts.push(String(maybe.message))
    if (maybe.details) parts.push(String(maybe.details))
    if (maybe.hint) parts.push(String(maybe.hint))
    if (maybe.code) parts.push(`(${String(maybe.code)})`)
    if (maybe.statusCode) parts.push(`status=${String(maybe.statusCode)}`)
    if (maybe.error) parts.push(String(maybe.error))

    if (parts.length > 0) {
      const message = parts.join(' ')
      const lower = message.toLowerCase()
      if (lower.includes('email rate limit exceeded')) {
        return (
          "Limite d'envoi d'emails Supabase atteinte (email rate limit exceeded). " +
          "Pour tester: desactive la confirmation email dans Supabase (Authentication → Providers → Email → Confirm email OFF), " +
          "ou configure un SMTP perso, ou attends le reset du quota."
        )
      }
      return message
    }

    try {
      return JSON.stringify(caught)
    } catch {
      // ignore
    }
  }

  return 'Erreur inconnue'
}

function decodeJwtPayload(token: string) {
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return null

    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const json = atob(padded)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function faviconDataUrlFromText(text: string) {
  const content = text.trim().slice(0, 3).toUpperCase() || 'CLB'
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#39e8ff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#70ff97" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="116" height="116" rx="28" fill="url(#g)" stroke="#39e8ff" stroke-width="6"/>
  <text x="64" y="74" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="48" font-weight="800" fill="#001024">${content}</text>
</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function applyBranding(brandName: string | null, iconUrl: string | null) {
  if (typeof document === 'undefined') return
  if (brandName) {
    document.title = brandName
  }

  const nextIconUrl = iconUrl ?? (brandName ? faviconDataUrlFromText(brandName) : null)
  if (!nextIconUrl) return

  const iconLinks = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'),
  )

  if (iconLinks.length) {
    for (const link of iconLinks) {
      link.href = nextIconUrl
    }
    return
  }

  const link = document.createElement('link')
  link.rel = 'icon'
  link.href = nextIconUrl
  document.head.appendChild(link)
}

function EyeIcon({ opened }: { opened: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12c2.5-4 5.8-6 10-6s7.5 2 10 6c-2.5 4-5.8 6-10 6S4.5 16 2 12Z" />
      {opened ? <circle cx="12" cy="12" r="3.1" /> : <path d="M4 20L20 4" />}
    </svg>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<Role>('coach')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nom, setNom] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [publicClub, setPublicClub] = useState<ClubRow | null>(null)

  const publicClubLogoUrl = useMemo(() => {
    if (!supabase) return null
    if (!publicClub?.logo_path) return null
    return supabase.storage.from('club-logos').getPublicUrl(publicClub.logo_path).data.publicUrl
  }, [publicClub?.logo_path])

  useEffect(() => {
    if (!supabase) return

    const slug = getClubSlugFromHost()
    if (!slug) {
      setPublicClub(null)
      return
    }

    let ignore = false
    void (async () => {
      const { data, error } = await supabase.rpc('get_club_public', { p_slug: slug })
      if (ignore) return
      if (error) {
        setPublicClub(null)
        return
      }

      const row = Array.isArray(data) ? (data[0] as ClubRow | undefined) : (data as ClubRow | null)
      const club = row ?? null
      setPublicClub(club)

      if (club?.nom) {
        const iconUrl =
          club.logo_path && supabase
            ? supabase.storage.from('club-logos').getPublicUrl(club.logo_path).data.publicUrl
            : null
        applyBranding(club.nom, iconUrl)
      }
    })()

    return () => {
      ignore = true
    }
  }, [])

  const requestPasswordReset = async () => {
    setError(null)
    setInfo(null)

    if (!supabase) {
      setError("Supabase n'est pas configure")
      return
    }

    if (!email.trim()) {
      setError("Renseigne ton email d'abord")
      return
    }

    setResetBusy(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resetError) {
        setError(resetError.message)
        return
      }

      setInfo('Email envoye. Ouvre le lien pour choisir un nouveau mot de passe.')
    } finally {
      setResetBusy(false)
    }
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setError(null)
    setInfo(null)

    if (!supabase) {
      setInfo(
        "Supabase n'est pas configure. Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env, puis relance le serveur.",
      )
      navigate('/dashboard')
      return
    }

    try {
      setLoading(true)

      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) {
          setError(signInError.message)
          return
        }
        navigate('/dashboard')
        return
      }

      if (!nom.trim()) {
        setError('Nom requis')
        return
      }

      if (!inviteCode.trim()) {
        setError("Code d'invitation requis")
        return
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nom: nom.trim(),
            invite_code: inviteCode.trim(),
          },
        },
      })

      if (signUpError) {
        const raw = signUpError.message
        const lower = raw.toLowerCase()

        if (lower.includes('email rate limit exceeded')) {
          setError(
            "Limite d'envoi d'emails Supabase atteinte. " +
            "Desactive la confirmation email pour tester (Authentication → Providers → Email → Confirm email OFF), " +
            "ou configure un SMTP perso, ou attends le reset du quota.",
          )
        } else if (lower.includes('invalid invite_code')) {
          setError("Code d'invitation invalide")
        } else if (lower.includes('invite_code is required')) {
          setError("Code d'invitation requis")
        } else if (lower.includes('nom is required')) {
          setError('Nom requis')
        } else if (lower.includes('invalid role')) {
          setError('Role invalide')
        } else {
          setError(raw)
        }
        return
      }

      // Toujours revenir a l'ecran de connexion apres inscription.
      // Si la confirmation email est desactivee, Supabase peut creer une session: on la ferme pour forcer la connexion.
      if (data.session) {
        await supabase.auth.signOut()
      }

      setMode('login')
      setInfo(
        "Compte cree. Connecte-toi (si la confirmation email est activee, confirme d'abord puis reconnecte-toi).",
      )
      navigate('/', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="page login-page">
      <header className="brand-header">
        <div className={`club-mark ${publicClubLogoUrl ? 'club-logo' : ''}`}>
          {publicClubLogoUrl ? (
            <img src={publicClubLogoUrl} alt={publicClub?.nom ? `Logo ${publicClub.nom}` : 'Logo club'} />
          ) : (
            publicClub?.slug?.slice(0, 4).toUpperCase() ?? 'CLUB'
          )}
        </div>
        <div>
          <h1>{publicClub?.nom ?? 'Plateforme Clubs'}</h1>
          <p>{publicClub ? 'Connexion au club' : 'Connexion a la plateforme'}</p>
        </div>
      </header>

      <div className="role-grid">
        {roleCards.map((entry) => (
          <button
            key={entry.role}
            type="button"
            className={`role-card ${role === entry.role ? 'active' : ''}`}
            onClick={() => {
              setRole(entry.role)
            }}
            aria-disabled={mode === 'signup' && entry.role !== 'joueur'}
            disabled={mode === 'signup' && entry.role !== 'joueur'}
          >
            <span className="role-icon" aria-hidden="true">
              {entry.title.slice(0, 1)}
            </span>
            <strong>{entry.title}</strong>
            <small>{entry.subtitle}</small>
          </button>
        ))}
      </div>

      <p className="login-hint">
        Le role est attribue par le club (code d'invitation).
      </p>

      <form className="login-form panel" onSubmit={onSubmit}>
        <div className="form-top-row">
          <strong className="form-title">
            {mode === 'login' ? 'Connexion' : 'Inscription'}
          </strong>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setError(null)
              setInfo(null)
              setMode((value) => (value === 'login' ? 'signup' : 'login'))
            }}
          >
            {mode === 'login' ? "S'inscrire" : 'Deja un compte ?'}
          </button>
        </div>

        <label>
          Email
          <input
            type="email"
            placeholder="email@exemple.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        {mode === 'signup' && (
          <label>
            Nom
            <input
              placeholder="Nom et prenom"
              value={nom}
              onChange={(event) => setNom(event.target.value)}
              required
            />
          </label>
        )}

        {mode === 'signup' && (
          <label>
            Code d'invitation
            <input
              placeholder="Ex: SIFC-U12-2026 ou SIFC-U9-2026"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              required
            />
          </label>
        )}

        <label>
          Mot de passe
          <div className="password-input">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Votre mot de passe"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="eye-button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              <EyeIcon opened={showPassword} />
            </button>
          </div>
        </label>

        {mode === 'login' && (
          <button
            type="button"
            className="link-button"
            onClick={requestPasswordReset}
            disabled={resetBusy}
          >
            {resetBusy ? 'Envoi...' : 'Mot de passe oublie ?'}
          </button>
        )}

        {error && <p className="form-feedback error">{error}</p>}
        {info && <p className="form-feedback info">{info}</p>}

        <button type="submit" className="primary-button">
          {loading
            ? 'Chargement...'
            : mode === 'login'
              ? 'Connexion'
              : 'Creer un compte'}
        </button>
      </form>
    </section>
  )
}

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setInfo(null)

    if (!supabase) {
      setError("Supabase n'est pas configure")
      return
    }

    if (!password.trim()) {
      setError('Nouveau mot de passe requis')
      return
    }

    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }

      setInfo('Mot de passe mis a jour. Connexion en cours...')
      navigate('/dashboard')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page login-page">
      <header className="brand-header">
        <div className="club-mark">SIFC</div>
        <div>
          <h1>Soissons IFC</h1>
          <p>Reinitialiser le mot de passe</p>
        </div>
      </header>

      <form className="login-form panel" onSubmit={onSubmit}>
        <strong className="form-title">Nouveau mot de passe</strong>

        <label>
          Nouveau mot de passe
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <label>
          Confirmer
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </label>

        {error && <p className="form-feedback error">{error}</p>}
        {info && <p className="form-feedback info">{info}</p>}

        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? 'Mise a jour...' : 'Mettre a jour'}
        </button>
      </form>
    </section>
  )
}

function DashboardPage({
  club,
  role,
  equipe,
  userId,
  authorName,
  parentChildren,
  activeChildId,
  setActiveChildId,
  refreshParentChildren,
}: {
  club: ClubRow | null
  role: Role | null
  equipe: EquipeRow | null
  userId: string | null
  authorName: string | null
  parentChildren: Array<{ id: string; nom: string; equipe_id: string | null; team_name: string; is_approved: boolean }>
  activeChildId: string
  setActiveChildId: (id: string) => void
  refreshParentChildren: (userId?: string, role?: string | null) => Promise<void>
}) {
  const categoryIcons: Record<string, string> = {
    Technique: '⚽',
    Mental: '🧠',
    Tactique: '🗺️',
    Physique: '💪',
    Perceptif: '👁️',
    Cognitif: '🔵',
  }

  const [stats, setStats] = useState({
    players: 0,
    events: 0,
    evaluations: 0
  })
  const [nextEvent, setNextEvent] = useState<EvenementRow | null>(null)
  const [myLevels, setMyLevels] = useState<any[]>([])

  const [pendingProfiles, setPendingProfiles] = useState<any[]>([])
  const [adminTeams, setAdminTeams] = useState<any[]>([])
  
  const [childNom, setChildNom] = useState('')
  const [childCategorie, setChildCategorie] = useState('U12')
  const [addBusy, setAddBusy] = useState(false)

  const clubLogoUrl = useMemo(() => {
    if (!supabase || !club?.logo_path) return null
    return supabase.storage.from('club-logos').getPublicUrl(club.logo_path).data.publicUrl
  }, [club?.logo_path])

  useEffect(() => {
    if (!supabase || !club?.id) return

    let ignore = false

    const loadDashboard = async () => {
      const now = new Date().toISOString()

      // Prochain événement (selon équipe ou club)
      let eventQuery = supabase
        .from('evenements')
        .select('*, equipes(nom, categorie)')
        .eq('club_id', club.id)
        .gte('date', now)
        .order('date')
        .limit(1)

      let targetEquipeId = equipe?.id
      if (role === 'parent') {
        const activeChild = parentChildren.find(c => c.id === activeChildId)
        targetEquipeId = activeChild?.equipe_id || null
      }

      if (role !== 'admin' && targetEquipeId) {
        eventQuery = eventQuery.eq('equipe_id', targetEquipeId)
      } else if (role === 'parent' && !targetEquipeId) {
        eventQuery = eventQuery.eq('id', '00000000-0000-0000-0000-000000000000') // query that returns empty
      }
      
      const { data: ev } = await eventQuery.maybeSingle()
      if (!ignore) setNextEvent(ev as any)

      // Stats spécifiques
      if (role === 'admin') {
        const { count: pCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('club_id', club.id).eq('role', 'joueur')
        const { count: eCount } = await supabase.from('evenements').select('*', { count: 'exact', head: true }).eq('club_id', club.id).gte('date', now)
        if (!ignore) setStats({ players: pCount || 0, events: eCount || 0, evaluations: 0 })
        
        const { data: pendings } = await supabase.from('profiles').select('*').eq('club_id', club.id).eq('is_approved', false)
        if (!ignore) setPendingProfiles(pendings || [])
        
        const { data: teams } = await supabase.from('equipes').select('*').eq('club_id', club.id).order('categorie')
        if (!ignore) setAdminTeams(teams || [])
      } else if (role === 'coach' && equipe?.id) {
        const { count: pCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('equipe_id', equipe.id).eq('role', 'joueur')
        const { count: eCount } = await supabase.from('evenements').select('*', { count: 'exact', head: true }).eq('equipe_id', equipe.id).gte('date', now)
        if (!ignore) setStats({ players: pCount || 0, events: eCount || 0, evaluations: 0 })
      } else if (role === 'joueur' && userId) {
        const { data: lvls } = await supabase.from('player_competency_levels').select('*, competency_framework(*)').eq('profile_id', userId)
        if (!ignore) setMyLevels(lvls || [])
      }

      if (role === 'parent' && club?.id) {
        const { data: teams } = await supabase.from('equipes').select('*').eq('club_id', club.id).order('categorie')
        if (!ignore) {
          setAdminTeams(teams || [])
          if (teams && teams.length > 0 && !childCategorie) {
             setChildCategorie(teams[0].id)
          }
        }
      }
    }

    loadDashboard()
    return () => { ignore = true }
  }, [club?.id, role, equipe?.id, userId, activeChildId, parentChildren])

  return (
    <section className="page dashboard-page">
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>Bonjour, {role === 'admin' ? 'Président' : role === 'coach' ? 'Coach' : role === 'parent' ? 'Parent' : 'Champion'}</h1>
          <p className="muted">{club?.nom} • {role === 'admin' ? 'Gestion Club' : role === 'parent' ? 'Espace Famille' : equipe?.categorie || 'Football'}</p>
        </div>
        {clubLogoUrl && <img src={clubLogoUrl} className="dash-club-logo" alt="Logo" />}
      </header>

      {role === 'parent' && parentChildren.length > 0 && (
        <div className="child-selector-container panel" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(26,29,54,0.6) 0%, rgba(13,15,30,0.8) 100%)', border: '1px solid rgba(57, 232, 255, 0.15)', borderRadius: '16px' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--text-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--primary-color)' }}>⚽</span> Sélectionner l'enfant actif :
          </h3>
          <div className="child-scroll-grid" style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'thin' }}>
            {parentChildren.map((child) => {
              const isActive = child.id === activeChildId
              return (
                <button
                  key={child.id}
                  onClick={() => setActiveChildId(child.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: '150px',
                    padding: '1rem',
                    background: isActive ? 'linear-gradient(180deg, rgba(57, 232, 255, 0.15) 0%, rgba(112, 255, 151, 0.05) 100%)' : 'rgba(255, 255, 255, 0.03)',
                    border: isActive ? '2px solid #39e8ff' : '2px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: isActive ? '0 0 15px rgba(57, 232, 255, 0.35)' : 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    color: 'inherit',
                    textAlign: 'center',
                  }}
                  className={`child-card-btn ${isActive ? 'active' : ''}`}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: isActive ? 'linear-gradient(135deg, #39e8ff 0%, #70ff97 100%)' : 'rgba(255, 255, 255, 0.1)',
                    color: isActive ? '#001024' : 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    marginBottom: '0.75rem',
                    boxShadow: isActive ? '0 0 10px rgba(57, 232, 255, 0.5)' : 'none',
                  }}>
                    {child.nom ? child.nom.slice(0, 2).toUpperCase() : '??'}
                  </div>
                  <strong style={{ display: 'block', fontSize: '0.95rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                    {child.nom ? child.nom.split(' (')[0] : 'Enfant'}
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 500, marginTop: '0.25rem', display: 'block' }}>
                    {child.team_name}
                  </span>
                  <div style={{
                    fontSize: '0.75rem',
                    marginTop: '0.5rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '12px',
                    background: child.is_approved ? 'rgba(112, 255, 151, 0.15)' : 'rgba(255, 193, 7, 0.15)',
                    color: child.is_approved ? '#70ff97' : '#ffc107',
                    fontWeight: 500,
                  }}>
                    {child.is_approved ? '✅ Validé' : '⏳ En attente'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="dash-grid">
        {/* Vue ADMIN : Chiffres clés du club */}
        {role === 'admin' && (
          <div className="dash-card main-stats">
            <h3>État du Club</h3>
            <div className="stats-row">
              <div className="stat-item">
                <span className="value">{stats.players}</span>
                <span className="label">Joueurs inscrits</span>
              </div>
              <div className="stat-item">
                <span className="value">{stats.events}</span>
                <span className="label">Événements à venir</span>
              </div>
            </div>
            <div className="quick-actions">
              <NavLink to="/settings" className="btn-dash">Gérer le club</NavLink>
              <NavLink to="/events" className="btn-dash">Planifier</NavLink>
            </div>
          </div>
        )}

        {/* Vue COACH : État de son équipe */}
        {role === 'coach' && (
          <div className="dash-card team-status">
            <h3>Mon Équipe ({equipe?.categorie})</h3>
            <div className="stats-row">
              <div className="stat-item">
                <span className="value">{stats.players}</span>
                <span className="label">Joueurs</span>
              </div>
              <div className="stat-item">
                <span className="value">{stats.events}</span>
                <span className="label">Matchs/Entraînements</span>
              </div>
            </div>
            <NavLink to="/tests" className="primary-button dash-cta">Évaluer mes joueurs</NavLink>
          </div>
        )}

        {/* Vue PARENT : Gestion des enfants */}
        {role === 'parent' && (
          <div className="dash-card">
            <h3>Mes enfants</h3>
            {parentChildren.length > 0 ? (
              <ul className="presence-list" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                {parentChildren.map(child => (
                  <li key={child.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--surface-color)', borderRadius: '6px', marginBottom: '0.5rem', border: child.id === activeChildId ? '1px solid #39e8ff' : 'none' }}>
                    <div>
                      <strong>{child.nom || 'Enfant sans nom'}</strong>
                      <p className="muted" style={{ margin: 0 }}>
                        {child.is_approved ? '✅ Validé (Joueur)' : '⏳ En attente de validation'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {child.id === activeChildId && <span style={{ fontSize: '0.8rem', color: '#39e8ff', fontWeight: 600 }}>Actif</span>}
                      {['U15', 'U18', 'U21', 'Seniors'].includes(child.team_category) && (
                        <button 
                          className="link-button" 
                          onClick={async () => {
                            if (!supabase || !club || !userId) return
                            const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
                            const suffix = Math.random().toString(36).slice(2, 7).toUpperCase()
                            const code = `${club.slug.toUpperCase()}-JOUEUR-${stamp}-${suffix}`
                            
                            const { error } = await supabase.from('invitation_codes').insert({
                              code,
                              kind: 'club_member',
                              role: 'joueur',
                              club_id: club.id,
                              equipe_id: child.equipe_id,
                              active: true,
                              max_uses: 1,
                              used_count: 0,
                              created_by: userId,
                              target_profile_id: child.id
                            })
                            if (error) alert('Erreur: ' + error.message)
                            else alert(`Code généré: ${code}\nDonnez ce code au joueur pour qu'il s'approprie le compte.`)
                          }}
                        >
                          Générer Code
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ marginTop: '1rem' }}>Tu n'as pas encore ajouté d'enfant.</p>
            )}

            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-color)', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>Ajouter un enfant</h4>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input placeholder="Prénom et Nom" value={childNom} onChange={e => setChildNom(e.target.value)} style={{ flex: 1, minWidth: '150px' }} />
                <select value={childCategorie || (adminTeams[0]?.id ?? '')} onChange={e => setChildCategorie(e.target.value)} style={{ width: '140px' }}>
                  {adminTeams.map(t => (
                    <option key={t.id} value={t.id}>{t.categorie} - {t.nom}</option>
                  ))}
                </select>
                <button 
                  className="primary-button" 
                  disabled={addBusy || !childNom || !adminTeams.length}
                  onClick={async () => {
                    if(!supabase || !userId || !club) return
                    
                    const selectedEqId = childCategorie || adminTeams[0]?.id
                    if (!selectedEqId) return
                    
                    const eq = adminTeams.find(t => t.id === selectedEqId)
                    if (!eq) return

                    setAddBusy(true)
                    try {
                      const finalNom = `${childNom} (${eq.categorie})`
                      const { data: newId, error: pErr } = await supabase.rpc('create_ghost_profile', {
                        p_nom: finalNom,
                        p_club_id: club.id,
                        p_equipe_id: selectedEqId
                      })
                      if (pErr) throw pErr
                      
                      setChildNom('')
                      await refreshParentChildren(userId, role)
                    } catch(e) {
                      alert('Erreur: ' + (e as Error).message)
                    } finally {
                      setAddBusy(false)
                    }
                  }}
                >
                  Ajouter
                </button>
              </div>
              <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Le profil sera soumis à la validation du coach.</p>
            </div>
          </div>
        )}

        {/* Vue ADMIN : Validations en attente */}
        {role === 'admin' && pendingProfiles.length > 0 && (
          <div className="dash-card">
            <h3>Joueurs en attente de validation</h3>
            <ul className="presence-list" style={{ marginTop: '1rem' }}>
              {pendingProfiles.map(p => (
                <li key={p.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem', background: 'var(--surface-color)', borderRadius: '6px', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <strong>{p.nom}</strong>
                  </div>
                  <button className="primary-button" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={async () => {
                    const eqId = p.equipe_id
                    if (!eqId || !supabase) return
                    try {
                      const { error: vErr } = await supabase.rpc('approve_ghost_profile', {
                        p_child_id: p.id,
                        p_equipe_id: eqId
                      })
                      if (vErr) throw vErr
                      setPendingProfiles(prev => prev.filter(x => x.id !== p.id))
                    } catch(e) {
                      alert('Erreur lors de la validation: ' + (e as Error).message)
                    }
                  }}>
                    Valider
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Vue JOUEUR : Espace Champion */}
        {role === 'joueur' && (
          <>
            <div className="dash-card player-hero">
              <div className="hero-content">
                <span className="eyebrow">Prêt pour le prochain défi ?</span>
                <h3>Continue tes efforts, {authorName} !</h3>
                <p>Ton coach a hâte de voir tes progrès sur le terrain.</p>
              </div>
              <div className="hero-stats">
                <div className="hero-stat">
                  <span className="val">{myLevels.length}</span>
                  <span className="lab">Compétences évaluées</span>
                </div>
              </div>
            </div>

            <div className="dash-card player-progress-detailed">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Mes Points Forts</h3>
                <NavLink to="/tests" className="link-button">Tout voir</NavLink>
              </div>

              {myLevels.length > 0 ? (
                <div className="skills-mini-grid">
                  {myLevels.slice(0, 4).map(l => (
                    <div key={l.id} className="skill-mini-card">
                      <div className="skill-icon">
                        {categoryIcons[l.competency_framework?.category] || '⚽'}
                      </div>
                      <div className="skill-details">
                        <span className="name">{l.competency_framework?.competency_name}</span>
                        <div className="lvl-track">
                          <span className="lvl-text">Niv. {l.current_level_rank}</span>
                          <div className="mini-bar">
                            <div className="fill" style={{ width: `${(l.current_level_rank / 4) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>Pas encore d'évaluations. Continue de t'entraîner dur !</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Prochain Rendez-vous (Commun à tous) */}
        <div className="dash-card next-event-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3>Prochain Rendez-vous</h3>
            {nextEvent && (nextEvent as any).equipes && (
              <span className="team-badge">{(nextEvent as any).equipes.categorie}</span>
            )}
          </div>

          {nextEvent ? (
            <div className="event-info-dash">
              <div className="date-badge">
                <span className="day">{new Date(nextEvent.date).getDate()}</span>
                <span className="month">{new Date(nextEvent.date).toLocaleString('fr-FR', { month: 'short' })}</span>
              </div>
              <div className="text-info">
                <h4>{nextEvent.type === 'match' ? '⚽ Match' : '🏃 Entraînement'}</h4>
                <p>{nextEvent.lieu} • {new Date(nextEvent.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ) : (
            <p className="muted">Aucun événement prévu pour le moment.</p>
          )}
          <NavLink to="/events" className="primary-button dash-cta" style={{ width: '100%', textAlign: 'center' }}>
            Voir tout le calendrier
          </NavLink>
        </div>
      </div>
    </section>
  )
}

function TeamPage({
  club,
  equipe,
  role,
}: {
  club: ClubRow | null
  equipe: EquipeRow | null
  role: Role | null
}) {
  const [players, setPlayers] = useState<Array<{ id: string; nom: string }>>([])
  const [playersError, setPlayersError] = useState<string | null>(null)
  const [playersBusy, setPlayersBusy] = useState(false)
  
  const [adminTeams, setAdminTeams] = useState<any[]>([])

  const equipeId = equipe?.id ?? null

  const refreshPlayers = async () => {
    setPlayersError(null)
    if (!supabase) {
      setPlayers([])
      return
    }
    if (!equipeId) {
      setPlayers([])
      return
    }

    setPlayersBusy(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nom, role, equipe_id')
        .eq('equipe_id', equipeId)
        .eq('role', 'joueur')
        .order('nom', { ascending: true })
        .limit(200)

      if (error) throw error
      setPlayers(((data as Array<{ id: string; nom: string }>) ?? []).map((row) => ({ id: row.id, nom: row.nom })))
    } catch (caught) {
      setPlayers([])
      setPlayersError(formatSupabaseError(caught))
    } finally {
      setPlayersBusy(false)
    }
  }

  useEffect(() => {
    void refreshPlayers()
    
    if (role === 'admin' && club?.id) {
      supabase?.from('equipes')
        .select('*')
        .eq('club_id', club.id)
        .order('categorie')
        .then(({ data }) => setAdminTeams(data || []))
    }
  }, [equipeId, role, club?.id])

  useEffect(() => {
    if (!supabase) return
    if (!equipeId) return

    const channel = supabase
      .channel(`team-roster:${equipeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles', filter: `equipe_id=eq.${equipeId}` },
        () => void refreshPlayers(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `equipe_id=eq.${equipeId}` },
        () => void refreshPlayers(),
      )
      .subscribe()

    return () => {
      if (supabase) void supabase.removeChannel(channel)
    }
  }, [equipeId])

  return (
    <section className="page team-page">
      <header className="page-title">
        <h2>Effectif de l'Équipe</h2>
        <p>{equipe ? `${equipe.categorie} - ${equipe.nom}` : club ? club.nom : 'Mon Équipe'}</p>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
        <article className="panel roster-list">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Membres actifs</h3>
            <button
              type="button"
              className="link-button"
              onClick={() => void refreshPlayers()}
              disabled={playersBusy}
            >
              Recharger
            </button>
          </div>
          
          {playersError && <p className="form-feedback error">{playersError}</p>}
          {!equipeId && <p className="muted">Aucune équipe active sélectionnée.</p>}
          {equipeId && players.length === 0 && <p className="muted">Aucun joueur dans cette équipe pour le moment.</p>}
          
          {players.length > 0 && (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {players.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: '0.8rem 1rem',
                    borderRadius: '0.9rem',
                    border: '1px solid rgba(0, 243, 255, 0.18)',
                    background: 'rgba(0, 16, 36, 0.35)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                  }}
                >
                  <strong style={{ flex: 1 }}>{p.nom}</strong>
                  
                  {role === 'admin' && adminTeams.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <select 
                        defaultValue={equipeId || ''}
                        onChange={async (e) => {
                          const newEqId = e.target.value;
                          if (!newEqId || !supabase) return;
                          if (!confirm(`Voulez-vous vraiment changer la catégorie de ce joueur ?`)) {
                            e.target.value = equipeId || '';
                            return;
                          }
                          try {
                            const { error: err } = await supabase.rpc('approve_ghost_profile', {
                              p_child_id: p.id,
                              p_equipe_id: newEqId
                            });
                            if (err) throw err;
                            // Remove from current list if moved
                            if (newEqId !== equipeId) {
                              setPlayers(prev => prev.filter(x => x.id !== p.id));
                            }
                          } catch (err) {
                            alert('Erreur: ' + (err as Error).message);
                            e.target.value = equipeId || '';
                          }
                        }}
                        style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem', height: 'auto', background: 'rgba(0,0,0,0.3)' }}
                      >
                        {adminTeams.map(t => (
                          <option key={t.id} value={t.id}>{t.categorie} - {t.nom}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="chip" style={{ fontSize: '0.75rem', background: 'rgba(0, 243, 255, 0.1)' }}>
                      Joueur
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  )
}

function StrategyPage({
  club,
  equipe,
  role,
  parentChildren,
  activeChildId,
}: {
  club: ClubRow | null
  equipe: EquipeRow | null
  role: Role | null
  parentChildren: Array<{ id: string; nom: string; equipe_id: string | null; team_name: string; team_category: string; is_approved: boolean }>
  activeChildId: string
}) {
  const [players, setPlayers] = useState<Array<{ id: string; nom: string }>>([])
  const [playersError, setPlayersError] = useState<string | null>(null)
  const [playersBusy, setPlayersBusy] = useState(false)

  const [slots, setSlots] = useState<TacticalSlotRow[]>([])
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [slotsBusy, setSlotsBusy] = useState(false)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null)

  const [localShared, setLocalShared] = useState(false)
  const [localZoom, setLocalZoom] = useState<'full' | 'half' | 'quarter-top' | 'quarter-bottom'>('full')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeColor, setActiveColor] = useState('#00f3ff') // cyan default

  const pitchRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef<{ slotIndex: number; pointerId: number } | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const canEdit = role === 'coach' || role === 'admin' || role === 'super_admin'

  // Determine active team
  let equipeId = equipe?.id ?? null
  if (role === 'parent') {
    const activeChild = parentChildren.find((c) => c.id === activeChildId)
    equipeId = activeChild?.equipe_id || null
  }

  // Preset neon colors for quick selection
  const colorPresets = ['#00f3ff', '#ff0055', '#ffe087', '#6effac', '#ffaa00', '#ffffff']

  const defaultSlots = useMemo(() => {
    if (!equipeId) return []
    const defs: Array<Omit<TacticalSlotRow, 'id' | 'profiles'>> = [
      { equipe_id: equipeId, slot_index: 1, x: 10, y: 50, color: '#00f3ff', profile_id: null },
      { equipe_id: equipeId, slot_index: 2, x: 25, y: 18, color: '#00f3ff', profile_id: null },
      { equipe_id: equipeId, slot_index: 3, x: 25, y: 38, color: '#00f3ff', profile_id: null },
      { equipe_id: equipeId, slot_index: 4, x: 25, y: 62, color: '#00f3ff', profile_id: null },
      { equipe_id: equipeId, slot_index: 5, x: 25, y: 82, color: '#00f3ff', profile_id: null },
      { equipe_id: equipeId, slot_index: 6, x: 48, y: 25, color: '#00f3ff', profile_id: null },
      { equipe_id: equipeId, slot_index: 7, x: 45, y: 50, color: '#00f3ff', profile_id: null },
      { equipe_id: equipeId, slot_index: 8, x: 48, y: 75, color: '#00f3ff', profile_id: null },
      { equipe_id: equipeId, slot_index: 9, x: 75, y: 20, color: '#ff0055', profile_id: null },
      { equipe_id: equipeId, slot_index: 10, x: 78, y: 50, color: '#ff0055', profile_id: null },
      { equipe_id: equipeId, slot_index: 11, x: 75, y: 80, color: '#ff0055', profile_id: null },
    ]
    return defs
  }, [equipeId])

  const refreshPlayers = async () => {
    setPlayersError(null)
    if (!supabase || !equipeId) {
      setPlayers([])
      return
    }

    setPlayersBusy(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nom, role, equipe_id')
        .eq('equipe_id', equipeId)
        .eq('role', 'joueur')
        .order('nom', { ascending: true })
        .limit(200)

      if (error) throw error
      setPlayers(((data as Array<{ id: string; nom: string }>) ?? []).map((row) => ({ id: row.id, nom: row.nom })))
    } catch (caught) {
      setPlayers([])
      setPlayersError(formatSupabaseError(caught))
    } finally {
      setPlayersBusy(false)
    }
  }

  const ensureSlotsInitialized = async (existing: TacticalSlotRow[]) => {
    if (!supabase || !canEdit || !equipeId || existing.length > 0) return

    const payload = defaultSlots.map((row) => ({
      equipe_id: row.equipe_id,
      slot_index: row.slot_index,
      x: row.x,
      y: row.y,
      color: row.color,
      profile_id: null,
    }))

    const { error } = await supabase
      .from('tactical_slots')
      .upsert(payload, { onConflict: 'equipe_id,slot_index' })
    if (error) {
      throw error
    }
  }

  const refreshSlots = async () => {
    setSlotsError(null)
    if (!supabase || !equipeId) {
      setSlots([])
      return
    }

    setSlotsBusy(true)
    try {
      const { data, error } = await supabase
        .from('tactical_slots')
        .select('id, equipe_id, slot_index, x, y, color, profile_id, profiles ( nom )')
        .eq('equipe_id', equipeId)
        .order('slot_index', { ascending: true })
        .limit(40)

      if (error) throw error
      const rows = (data as TacticalSlotRow[]) ?? []
      
      if (rows.length === 0 && canEdit) {
        await ensureSlotsInitialized(rows)
        // Refetch after initialization
        const { data: refetched, error: error2 } = await supabase
          .from('tactical_slots')
          .select('id, equipe_id, slot_index, x, y, color, profile_id, profiles ( nom )')
          .eq('equipe_id', equipeId)
          .order('slot_index', { ascending: true })
        if (error2) throw error2
        setSlots((refetched as TacticalSlotRow[] ?? []).map(r => ({ ...r, x: Number(r.x), y: Number(r.y) })))
      } else {
        setSlots(rows.map((row) => ({
          ...row,
          x: Number(row.x),
          y: Number(row.y),
          color: row.color || '#00f3ff',
        })))
      }
    } catch (caught) {
      setSlots([])
      setSlotsError(formatSupabaseError(caught))
    } finally {
      setSlotsBusy(false)
    }
  }

  // Load team strategy fields
  const refreshTeamStrategyState = async () => {
    if (!supabase || !equipeId) return
    const { data, error } = await supabase
      .from('equipes')
      .select('strategy_shared, strategy_zoom')
      .eq('id', equipeId)
      .maybeSingle()
    if (!error && data) {
      setLocalShared(data.strategy_shared ?? false)
      setLocalZoom((data.strategy_zoom as 'full' | 'half' | 'quarter-top' | 'quarter-bottom') ?? 'full')
    }
  }

  const persistSlot = async (slotIndex: number, patch: Partial<Pick<TacticalSlotRow, 'x' | 'y' | 'profile_id' | 'color'>>) => {
    if (!supabase || !canEdit) return
    const row = slots.find((s) => s.slot_index === slotIndex)
    if (!row) return

    const { error } = await supabase
      .from('tactical_slots')
      .update({
        ...('x' in patch ? { x: patch.x } : {}),
        ...('y' in patch ? { y: patch.y } : {}),
        ...('profile_id' in patch ? { profile_id: patch.profile_id } : {}),
        ...('color' in patch ? { color: patch.color } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    if (error) {
      setSlotsError(formatSupabaseError(error))
    }
  }

  const handleAddPoint = async (color: string) => {
    if (!supabase || !canEdit || !equipeId) return
    
    // Find next available slot_index
    const nextIndex = slots.length > 0 ? Math.max(...slots.map(s => s.slot_index)) + 1 : 1

    try {
      const { data, error } = await supabase
        .from('tactical_slots')
        .insert({
          equipe_id: equipeId,
          slot_index: nextIndex,
          x: 50,
          y: 50,
          color: color,
          profile_id: null
        })
        .select('id, equipe_id, slot_index, x, y, color, profile_id, profiles ( nom )')
        .single()

      if (error) throw error
      if (data) {
        setSlots(prev => [...prev, { ...data, x: Number(data.x), y: Number(data.y) }].sort((a,b) => a.slot_index - b.slot_index))
        setSelectedSlotIndex(data.slot_index)
      }
    } catch (caught) {
      setSlotsError(formatSupabaseError(caught))
    }
  }

  const handleRemovePoint = async (slotIndex: number) => {
    if (!supabase || !canEdit || !equipeId) return
    const row = slots.find(s => s.slot_index === slotIndex)
    if (!row) return

    try {
      const { error } = await supabase
        .from('tactical_slots')
        .delete()
        .eq('id', row.id)

      if (error) throw error
      setSlots(prev => prev.filter(s => s.slot_index !== slotIndex))
      if (selectedSlotIndex === slotIndex) setSelectedSlotIndex(null)
    } catch (caught) {
      setSlotsError(formatSupabaseError(caught))
    }
  }

  const handleResetBoard = async () => {
    if (!supabase || !canEdit || !equipeId) return
    if (!window.confirm("Réinitialiser le tableau tactique ? Tous les points actuels seront supprimés.")) return

    try {
      setSlotsBusy(true)
      // Delete all current slots
      const { error: deleteError } = await supabase
        .from('tactical_slots')
        .delete()
        .eq('equipe_id', equipeId)

      if (deleteError) throw deleteError

      // Initialize default
      await ensureSlotsInitialized([])
      setSelectedSlotIndex(null)
      await refreshSlots()
    } catch (caught) {
      setSlotsError(formatSupabaseError(caught))
    } finally {
      setSlotsBusy(false)
    }
  }

  const handleToggleShare = async (sharedVal: boolean) => {
    if (!supabase || !canEdit || !equipeId) return
    setLocalShared(sharedVal)
    try {
      const { error } = await supabase
        .from('equipes')
        .update({ strategy_shared: sharedVal })
        .eq('id', equipeId)
      if (error) throw error
    } catch (caught) {
      console.error(caught)
    }
  }

  const handleZoomChange = async (zoomVal: 'full' | 'half' | 'quarter-top' | 'quarter-bottom') => {
    setLocalZoom(zoomVal)
    if (!supabase || !canEdit || !equipeId) return
    try {
      const { error } = await supabase
        .from('equipes')
        .update({ strategy_zoom: zoomVal })
        .eq('id', equipeId)
      if (error) throw error
    } catch (caught) {
      console.error(caught)
    }
  }

  useEffect(() => {
    void refreshPlayers()
    void refreshSlots()
    void refreshTeamStrategyState()
  }, [equipeId])

  useEffect(() => {
    if (!supabase || !equipeId) return

    const channel = supabase
      .channel(`team-strategy:${equipeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tactical_slots', filter: `equipe_id=eq.${equipeId}` },
        () => void refreshSlots(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'equipes', filter: `id=eq.${equipeId}` },
        (payload) => {
          const updated = payload.new as EquipeRow
          if (updated) {
            setLocalShared(updated.strategy_shared ?? false)
            setLocalZoom((updated.strategy_zoom as 'full' | 'half' | 'quarter-top' | 'quarter-bottom') ?? 'full')
          }
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      if (supabase) void supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [equipeId])

  const onPointerDownSlot = (event: PointerEvent<HTMLButtonElement>, slotIndex: number) => {
    if (!canEdit) return
    draggingRef.current = { slotIndex, pointerId: event.pointerId }
    setSelectedSlotIndex(slotIndex)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMovePitch = (event: PointerEvent<HTMLDivElement>) => {
    const dragging = draggingRef.current
    if (!dragging) return
    if (!pitchRef.current) return

    const rect = pitchRef.current.getBoundingClientRect()
    const rawX = ((event.clientX - rect.left) / rect.width) * 100
    const rawY = ((event.clientY - rect.top) / rect.height) * 100
    
    // Clamp inside pitch safely
    const x = Math.max(3, Math.min(97, rawX))
    const y = Math.max(3, Math.min(97, rawY))

    setSlots((current) =>
      current.map((s) => (s.slot_index === dragging.slotIndex ? { ...s, x, y } : s)),
    )
  }

  const onPointerUpPitch = async () => {
    const dragging = draggingRef.current
    if (!dragging) return
    draggingRef.current = null
    const row = slots.find((s) => s.slot_index === dragging.slotIndex)
    if (!row) return
    await persistSlot(dragging.slotIndex, { x: row.x, y: row.y })
  }

  const selected = selectedSlotIndex ? slots.find((s) => s.slot_index === selectedSlotIndex) ?? null : null

  return (
    <section className={`page strategy-page ${isFullscreen ? 'in-fullscreen' : ''}`}>
      {!isFullscreen && (
        <header className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2>Stratégie Tactique</h2>
            <p>{equipe ? `${equipe.categorie} - ${equipe.nom}` : club ? club.nom : 'Tableau Tactique'}</p>
          </div>
          {canEdit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(0,16,36,0.45)', padding: '0.5rem 1rem', borderRadius: '1rem', border: '1px solid rgba(0, 243, 255, 0.15)' }}>
              <span className="muted" style={{ fontSize: '0.85rem', fontWeight: 700 }}>Partager la tactique :</span>
              <label className="premium-switch">
                <input
                  type="checkbox"
                  checked={localShared}
                  onChange={(e) => void handleToggleShare(e.target.checked)}
                />
                <span className="premium-slider" />
              </label>
            </div>
          )}
        </header>
      )}

      {/* Top bar visible ONLY in fullscreen mode */}
      {isFullscreen && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(0,16,36,0.85)', border: '1px solid rgba(0, 243, 255, 0.25)', borderRadius: '12px', marginBottom: '1rem', width: '100%' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--neon-cyan)' }}>Stratégie Tactique (Plein Écran)</h2>
            <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>{equipe ? `${equipe.categorie} - ${equipe.nom}` : club ? club.nom : 'Tableau Tactique'}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {canEdit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Partager :</span>
                <label className="premium-switch">
                  <input
                    type="checkbox"
                    checked={localShared}
                    onChange={(e) => void handleToggleShare(e.target.checked)}
                  />
                  <span className="premium-slider" />
                </label>
              </div>
            )}
            <button
              type="button"
              className="primary-button"
              onClick={() => setIsFullscreen(false)}
              style={{
                fontSize: '0.75rem',
                padding: '0.5rem 1rem',
                margin: 0,
                background: 'linear-gradient(110deg, #ff0055, #990022)',
                border: '1px solid rgba(255, 0, 85, 0.4)',
                boxShadow: '0 0 10px rgba(255, 0, 85, 0.2)',
                color: '#fff',
                borderRadius: '8px',
              }}
            >
              Quitter Plein Écran
            </button>
          </div>
        </div>
      )}

      <div className={`tests-chat-grid strategy-layout-wrapper ${isFullscreen ? 'is-fullscreen' : ''}`} style={{ gridTemplateColumns: isFullscreen ? (canEdit ? '1.8fr 0.8fr' : '1fr') : (canEdit ? '1.55fr 1fr' : '1fr') }}>
        
        {/* Left Side: Pitch Viewport */}
        <article className="panel tactical-board" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          
          {/* Header of tactical board with fullscreen button */}
          {/* Header of tactical board with fullscreen toggle button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 1rem', borderBottom: '1px solid rgba(0, 243, 255, 0.1)', background: 'rgba(0, 16, 36, 0.25)' }}>
            <span className="muted" style={{ fontWeight: 700, fontSize: '0.8rem' }}>
              {isFullscreen ? "Tableau de stratégie (Plein Écran)" : "Tableau de stratégie"}
            </span>
            <button
              type="button"
              className="skill-tab"
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.78rem',
                margin: 0,
                background: isFullscreen ? 'rgba(255, 0, 85, 0.12)' : '',
                borderColor: isFullscreen ? '#ff0055' : '',
                color: isFullscreen ? '#ff3366' : ''
              }}
            >
              {isFullscreen ? "Quitter Plein Écran" : "Plein Écran"}
            </button>
          </div>

          <div className="pitch-viewport" style={{ flex: 1 }}>
            
            {/* If strategy is locked for normal player/parent */}
            {!canEdit && !localShared && (
              <div className="strategy-locked">
                <div className="strategy-locked-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h3>Plan de jeu verrouillé</h3>
                <p>Le coach n'a pas encore partagé son plan tactique. Revenez plus tard ou attendez le signal !</p>
              </div>
            )}

            <div
              ref={pitchRef}
              className={`pitch-area zoom-${localZoom}`}
              onPointerMove={onPointerMovePitch}
              onPointerUp={() => void onPointerUpPitch()}
            >
              {/* Detailed high-fidelity pitch markings */}
              <div className="pitch-lines">
                <div className="line-center" />
                <div className="circle-center" />
                <div className="spot-center" />
                
                {/* Left side markings */}
                <div className="penalty-box left" />
                <div className="goal-box left" />
                <div className="penalty-spot left" />
                <div className="penalty-arc left" />
                
                {/* Right side markings */}
                <div className="penalty-box right" />
                <div className="goal-box right" />
                <div className="penalty-spot right" />
                <div className="penalty-arc right" />
                
                {/* Corner arcs */}
                <div className="corner-arc top-left" />
                <div className="corner-arc bottom-left" />
                <div className="corner-arc top-right" />
                <div className="corner-arc bottom-right" />
                
                {/* Goals */}
                <div className="goal-post left" />
                <div className="goal-post right" />
              </div>

              {slots.map((slot) => {
                const isSelected = selectedSlotIndex === slot.slot_index
                const label = slot.profiles?.nom ?? ''
                const color = slot.color || '#00f3ff'
                
                return (
                  <button
                    key={slot.id}
                    type="button"
                    className="player-dot"
                    onPointerDown={(event) => onPointerDownSlot(event, slot.slot_index)}
                    onClick={() => setSelectedSlotIndex(slot.slot_index)}
                    aria-label={`Slot ${slot.slot_index}`}
                    disabled={!canEdit && !label}
                    style={{
                      position: 'absolute',
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.25)',
                      background: color,
                      boxShadow: `0 0 12px ${color}${isSelected ? ', 0 0 20px #ffffff' : ''}`,
                      color: '#001024',
                      cursor: canEdit ? 'grab' : 'default',
                      touchAction: 'none',
                      display: 'grid',
                      placeItems: 'center',
                      zIndex: isSelected ? 3 : 2,
                      transition: 'border-color 0.15s, box-shadow 0.15s, background-color 0.15s',
                    }}
                  >
                    <strong style={{ fontSize: '0.8rem', color: '#001024' }}>{slot.slot_index}</strong>
                    {label && (
                      <span
                        className="chip"
                        style={{
                          position: 'absolute',
                          top: '32px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          maxWidth: '9rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          background: 'rgba(0,16,36,0.85)',
                          border: `1px solid ${color}`,
                          color: '#ffffff',
                          fontSize: '0.72rem',
                          padding: '0.1rem 0.45rem',
                          boxShadow: `0 2px 6px rgba(0,0,0,0.5)`,
                        }}
                      >
                        {label}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {slotsError && <p className="form-feedback error" style={{ margin: '0.75rem 1rem' }}>{slotsError}</p>}

          {/* Quick info bar under the pitch */}
          <div style={{ padding: '0.8rem 1rem', borderTop: '1px solid rgba(0,243,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,16,36,0.15)' }}>
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              Nombre de joueurs placés : <strong>{slots.length}</strong>
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="skill-tab"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                onClick={() => {
                  void refreshPlayers()
                  void refreshSlots()
                  void refreshTeamStrategyState()
                }}
                disabled={playersBusy || slotsBusy}
              >
                Recharger
              </button>
              {canEdit && (
                <button
                  type="button"
                  className="skill-tab"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderColor: 'rgba(255, 77, 126, 0.45)', color: '#ffd6e0' }}
                  onClick={handleResetBoard}
                  disabled={slotsBusy}
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>
        </article>

        {/* Right Side: Coach Controls */}
        {canEdit && (
          <div className="strategy-controls-panel">
            
            {/* Terrain Zoom Card */}
            <article className="panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 0.85rem' }}>Zoom & Zone Tactique</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <button
                  type="button"
                  className={`skill-tab ${localZoom === 'full' ? 'active' : ''}`}
                  onClick={() => void handleZoomChange('full')}
                  style={{ fontSize: '0.78rem', padding: '0.65rem 0.4rem', textAlign: 'center' }}
                >
                  Terrain Entier
                </button>
                <button
                  type="button"
                  className={`skill-tab ${localZoom === 'half' ? 'active' : ''}`}
                  onClick={() => void handleZoomChange('half')}
                  style={{ fontSize: '0.78rem', padding: '0.65rem 0.4rem', textAlign: 'center' }}
                >
                  Demi-Terrain
                </button>
                <button
                  type="button"
                  className={`skill-tab ${localZoom === 'quarter-top' ? 'active' : ''}`}
                  onClick={() => void handleZoomChange('quarter-top')}
                  style={{ fontSize: '0.78rem', padding: '0.65rem 0.4rem', textAlign: 'center' }}
                >
                  Quart (Corner Haut & But)
                </button>
                <button
                  type="button"
                  className={`skill-tab ${localZoom === 'quarter-bottom' ? 'active' : ''}`}
                  onClick={() => void handleZoomChange('quarter-bottom')}
                  style={{ fontSize: '0.78rem', padding: '0.65rem 0.4rem', textAlign: 'center' }}
                >
                  Quart (Corner Bas & But)
                </button>
              </div>
            </article>

            {/* Quick Adding Card */}
            <article className="panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 0.85rem' }}>Ajouter des points</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void handleAddPoint('#00f3ff')}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.65rem 0.5rem',
                    background: 'linear-gradient(110deg, #00f3ff, #0055ff)',
                    boxShadow: '0 0 10px rgba(0, 243, 255, 0.25)',
                    color: '#fff',
                    border: '1px solid rgba(0,243,255,0.4)',
                  }}
                >
                  + Joueur Bleu (A)
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void handleAddPoint('#ff0055')}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.65rem 0.5rem',
                    background: 'linear-gradient(110deg, #ff0055, #990022)',
                    boxShadow: '0 0 10px rgba(255, 0, 85, 0.25)',
                    color: '#fff',
                    border: '1px solid rgba(255,0,85,0.4)',
                  }}
                >
                  + Joueur Rose (B)
                </button>
              </div>
            </article>

            {/* Selected Dot Configuration Card */}
            <article className="panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 0.85rem' }}>Édition du Point</h3>
              {selected ? (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  
                  {/* Color chooser */}
                  <div>
                    <span className="muted" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                      Couleur du point {selected.slot_index} :
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="color-presets">
                        {colorPresets.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            className={`color-preset-chip ${selected.color === preset ? 'active' : ''}`}
                            style={{ backgroundColor: preset, color: preset }}
                            onClick={() => {
                              const updatedSlots = slots.map(s => s.slot_index === selected.slot_index ? { ...s, color: preset } : s)
                              setSlots(updatedSlots)
                              void persistSlot(selected.slot_index, { color: preset })
                            }}
                          />
                        ))}
                      </div>
                      <input
                        type="color"
                        value={selected.color || '#00f3ff'}
                        onChange={(e) => {
                          const updatedSlots = slots.map(s => s.slot_index === selected.slot_index ? { ...s, color: e.target.value } : s)
                          setSlots(updatedSlots)
                          void persistSlot(selected.slot_index, { color: e.target.value })
                        }}
                        style={{
                          width: '32px',
                          height: '32px',
                          padding: 0,
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '6px',
                          background: 'none',
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                  </div>

                  {/* Player assignment */}
                  <label style={{ fontSize: '0.85rem' }}>
                    Assigner un Joueur :
                    <select
                      value={selected.profile_id ?? ''}
                      onChange={(event) => {
                        const nextProfileId = event.target.value || null
                        setSlots((current) =>
                          current.map((s) =>
                            s.slot_index === selected.slot_index
                              ? {
                                  ...s,
                                  profile_id: nextProfileId,
                                  profiles: nextProfileId
                                    ? { nom: players.find((p) => p.id === nextProfileId)?.nom ?? 'Joueur' }
                                    : null,
                                }
                              : s,
                          ),
                        )
                        void persistSlot(selected.slot_index, { profile_id: nextProfileId })
                      }}
                      style={{ marginTop: '0.35rem' }}
                    >
                      <option value="">(Aucun)</option>
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nom}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Remove button */}
                  <button
                    type="button"
                    className="skill-tab"
                    style={{
                      marginTop: '0.5rem',
                      borderColor: 'rgba(255, 77, 126, 0.45)',
                      color: '#ffd6e0',
                      padding: '0.65rem',
                      textAlign: 'center',
                    }}
                    onClick={() => void handleRemovePoint(selected.slot_index)}
                  >
                    Retirer ce point (- {selected.slot_index})
                  </button>

                </div>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                  Sélectionne un joueur ou un point sur le terrain pour modifier ses options (couleur, nom, suppression).
                </p>
              )}
            </article>

          </div>
        )}
      </div>
    </section>
  )
}

function EventsPage({
  equipe,
  userId,
  club,
  role,
  parentChildren,
  activeChildId,
}: {
  equipe: EquipeRow | null
  userId: string | null
  club: ClubRow | null
  role: Role | null
  parentChildren: Array<{ id: string; nom: string; equipe_id: string | null; team_name: string; team_category: string; is_approved: boolean }>
  activeChildId: string
}) {
  const [events, setEvents] = useState<EvenementRow[] | null>(null)

  const canManageEvents = role === 'coach' || role === 'admin' || role === 'super_admin'

  const [players, setPlayers] = useState<Array<{ id: string; nom: string }>>([])

  const [showAdd, setShowAdd] = useState(false)
  const [addType, setAddType] = useState<'entrainement' | 'match'>('entrainement')
  const [addLocationType, setAddLocationType] = useState<'domicile' | 'exterieur'>('exterieur')
  const [addWhen, setAddWhen] = useState(() => {
    const now = new Date()
    const pad = (value: number) => String(value).padStart(2, '0')
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`
  })
  const [addLieu, setAddLieu] = useState('')
  const [addInfos, setAddInfos] = useState('')
  const [addConvoked, setAddConvoked] = useState<Record<string, boolean>>({})
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addInfo, setAddInfo] = useState<string | null>(null)

  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<EvenementRow | null>(null)
  const [convocationsByEvent, setConvocationsByEvent] = useState<Record<string, EventConvocationRow[]>>({})
  const [presencesByEvent, setPresencesByEvent] = useState<Record<string, PresenceRow[]>>({})
  const [vehiclesByEvent, setVehiclesByEvent] = useState<Record<string, EventVehicleRow[]>>({})
  const [assignmentsByEvent, setAssignmentsByEvent] = useState<Record<string, EventVehicleAssignmentRow[]>>({})

  const [vehicleSeatsDraft, setVehicleSeatsDraft] = useState<Record<string, string>>({})
  const [vehicleDriverGenderDraft, setVehicleDriverGenderDraft] = useState<Record<string, 'pere' | 'mere' | 'autre' | ''>>({})
  const [vehicleHasChildDraft, setVehicleHasChildDraft] = useState<Record<string, boolean>>({})
  const [vehiclePassengerPrefDraft, setVehiclePassengerPrefDraft] = useState<Record<string, 'all' | 'women_and_children' | 'men_and_children'>>({})
  const [independentVehicleLabel, setIndependentVehicleLabel] = useState<Record<string, string>>({})
  const [independentVehicleSeats, setIndependentVehicleSeats] = useState<Record<string, string>>({})
  const [assignPickPlayer, setAssignPickPlayer] = useState<Record<string, string>>({})
  const [assignPickVehicle, setAssignPickVehicle] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!supabase) {
      setEvents(null)
      return
    }

    if (!userId || !club?.id) {
      setEvents([])
      return
    }

    let ignore = false

    void (async () => {
      let query = supabase
        .from('evenements')
        .select('id, club_id, equipe_id, type, date, lieu, infos')
        .eq('club_id', club.id)
        .order('date', { ascending: true })
        .limit(20)

      if ((role === 'coach' || role === 'joueur') && equipe?.id) {
        query = query.eq('equipe_id', equipe.id)
      } else if (role === 'parent') {
        const activeChild = parentChildren.find(c => c.id === activeChildId)
        if (activeChild?.equipe_id) {
          query = query.eq('equipe_id', activeChild.equipe_id)
        } else {
          setEvents([])
          return
        }
      }

      const { data, error } = await query

      if (ignore) return
      if (error) {
        setEvents([])
        return
      }

      setEvents((data as EvenementRow[]) ?? [])
    })()

    return () => {
      ignore = true
    }
  }, [club?.id, equipe?.id, role, userId, activeChildId, parentChildren])

  const refreshPlayers = async () => {
    if (!supabase) {
      setPlayers([])
      return
    }

    if (!canManageEvents) {
      setPlayers([])
      return
    }

    if (!userId) {
      setPlayers([])
      return
    }

    let query = supabase
      .from('profiles')
      .select('id, nom, role, club_id, equipe_id')
      .eq('role', 'joueur')
      .order('nom', { ascending: true })

    if (equipe?.id) {
      query = query.eq('equipe_id', equipe.id)
    } else if (club?.id) {
      query = query.eq('club_id', club.id)
    }

    const { data, error } = await query
    if (error) {
      setPlayers([])
      return
    }

    setPlayers(((data as Array<{ id: string; nom: string }>) ?? []).map((row) => ({ id: row.id, nom: row.nom })))
  }


  useEffect(() => {
    void refreshPlayers()
  }, [canManageEvents, club?.id, equipe?.id, role, userId])

  const refreshEventDetails = async (eventIds: string[]) => {
    if (!supabase) return
    if (eventIds.length === 0) return

    setDetailsError(null)

    const [convocationsResult, presencesResult, vehiclesResult, assignmentsResult] = await Promise.all([
      supabase
        .from('event_convocations')
        .select('evenement_id, profile_id, created_at, profiles ( nom )')
        .in('evenement_id', eventIds),
      supabase
        .from('presences')
        .select('evenement_id, profile_id, statut, created_at, profiles ( nom )')
        .in('evenement_id', eventIds),
      supabase
        .from('event_vehicles')
        .select('id, evenement_id, owner_profile_id, label, seats_total, driver_gender, has_child_present, passenger_preference, profiles:profiles!event_vehicles_owner_profile_id_fkey ( nom )')
        .in('evenement_id', eventIds),
      supabase
        .from('event_vehicle_assignments')
        .select('evenement_id, vehicle_id, profile_id, status, profiles ( nom )')
        .in('evenement_id', eventIds),
    ])

    if (convocationsResult.error || presencesResult.error || vehiclesResult.error || assignmentsResult.error) {
      setDetailsError(
        formatSupabaseError(
          convocationsResult.error || presencesResult.error || vehiclesResult.error || assignmentsResult.error,
        ),
      )
    }

    const convocations = (convocationsResult.data as EventConvocationRow[] | null) ?? []
    const presences = (presencesResult.data as PresenceRow[] | null) ?? []
    const vehicles = (vehiclesResult.data as EventVehicleRow[] | null) ?? []
    const assignments = (assignmentsResult.data as EventVehicleAssignmentRow[] | null) ?? []

    const nextConvocationsByEvent: Record<string, EventConvocationRow[]> = {}
    const nextPresencesByEvent: Record<string, PresenceRow[]> = {}
    const nextVehiclesByEvent: Record<string, EventVehicleRow[]> = {}
    const nextAssignmentsByEvent: Record<string, EventVehicleAssignmentRow[]> = {}

    for (const id of eventIds) {
      nextConvocationsByEvent[id] = []
      nextPresencesByEvent[id] = []
      nextVehiclesByEvent[id] = []
      nextAssignmentsByEvent[id] = []
    }

    for (const row of convocations) {
      ; (nextConvocationsByEvent[row.evenement_id] ||= []).push(row)
    }
    for (const row of presences) {
      ; (nextPresencesByEvent[row.evenement_id] ||= []).push(row)
    }
    for (const row of vehicles) {
      ; (nextVehiclesByEvent[row.evenement_id] ||= []).push(row)
    }
    for (const row of assignments) {
      ; (nextAssignmentsByEvent[row.evenement_id] ||= []).push(row)
    }

    setConvocationsByEvent((current) => ({ ...current, ...nextConvocationsByEvent }))
    setPresencesByEvent((current) => ({ ...current, ...nextPresencesByEvent }))
    setVehiclesByEvent((current) => ({ ...current, ...nextVehiclesByEvent }))
    setAssignmentsByEvent((current) => ({ ...current, ...nextAssignmentsByEvent }))
  }

  useEffect(() => {
    const ids = (events ?? []).map((ev) => ev.id)
    void refreshEventDetails(ids)
  }, [(events ?? []).map((ev) => ev.id).join('|')])

  const refreshEvents = async () => {
    if (!supabase) {
      setEvents(null)
      return
    }
    if (!userId || !club?.id) {
      setEvents([])
      return
    }

    let query = supabase
      .from('evenements')
      .select('id, club_id, equipe_id, type, date, lieu, infos')
      .eq('club_id', club.id)
      .order('date', { ascending: true })
      .limit(20)

    if ((role === 'coach' || role === 'joueur') && equipe?.id) {
      query = query.eq('equipe_id', equipe.id)
    } else if (role === 'parent') {
      const activeChild = parentChildren.find(c => c.id === activeChildId)
      if (activeChild?.equipe_id) {
        query = query.eq('equipe_id', activeChild.equipe_id)
      } else {
        setEvents([])
        return
      }
    }

    const { data, error } = await query
    if (error) {
      setEvents([])
      return
    }
    setEvents((data as EvenementRow[]) ?? [])
  }

  const deleteEvent = async (event: EvenementRow) => {
    if (!supabase) return
    if (!canManageEvents) return
    setConfirmDeleteEvent(event)
  }

  const executeDeleteEvent = async () => {
    if (!supabase || !confirmDeleteEvent) return
    setDetailsError(null)

    const { error } = await supabase.from('evenements').delete().eq('id', confirmDeleteEvent.id)
    if (error) {
      setDetailsError(formatSupabaseError(error))
      setConfirmDeleteEvent(null)
      return
    }

    setConfirmDeleteEvent(null)
    await refreshEvents()
  }

  const createEvent = async () => {
    setAddError(null)
    setAddInfo(null)

    if (!supabase) {
      setAddError("Supabase n'est pas configure")
      return
    }
    if (!canManageEvents) {
      setAddError('Acces reserve coach/admin')
      return
    }
    if (!userId) {
      setAddError('Utilisateur non connecte')
      return
    }
    if (!club?.id) {
      setAddError('Club non defini')
      return
    }
    if (!equipe?.id) {
      setAddError('Equipe non definie')
      return
    }

    const rawLieu = addLieu.trim()
    if (!rawLieu) {
      setAddError('Lieu requis')
      return
    }

    let lieu = rawLieu
    if (addType === 'match') {
      lieu = addLocationType === 'domicile' ? `[Domicile] ${rawLieu}` : `[Extérieur] ${rawLieu}`
    }

    const when = new Date(addWhen)
    if (Number.isNaN(when.getTime())) {
      setAddError('Date/heure invalide')
      return
    }

    const infos = addInfos.trim()

    const convokedIds = Object.entries(addConvoked)
      .filter(([, checked]) => checked)
      .map(([id]) => id)

    if (addType === 'match' && convokedIds.length === 0) {
      setAddError('Pour un match, choisis au moins 1 joueur convoque')
      return
    }

    setAddBusy(true)
    try {
      const { data: inserted, error: insertError } = await supabase
        .from('evenements')
        .insert({
          club_id: club.id,
          equipe_id: equipe.id,
          type: addType,
          date: when.toISOString(),
          lieu,
          infos: infos || null,
        })
        .select('id')
        .single()

      if (insertError) {
        throw insertError
      }

      const eventId = (inserted as { id: string } | null)?.id
      if (!eventId) {
        throw new Error('Evenement non cree (id manquant)')
      }

      if (addType === 'match') {
        const payload = convokedIds.map((profile_id) => ({ evenement_id: eventId, profile_id }))
        const { error: convocError } = await supabase.from('event_convocations').insert(payload)
        if (convocError) {
          throw convocError
        }
      }

      setAddInfo('Evenement ajoute')
      setShowAdd(false)
      setAddLieu('')
      setAddInfos('')
      setAddLocationType('exterieur')
      setAddConvoked({})
      await refreshEvents()
    } catch (caught) {
      setAddError(formatSupabaseError(caught))
    } finally {
      setAddBusy(false)
    }
  }

  const setPresence = async (event: EvenementRow, statut: 'present' | 'absent', childId?: string) => {
    if (!supabase) return
    if (!userId) return
    if (role !== 'joueur' && role !== 'parent') return
    
    const targetProfileId = role === 'parent' && childId ? childId : userId

    const payload = {
      evenement_id: event.id,
      profile_id: targetProfileId,
      statut,
    }

    const { error } = await supabase.from('presences').upsert(payload)
    if (error) {
      setDetailsError(formatSupabaseError(error))
      return
    }

    if (statut === 'absent') {
      const { error: delVehicleError } = await supabase
        .from('event_vehicles')
        .delete()
        .eq('evenement_id', event.id)
        .eq('owner_profile_id', targetProfileId)
      if (delVehicleError) {
        setDetailsError(formatSupabaseError(delVehicleError))
      }
    }

    await refreshEventDetails([event.id])
  }

  const setVehicleOffer = async (event: EvenementRow, childId?: string) => {
    if (!supabase) return
    if (!userId) return
    if (role !== 'joueur' && role !== 'parent') return
    
    const targetProfileId = role === 'parent' && childId ? childId : userId
    const draftKey = role === 'parent' && childId ? `${event.id}_${childId}` : event.id

    const raw = vehicleSeatsDraft[draftKey] ?? ''
    const seats = Number(raw)
    if (!Number.isFinite(seats) || seats < 0) {
      setDetailsError('Nombre de places invalide')
      return
    }

    const { error: presenceError } = await supabase.from('presences').upsert({
      evenement_id: event.id,
      profile_id: targetProfileId,
      statut: 'present',
    })
    if (presenceError) {
      setDetailsError(formatSupabaseError(presenceError))
      return
    }

    const driver_gender = role === 'parent' ? (vehicleDriverGenderDraft[draftKey] || null) : null
    const has_child_present = role === 'parent' ? (vehicleHasChildDraft[draftKey] ?? true) : null
    const passenger_preference = role === 'parent' ? (vehiclePassengerPrefDraft[draftKey] || 'all') : null

    const { error } = await supabase
      .from('event_vehicles')
      .upsert(
        {
          evenement_id: event.id,
          owner_profile_id: targetProfileId,
          label: null,
          seats_total: seats,
          driver_gender,
          has_child_present,
          passenger_preference,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'evenement_id,owner_profile_id' },
      )

    if (error) {
      setDetailsError(formatSupabaseError(error))
      return
    }

    await refreshEventDetails([event.id])
  }

  const addVehicleIndependent = async (eventId: string) => {
    if (!supabase) return
    if (!canManageEvents) return
    const label = (independentVehicleLabel[eventId] ?? '').trim()
    const seatsRaw = (independentVehicleSeats[eventId] ?? '').trim()
    const seats = Number(seatsRaw)
    if (!label) {
      setDetailsError('Nom/label du vehicule requis')
      return
    }
    if (!Number.isFinite(seats) || seats < 0) {
      setDetailsError('Nombre de places invalide')
      return
    }

    const { error } = await supabase.from('event_vehicles').insert({
      evenement_id: eventId,
      owner_profile_id: null,
      label,
      seats_total: seats,
    })
    if (error) {
      setDetailsError(formatSupabaseError(error))
      return
    }

    setIndependentVehicleLabel((c) => ({ ...c, [eventId]: '' }))
    setIndependentVehicleSeats((c) => ({ ...c, [eventId]: '' }))
    await refreshEventDetails([eventId])
  }

  const assignPlayer = async (eventId: string) => {
    if (!supabase) return
    if (!canManageEvents) return
    const profileId = assignPickPlayer[eventId]
    const vehicleId = assignPickVehicle[eventId]
    if (!profileId) {
      setDetailsError('Choisis un joueur')
      return
    }
    if (!vehicleId) {
      setDetailsError('Choisis un vehicule')
      return
    }

    const { error } = await supabase.from('event_vehicle_assignments').insert({
      evenement_id: eventId,
      vehicle_id: vehicleId,
      profile_id: profileId,
    })

    if (error) {
      setDetailsError(formatSupabaseError(error))
      return
    }

    setAssignPickPlayer((c) => ({ ...c, [eventId]: '' }))
    await refreshEventDetails([eventId])
  }

  const unassignPlayer = async (eventId: string, profileId: string) => {
    if (!supabase) return
    if (!canManageEvents) return

    const { error } = await supabase
      .from('event_vehicle_assignments')
      .delete()
      .eq('evenement_id', eventId)
      .eq('profile_id', profileId)
    if (error) {
      setDetailsError(formatSupabaseError(error))
      return
    }

    await refreshEventDetails([eventId])
  }

  const requestVehicleSeat = async (eventId: string, vehicleId: string, childId?: string) => {
    if (!supabase) return
    if (!userId) return
    if (role !== 'joueur' && role !== 'parent') return

    const targetProfileId = role === 'parent' && childId ? childId : userId

    const { error } = await supabase.from('event_vehicle_assignments').insert({
      evenement_id: eventId,
      vehicle_id: vehicleId,
      profile_id: targetProfileId,
      status: 'pending'
    })

    if (error) {
      setDetailsError(formatSupabaseError(error))
      return
    }

    await refreshEventDetails([eventId])
  }

  const approveVehicleAssignment = async (eventId: string, vehicleId: string, profileId: string) => {
    if (!supabase) return
    
    const { error } = await supabase
      .from('event_vehicle_assignments')
      .update({ status: 'approved' })
      .eq('evenement_id', eventId)
      .eq('vehicle_id', vehicleId)
      .eq('profile_id', profileId)

    if (error) {
      setDetailsError(formatSupabaseError(error))
      return
    }

    await refreshEventDetails([eventId])
  }

  const rejectVehicleAssignment = async (eventId: string, vehicleId: string, profileId: string) => {
    if (!supabase) return
    
    const { error } = await supabase
      .from('event_vehicle_assignments')
      .update({ status: 'rejected' })
      .eq('evenement_id', eventId)
      .eq('vehicle_id', vehicleId)
      .eq('profile_id', profileId)

    if (error) {
      setDetailsError(formatSupabaseError(error))
      return
    }

    await refreshEventDetails([eventId])
  }

  const displayEvents = useMemo(() => (events ?? []), [events])

  return (
    <section className="page events-page">
      <header className="page-title">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <h2>Calendrier des evenements</h2>
            <p>{equipe ? `${equipe.categorie} - ${equipe.nom}` : club ? club.nom : 'Club'}</p>
          </div>

          {supabase && canManageEvents && (
            <button type="button" className="primary-button" onClick={() => setShowAdd((v) => !v)}>
              {showAdd ? 'Fermer' : 'Ajouter un evenement'}
            </button>
          )}
        </div>
      </header>

      {supabase && canManageEvents && showAdd && (
        <article className="panel" style={{ marginBottom: '1rem', display: 'grid', gap: '0.75rem' }}>
          <strong>Nouvel evenement</strong>

          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label>
              Type
              <select value={addType} onChange={(e) => setAddType(e.target.value as 'entrainement' | 'match')} disabled={addBusy}>
                <option value="entrainement">Entrainement</option>
                <option value="match">Match (rendez-vous)</option>
              </select>
            </label>

            {addType === 'match' && (
              <label>
                Domicile / Extérieur
                <select value={addLocationType} onChange={(e) => setAddLocationType(e.target.value as 'domicile' | 'exterieur')} disabled={addBusy}>
                  <option value="exterieur">Extérieur</option>
                  <option value="domicile">Domicile</option>
                </select>
              </label>
            )}

            <label>
              Date / heure
              <input type="datetime-local" value={addWhen} onChange={(e) => setAddWhen(e.target.value)} disabled={addBusy} />
            </label>

            <label>
              Lieu
              <input value={addLieu} onChange={(e) => setAddLieu(e.target.value)} disabled={addBusy} placeholder="Stade / adresse" />
            </label>

            <label>
              Infos (optionnel)
              <input value={addInfos} onChange={(e) => setAddInfos(e.target.value)} disabled={addBusy} placeholder="Ex: RDV 13h15" />
            </label>
          </div>

          {addType === 'match' && (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <strong>Joueurs convoques</strong>
              {players.length === 0 ? (
                <p className="muted">Aucun joueur visible (verifie RLS + equipe/club).</p>
              ) : (
                <div style={{ display: 'grid', gap: '0.35rem', maxHeight: '12rem', overflow: 'auto', paddingRight: '0.25rem' }}>
                  {players.map((p) => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(addConvoked[p.id])}
                        onChange={(e) => setAddConvoked((c) => ({ ...c, [p.id]: e.target.checked }))}
                        disabled={addBusy}
                      />
                      <span>{p.nom}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {addError && <p className="form-feedback error">{addError}</p>}
          {addInfo && <p className="form-feedback info">{addInfo}</p>}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" className="primary-button" onClick={() => void createEvent()} disabled={addBusy}>
              {addBusy ? 'Ajout...' : 'Ajouter'}
            </button>
            <button type="button" className="link-button" onClick={() => void refreshEvents()} disabled={addBusy}>
              Recharger
            </button>
          </div>
        </article>
      )}

      {detailsError && <p className="form-feedback error">{detailsError}</p>}

      <div className="events-grid">
        {!supabase && (
          <article className="panel event-card">
            <div className="event-summary">
              <span className="event-day">--</span>
              <div className="event-summary__main">
                <div className="event-summary__top">
                  <h3>Supabase non configure</h3>
                  <time className="event-time">--:--</time>
                </div>
                <p className="event-place">Renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.</p>
              </div>
            </div>
          </article>
        )}

        {supabase && displayEvents.length === 0 && (
          <article className="panel event-card">
            <div className="event-summary">
              <span className="event-day">--</span>
              <div className="event-summary__main">
                <div className="event-summary__top">
                  <h3>Aucun evenement</h3>
                  <time className="event-time">--:--</time>
                </div>
                <p className="event-place">Ajoute des lignes dans la table evenements.</p>
              </div>
            </div>
          </article>
        )}

        {displayEvents.map((event) => {
          const date = new Date(event.date)
          const day = date.toLocaleDateString('fr-FR', { day: '2-digit' })
          const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          let title = event.type === 'match' ? 'Match' : 'Entrainement'
          const isDomicile = event.type === 'match' && (event.lieu.startsWith('[Domicile]') || event.lieu.toLowerCase() === 'domicile')

          if (event.type === 'match') {
            title = isDomicile ? 'Match (Domicile)' : 'Match (Extérieur)'
          }

          const displayLieu = event.lieu.replace(/^\[(Domicile|Extérieur)\]\s*/i, '')

          const convocations = convocationsByEvent[event.id] ?? []
          const isConvoked = event.type === 'entrainement' ? true : convocations.some((c) => c.profile_id === userId)

          const presences = presencesByEvent[event.id] ?? []
          const myPresence = presences.find((p) => p.profile_id === userId) ?? null

          const vehicles = vehiclesByEvent[event.id] ?? []
          const myVehicle = vehicles.find((v) => v.owner_profile_id === userId) ?? null
          const assignments = assignmentsByEvent[event.id] ?? []

          const assignedProfileIds = new Set(assignments.map((a) => a.profile_id))

          const presentProfileIds = new Set(
            presences.filter((p) => p.statut === 'present' || p.statut === 'retard').map((p) => p.profile_id),
          )

          const eligiblePlayers = players.filter((p) => presentProfileIds.has(p.id) && !assignedProfileIds.has(p.id))

          return (
            <article key={event.id} className="panel event-card">
              <div className="event-summary">
                <span className="event-day">{day}</span>
                <div className="event-summary__main">
                  <div className="event-summary__top">
                    <h3>{title}</h3>
                    {canManageEvents && (
                      <button type="button" className="link-button" onClick={() => void deleteEvent(event)}>
                        Supprimer
                      </button>
                    )}
                  </div>
                  <p className="event-place" style={{ fontWeight: 500, color: 'inherit' }}>
                    {displayLieu} • {date.toLocaleDateString('fr-FR')} à {time}
                  </p>
                  {event.infos && (
                    <p className="event-place muted" style={{ marginTop: '0.25rem' }}>
                      {event.infos}
                    </p>
                  )}
                </div>
              </div>

              {supabase && userId && (role === 'joueur' || role === 'parent') && (
                <div className="panel" style={{ padding: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                  {role === 'joueur' ? (
                    <>
                      <strong>Ma presence</strong>
                      {event.type === 'match' && !isConvoked ? (
                        <p className="muted" style={{ margin: 0 }}>
                          Tu n'es pas convoque pour ce match.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            type="button"
                            className={`presence-btn ${myPresence?.statut === 'present' ? 'present-active' : ''}`}
                            onClick={() => void setPresence(event, 'present')}
                            disabled={event.type === 'match' && !isConvoked}
                          >
                            Présent
                          </button>
                          <button
                            type="button"
                            className={`presence-btn ${myPresence?.statut === 'absent' ? 'absent-active' : ''}`}
                            onClick={() => void setPresence(event, 'absent')}
                            disabled={event.type === 'match' && !isConvoked}
                          >
                            Absent
                          </button>

                          {event.type === 'match' && !isDomicile && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="link-button"
                                onClick={() => void setVehicleOffer(event)}
                                disabled={!isConvoked}
                              >
                                Vehicule
                              </button>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <small className="muted">Places</small>
                                <input
                                  style={{ width: '6rem' }}
                                  inputMode="numeric"
                                  value={vehicleSeatsDraft[event.id] ?? (myVehicle ? String(myVehicle.seats_total) : '')}
                                  onChange={(e) => setVehicleSeatsDraft((c) => ({ ...c, [event.id]: e.target.value }))}
                                  placeholder="0"
                                  disabled={!isConvoked}
                                />
                              </label>
                            </div>
                          )}

                          <div className="muted" style={{ fontSize: '0.9rem' }}>
                            Statut: <strong>{myPresence ? myPresence.statut : '—'}</strong>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <strong>Présences de mes enfants</strong>
                      {(() => {
                        const child = parentChildren.find(c => c.id === activeChildId);
                        if (!child) return <p className="muted" style={{ margin: 0 }}>Aucun enfant sélectionné ou actif.</p>;
                        
                        const childIsConvoked = event.type === 'entrainement' ? true : convocations.some((c) => c.profile_id === child.id)
                        const childPresence = presences.find((p) => p.profile_id === child.id) ?? null
                        const childVehicle = vehicles.find((v) => v.owner_profile_id === child.id) ?? null
                        const draftKey = `${event.id}_${child.id}`
                        
                        if (event.type === 'match' && !childIsConvoked) {
                          return <p key={child.id} className="muted" style={{ margin: 0 }}>{child.nom} : non convoqué.</p>
                        }
                        
                        return (
                          <div key={child.id} style={{ padding: '0.5rem', background: 'var(--bg-color)', borderRadius: '6px', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span>Présence pour <strong>{child.nom}</strong></span>
                              <span className="muted" style={{ fontSize: '0.9rem' }}>
                                Statut: <strong>{childPresence ? childPresence.statut : '—'}</strong>
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                              <button
                                type="button"
                                className={`presence-btn ${childPresence?.statut === 'present' ? 'present-active' : ''}`}
                                onClick={() => void setPresence(event, 'present', child.id)}
                                disabled={event.type === 'match' && !childIsConvoked}
                              >
                                Présent
                              </button>
                              <button
                                type="button"
                                className={`presence-btn ${childPresence?.statut === 'absent' ? 'absent-active' : ''}`}
                                onClick={() => void setPresence(event, 'absent', child.id)}
                                disabled={event.type === 'match' && !childIsConvoked}
                              >
                                Absent
                              </button>
                              
                              {event.type === 'match' && !isDomicile && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <small className="muted">Places</small>
                                      <input
                                        style={{ width: '6rem' }}
                                        inputMode="numeric"
                                        value={vehicleSeatsDraft[draftKey] ?? (childVehicle ? String(childVehicle.seats_total) : '')}
                                        onChange={(e) => setVehicleSeatsDraft((c) => ({ ...c, [draftKey]: e.target.value }))}
                                        placeholder="0"
                                        disabled={!childIsConvoked}
                                      />
                                    </label>
                                    
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <small className="muted">Conducteur</small>
                                      <select
                                        value={vehicleDriverGenderDraft[draftKey] ?? (childVehicle?.driver_gender ?? '')}
                                        onChange={(e) => setVehicleDriverGenderDraft((c) => ({ ...c, [draftKey]: e.target.value as any }))}
                                        disabled={!childIsConvoked}
                                      >
                                        <option value="">Sélectionner</option>
                                        <option value="pere">Père</option>
                                        <option value="mere">Mère</option>
                                        <option value="autre">Autre</option>
                                      </select>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <small className="muted">Préférences</small>
                                      <select
                                        value={vehiclePassengerPrefDraft[draftKey] ?? (childVehicle?.passenger_preference ?? 'all')}
                                        onChange={(e) => setVehiclePassengerPrefDraft((c) => ({ ...c, [draftKey]: e.target.value as any }))}
                                        disabled={!childIsConvoked}
                                      >
                                        <option value="all">Tous passagers</option>
                                        <option value="women_and_children">Femmes/Enfants uniq.</option>
                                        <option value="men_and_children">Hommes/Enfants uniq.</option>
                                      </select>
                                    </label>
                                  </div>

                                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                      <input 
                                        type="checkbox"
                                        checked={vehicleHasChildDraft[draftKey] ?? (childVehicle?.has_child_present ?? true)}
                                        onChange={(e) => setVehicleHasChildDraft((c) => ({ ...c, [draftKey]: e.target.checked }))}
                                        disabled={!childIsConvoked}
                                      />
                                      Mon enfant ({child.nom}) sera dans le véhicule
                                    </label>

                                    <button
                                      type="button"
                                      className="primary-button"
                                      onClick={() => void setVehicleOffer(event, child.id)}
                                      disabled={!childIsConvoked}
                                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                    >
                                      {childVehicle ? 'Mettre à jour véhicule' : 'Proposer véhicule'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </>
                  )}
                </div>
              )}

              {event.type === 'match' && (
                <div className="panel" style={{ padding: '0.75rem', display: 'grid', gap: '0.35rem' }}>
                  <strong>Convoques</strong>
                  {convocations.length === 0 ? (
                    <p className="muted" style={{ margin: 0 }}>
                      Aucun joueur convoque.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {convocations
                        .map((c) => ({ id: c.profile_id, nom: c.profiles?.nom ?? 'Joueur' }))
                        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
                        .map((p) => (
                          <span key={p.id} className="chip">
                            {p.nom}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {event.type === 'match' && !isDomicile && (
                <div className="panel" style={{ padding: '0.75rem', display: 'grid', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div>
                      <strong>Covoiturage</strong>
                      <p className="muted" style={{ margin: 0 }}>
                        Vehicules + assignations (coach)
                      </p>
                    </div>

                    {canManageEvents && (
                      <button type="button" className="link-button" onClick={() => void refreshEventDetails([event.id])}>
                        Recharger
                      </button>
                    )}
                  </div>

                  {vehicles.length === 0 && <p className="muted" style={{ margin: 0 }}>
                    Aucun vehicule declare.
                  </p>}

                  {vehicles.length > 0 && (
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {vehicles.map((v) => {
                        const allAssigned = assignments.filter((a) => a.vehicle_id === v.id)
                        const approved = allAssigned.filter((a) => a.status === 'approved' || !a.status)
                        const pending = allAssigned.filter((a) => a.status === 'pending')
                        const used = approved.length
                        const left = Math.max(0, (v.seats_total ?? 0) - used)
                        const title = v.owner_profile_id
                          ? `Vehicule: ${v.profiles?.nom ?? 'Joueur'}`
                          : `Vehicule: ${v.label ?? 'Independant'}`
                        
                        const isOwner = v.owner_profile_id === userId || (role === 'parent' && parentChildren.some(c => c.id === v.owner_profile_id))

                        let driverLabel = ''
                        if (v.driver_gender === 'pere') driverLabel = '👨 Conduit par : Père'
                        if (v.driver_gender === 'mere') driverLabel = '👩 Conduit par : Mère'
                        if (v.driver_gender === 'autre') driverLabel = '🚘 Conduit par : Autre'
                        
                        const prefLabel = v.passenger_preference === 'women_and_children' ? '⚠️ Femmes et enfants uniq.'
                                        : v.passenger_preference === 'men_and_children' ? '⚠️ Hommes et enfants uniq.' : ''
                        
                        const hasChild = v.has_child_present ? '(Enfant présent)' : ''

                        // Can the current user request a seat?
                        // Only if they have a valid profile (userId or childId) and are not already in this vehicle or another vehicle for this event.
                        const activeProfileId = role === 'parent' ? activeChildId : userId
                        const isAlreadyAssigned = assignments.some(a => a.profile_id === activeProfileId)
                        const canRequestSeat = activeProfileId && !isAlreadyAssigned && left > 0 && !isOwner

                        return (
                          <div key={v.id} style={{ display: 'grid', gap: '0.5rem', padding: '0.75rem', borderRadius: '0.9rem', border: '1px solid rgba(0, 243, 255, 0.18)', background: 'rgba(0,0,0,0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: '1.05rem', color: '#00f3ff' }}>{title}</strong>
                              <span className="muted" style={{ fontWeight: 600 }}>{used}/{v.seats_total} utilises • {left} libres</span>
                            </div>

                            {(driverLabel || prefLabel) && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.85rem' }}>
                                {driverLabel && <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{driverLabel} {hasChild}</span>}
                                {prefLabel && <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#ffb74d' }}>{prefLabel}</span>}
                              </div>
                            )}

                            {/* Approved passengers */}
                            {approved.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                                {approved.map((a) => (
                                  <span key={a.profile_id} className="chip" style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', background: 'rgba(0, 243, 255, 0.15)' }}>
                                    {a.profiles?.nom ?? 'Joueur'}
                                    {canManageEvents && (
                                      <button
                                        type="button"
                                        className="link-button"
                                        onClick={() => void unassignPlayer(event.id, a.profile_id)}
                                        style={{ padding: 0, lineHeight: 1 }}
                                      >
                                        x
                                      </button>
                                    )}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                                Aucun passager validé.
                              </p>
                            )}

                            {/* Pending requests */}
                            {pending.length > 0 && (
                              <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(255, 183, 77, 0.1)', borderRadius: '6px' }}>
                                <strong style={{ fontSize: '0.85rem', color: '#ffb74d', display: 'block', marginBottom: '0.4rem' }}>En attente de validation :</strong>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  {pending.map((a) => (
                                    <span key={a.profile_id} className="chip" style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', borderColor: '#ffb74d' }}>
                                      ⏳ {a.profiles?.nom ?? 'Joueur'}
                                      
                                      {/* Owner or Admin can approve/reject */}
                                      {(isOwner || canManageEvents) && (
                                        <>
                                          <button
                                            type="button"
                                            className="link-button"
                                            onClick={() => void approveVehicleAssignment(event.id, v.id, a.profile_id)}
                                            style={{ padding: '0 0.2rem', color: '#4caf50', fontWeight: 'bold' }}
                                            title="Accepter"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            type="button"
                                            className="link-button"
                                            onClick={() => void rejectVehicleAssignment(event.id, v.id, a.profile_id)}
                                            style={{ padding: '0 0.2rem', color: '#f44336', fontWeight: 'bold' }}
                                            title="Refuser"
                                          >
                                            ✗
                                          </button>
                                        </>
                                      )}
                                      
                                      {/* User can cancel their own request */}
                                      {!isOwner && !canManageEvents && a.profile_id === activeProfileId && (
                                        <button
                                          type="button"
                                          className="link-button"
                                          onClick={() => void unassignPlayer(event.id, a.profile_id)}
                                          style={{ padding: '0 0.2rem' }}
                                          title="Annuler ma demande"
                                        >
                                          Annuler
                                        </button>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Request Seat Button */}
                            {canRequestSeat && (
                              <div style={{ marginTop: '0.25rem' }}>
                                <button
                                  type="button"
                                  className="primary-button"
                                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid #00f3ff', color: '#00f3ff' }}
                                  onClick={() => void requestVehicleSeat(event.id, v.id, activeProfileId)}
                                >
                                  Demander une place
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {canManageEvents && (
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                        <label>
                          Ajouter un vehicule (independant)
                          <input
                            value={independentVehicleLabel[event.id] ?? ''}
                            onChange={(e) => setIndependentVehicleLabel((c) => ({ ...c, [event.id]: e.target.value }))}
                            placeholder="Ex: Minibus loue"
                          />
                        </label>
                        <label>
                          Places
                          <input
                            inputMode="numeric"
                            value={independentVehicleSeats[event.id] ?? ''}
                            onChange={(e) => setIndependentVehicleSeats((c) => ({ ...c, [event.id]: e.target.value }))}
                            placeholder="8"
                          />
                        </label>
                        <div style={{ display: 'flex', alignItems: 'end' }}>
                          <button type="button" className="primary-button" onClick={() => void addVehicleIndependent(event.id)}>
                            Ajouter vehicule
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                        <label>
                          Assigner un joueur
                          <select
                            value={assignPickPlayer[event.id] ?? ''}
                            onChange={(e) => setAssignPickPlayer((c) => ({ ...c, [event.id]: e.target.value }))}
                          >
                            <option value="">-- joueur present --</option>
                            {eligiblePlayers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nom}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Vers vehicule
                          <select
                            value={assignPickVehicle[event.id] ?? ''}
                            onChange={(e) => setAssignPickVehicle((c) => ({ ...c, [event.id]: e.target.value }))}
                          >
                            <option value="">-- vehicule --</option>
                            {vehicles.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.owner_profile_id ? v.profiles?.nom ?? 'Joueur' : v.label ?? 'Independant'}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'end' }}>
                          <button type="button" className="primary-button" onClick={() => void assignPlayer(event.id)}>
                            Assigner
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="muted" style={{ fontSize: '0.9rem' }}>
                Presence equipe: {presences.filter((p) => p.statut === 'present' || p.statut === 'retard').length} present(s),{' '}
                {presences.filter((p) => p.statut === 'absent').length} absent(s)
              </div>
            </article>
          )
        })}
      </div>

      {confirmDeleteEvent && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 1000,
          padding: '1.5rem',
          backdropFilter: 'blur(4px)',
        }}>
          <div className="panel" style={{
            maxWidth: '400px',
            width: '100%',
            padding: '1.5rem',
            background: 'var(--surface-color, #0f172a)',
            borderRadius: '1rem',
            border: '1px solid rgba(0, 243, 255, 0.35)',
            boxShadow: '0 0 20px rgba(0, 243, 255, 0.15)',
            display: 'grid',
            gap: '1rem'
          }}>
            <h3 style={{ margin: 0, color: 'var(--text-color, #f8fafc)' }}>Confirmer la suppression</h3>
            <p className="muted" style={{ margin: 0 }}>
              Voulez-vous vraiment supprimer cet événement ?
            </p>
            <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '0.5rem', fontSize: '0.9rem' }}>
              <strong>{confirmDeleteEvent.type === 'match' ? '⚽ Match' : '🏃 Entraînement'}</strong>
              {confirmDeleteEvent.lieu && <p style={{ margin: '0.25rem 0 0 0' }}>📍 {confirmDeleteEvent.lieu}</p>}
              {confirmDeleteEvent.infos && <p style={{ margin: '0.25rem 0 0 0', fontStyle: 'italic' }}>{confirmDeleteEvent.infos}</p>}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'end', marginTop: '0.5rem' }}>
              <button 
                type="button" 
                className="link-button" 
                onClick={() => setConfirmDeleteEvent(null)}
                style={{ padding: '0.5rem 1rem' }}
              >
                Annuler
              </button>
              <button 
                type="button" 
                className="primary-button" 
                onClick={() => void executeDeleteEvent()}
                style={{ padding: '0.5rem 1.25rem', background: '#ef4444', borderColor: '#ef4444' }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function ChatPage({
  club,
  authorName,
  userId,
  role,
  equipe,
  parentChildren,
  activeChildId,
}: {
  club: ClubRow | null
  authorName: string | null
  userId: string | null
  role: Role | null
  equipe: EquipeRow | null
  parentChildren: Array<{ id: string; nom: string; equipe_id: string | null; team_name: string; team_category: string; is_approved: boolean }>
  activeChildId: string
}) {
  const [messages, setMessages] = useState<ChatMessageRow[]>([])
  const [draft, setDraft] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const chatRestrictedForPlayers = Boolean(club?.chat_restricted) && role === 'joueur'

  const activeChild = role === 'parent' ? parentChildren.find(c => c.id === activeChildId) : null
  const targetEquipeId = role === 'parent' ? activeChild?.equipe_id : equipe?.id

  useEffect(() => {
    if (!supabase) {
      setMessages([])
      return
    }

    if (!club?.id) {
      setMessages([])
      return
    }

    let ignore = false
    setError(null)
    setMessages([])

    void (async () => {
      let query = supabase
        .from('chat_messages')
        .select('id, club_id, author_id, author_name, text, created_at, equipe_id')
        .eq('club_id', club.id)

      if (targetEquipeId) {
        query = query.eq('equipe_id', targetEquipeId)
      } else {
        query = query.is('equipe_id', null)
      }

      const { data, error: fetchError } = await query
        .order('created_at', { ascending: true })
        .limit(200)

      if (ignore) return

      if (fetchError) {
        setError(formatSupabaseError(fetchError))
        setMessages([])
        return
      }

      setMessages((data as ChatMessageRow[]) ?? [])
    })()

    const channel = supabase.channel(`chat:${club.id}:${targetEquipeId ?? 'global'}`)
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: targetEquipeId ? `club_id=eq.${club.id}&equipe_id=eq.${targetEquipeId}` : `club_id=eq.${club.id}`
        },
        (payload) => {
          const incoming = payload.new as ChatMessageRow
          setMessages((current) => (current.some((msg) => msg.id === incoming.id) ? current : [...current, incoming]))
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: targetEquipeId ? `club_id=eq.${club.id}&equipe_id=eq.${targetEquipeId}` : `club_id=eq.${club.id}`
        },
        (payload) => {
          const removed = payload.old as { id?: string }
          if (!removed?.id) return
          setMessages((current) => current.filter((msg) => msg.id !== removed.id))
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      ignore = true
      if (supabase) {
        void supabase.removeChannel(channel)
      }
      channelRef.current = null
    }
  }, [club?.id, targetEquipeId])

  const sendMessage = async () => {
    setError(null)

    if (!supabase) {
      setError("Supabase n'est pas configure")
      return
    }

    if (!club?.id) {
      setError('Club non configure')
      return
    }

    if (!userId) {
      setError('Utilisateur non connecte')
      return
    }

    if (chatRestrictedForPlayers) {
      setError('Chat reserve aux coachs/admins')
      return
    }

    const text = draft.trim()
    if (!text) {
      return
    }

    setSendBusy(true)
    setDraft('')

    try {
      const payload = {
        club_id: club.id,
        equipe_id: targetEquipeId ?? null,
        author_id: userId,
        author_name: authorName ?? 'Moi',
        text,
      }

      const { data, error: insertError } = await supabase
        .from('chat_messages')
        .insert(payload)
        .select('id, club_id, author_id, author_name, text, created_at, equipe_id')
        .single()

      if (insertError) {
        setDraft(text)
        throw insertError
      }

      const inserted = (data as ChatMessageRow | null) ?? null
      if (inserted) {
        setMessages((current) => (current.some((msg) => msg.id === inserted.id) ? current : [...current, inserted]))
      }
    } catch (caught) {
      setError(formatSupabaseError(caught))
    } finally {
      setSendBusy(false)
    }
  }

  return (
    <section className="page tests-chat-page">
      <header className="page-title">
        <h2>Chat equipe realtime</h2>
        <p>Messages internes de {role === 'parent' && activeChild ? `l'équipe de ${activeChild.nom}` : "l'equipe"}</p>
      </header>

      <article className="panel chat-panel">
        {club?.chat_restricted && role !== 'admin' && role !== 'coach' && role !== 'super_admin' && (
          <p className="form-feedback info">Chat restreint: seuls les coachs/admins peuvent lire et ecrire.</p>
        )}

        {error && <p className="form-feedback error">{error}</p>}

        <div className="messages-list">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message-bubble ${message.author_id === userId ? 'mine' : ''}`}
            >
              <strong>{message.author_name}</strong>
              <p>{message.text}</p>
              <small>
                {new Date(message.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </small>
            </div>
          ))}
        </div>
        <div className="chat-input-row">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={chatRestrictedForPlayers ? 'Chat reserve coach/admin' : 'Votre message'}
            disabled={sendBusy || chatRestrictedForPlayers}
          />
          <button
            type="button"
            className="primary-button"
            onClick={() => void sendMessage()}
            disabled={sendBusy || chatRestrictedForPlayers}
          >
            {sendBusy ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
      </article>
    </section>
  )
}

function TestsPage({
  userId,
  role,
  club,
  equipe,
  parentChildren,
  activeChildId,
}: {
  userId: string | null
  role: Role | null
  club: ClubRow | null
  equipe: EquipeRow | null
  parentChildren: Array<{ id: string; nom: string; equipe_id: string | null; team_name: string; team_category: string; is_approved: boolean }>
  activeChildId: string
}) {
  const [players, setPlayers] = useState<Array<{ id: string; nom: string }>>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
  const [viewMode, setViewMode] = useState<'skills' | 'performance'>('skills')
  const [competencies, setCompetencies] = useState<
    Array<{
      id: string
      category: string
      competency_name: string
      level_rank: number
      level_name: string
      level_description: string
    }>
  >([])
  const [playerLevels, setPlayerLevels] = useState<
    Record<string, number>
  >({})
  const [activeCategoryId, setActiveCategoryId] = useState<string>('Technique')
  const [activeSkillName, setActiveSkillName] = useState<string>('')
  const [activeLevel, setActiveLevel] = useState(1)
  const [saving, setSaving] = useState(false)

  // Custom description editing states
  const [editingDescription, setEditingDescription] = useState(false)
  const [editedDescriptionText, setEditedDescriptionText] = useState('')
  const [editedLevelNameText, setEditedLevelNameText] = useState('')

  // Custom image upload/display states
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageTimestamp, setImageTimestamp] = useState(Date.now())
  const [mediaSrc, setMediaSrc] = useState<string>('')
  const [customImageExists, setCustomImageExists] = useState(false)

  // Performance state
  const [performanceHistory, setPerformanceHistory] = useState<any[]>([])
  const [perfType, setPerfType] = useState('Vitesse (20m)')
  const [perfScore, setPerfScore] = useState('')
  const [perfUnit, setPerfUnit] = useState('s')

  const perfTypes = [
    { label: 'Vitesse (20m)', unit: 's' },
    { label: 'Détente Verticale', unit: 'cm' },
    { label: 'VMA', unit: 'km/h' },
    { label: 'Saut en longueur', unit: 'm' },
    { label: 'Endurance (Test Cooper)', unit: 'm' },
    { label: 'Souplesse', unit: 'cm' },
  ]

  const canManage = role === 'admin' || role === 'coach' || role === 'super_admin'
  const canPickPlayers = Boolean(supabase) && canManage && Boolean(userId)
  const activeChild = role === 'parent' ? parentChildren?.find(c => c.id === activeChildId) : null

  const activeProfileId = useMemo(() => {
    if (!supabase) return null
    if (!userId) return null
    if (role === 'parent' && activeChildId) return activeChildId
    if (!canManage) return userId
    return selectedPlayerId || userId
  }, [canManage, role, selectedPlayerId, userId, activeChildId])

  const categoryIcons: Record<string, string> = {
    Technique: '⚽',
    Mental: '🧠',
    Tactique: '🗺️',
    Physique: '💪',
    Perceptif: '👁️',
    Cognitif: '🔵',
  }

  const categories = useMemo(
    () =>
      Array.from(new Set(competencies.map((c) => c.category)))
        .sort()
        .filter((cat) => ['Technique', 'Mental', 'Tactique', 'Physique', 'Perceptif', 'Cognitif'].includes(cat)),
    [competencies],
  )

  const competenciesForCategory = useMemo(
    () =>
      competencies
        .filter((c) => c.category?.toLowerCase() === activeCategoryId?.toLowerCase())
        .reduce(
          (acc, c) => {
            const key = c.competency_name
            if (!acc[key]) {
              acc[key] = []
            }
            acc[key].push(c)
            return acc
          },
          {} as Record<string, Array<(typeof competencies)[number]>>,
        ),
    [activeCategoryId, competencies],
  )

  const levelsForActiveSkill = useMemo(
    () =>
      (competenciesForCategory[activeSkillName] ?? []).sort((a, b) => a.level_rank - b.level_rank),
    [activeSkillName, competenciesForCategory],
  )

  const activeLevelDetails = useMemo(
    () => levelsForActiveSkill.find((lvl) => lvl.level_rank === activeLevel) ?? levelsForActiveSkill[0],
    [activeLevel, levelsForActiveSkill],
  )

  // Sync editing text boxes when the active level or active skill changes
  useEffect(() => {
    if (activeLevelDetails) {
      setEditedDescriptionText(activeLevelDetails.level_description || '')
      setEditedLevelNameText(activeLevelDetails.level_name || '')
      setEditingDescription(false)
    }
  }, [activeLevelDetails])

  // Load competency framework from database
  useEffect(() => {
    if (!supabase || !club?.id) {
      setCompetencies([])
      return
    }

    let ignore = false

    void (async () => {
      const { data, error } = await supabase
        .from('competency_framework')
        .select('id, category, competency_name, level_rank, level_name, level_description')
        .eq('club_id', club.id)
        .order('category', { ascending: true })
        .order('competency_name', { ascending: true })
        .order('level_rank', { ascending: true })

      if (ignore) return
      if (error) {
        setCompetencies([])
        return
      }

      setCompetencies(
        (data as Array<{
          id: string
          category: string
          competency_name: string
          level_rank: number
          level_name: string
          level_description: string
        }>) ?? [],
      )
    })()

    return () => {
      ignore = true
    }
  }, [club?.id])

  // Load players list
  useEffect(() => {
    if (!canPickPlayers) {
      setPlayers([])
      setSelectedPlayerId('')
      return
    }

    if (!supabase) {
      setPlayers([])
      return
    }

    let ignore = false

    void (async () => {
      let list: Array<{ id: string; nom: string }> = []
      let query = supabase
        .from('profiles')
        .select('id, nom, role, club_id, equipe_id')
        .eq('role', 'joueur')
        .order('nom', { ascending: true })

      if (role === 'coach' && equipe?.id) {
        query = query.eq('equipe_id', equipe.id)
      } else if (role === 'admin' && club?.id) {
        query = query.eq('club_id', club.id)
      }

      const { data, error } = await query
      if (ignore) return
      if (error) {
        setPlayers([])
        return
      }
      list = ((data as Array<{ id: string; nom: string }>) ?? []).map((row) => ({ id: row.id, nom: row.nom }))

      if (ignore) return
      setPlayers(list)

      if (!selectedPlayerId && list.length > 0) {
        setSelectedPlayerId(list[0].id)
      }
    })()

    return () => {
      ignore = true
    }
  }, [canPickPlayers, club?.id, equipe?.id, role, selectedPlayerId, userId])

  // Load player competency levels
  useEffect(() => {
    if (!supabase || !activeProfileId) {
      setPlayerLevels({})
      setPerformanceHistory([])
      return
    }

    let ignore = false

    void (async () => {
      // 1. Levels
      const competencyIds = competencies.map((c) => c.id)
      if (competencyIds.length > 0) {
        const { data: lvlData } = await supabase
          .from('player_competency_levels')
          .select('id, competency_id, current_level_rank, competency_framework(competency_name)')
          .eq('profile_id', activeProfileId)
          .in('competency_id', competencyIds)

        if (!ignore && lvlData) {
          const levels: Record<string, number> = {}
          for (const row of (lvlData as any[]) ?? []) {
            const name = row.competency_framework?.competency_name
            if (name) {
              levels[name] = Math.max(levels[name] || 0, row.current_level_rank)
            }
          }
          setPlayerLevels(levels)
        }
      }

      // 2. Performance history
      const { data: perfData } = await supabase
        .from('tests_physiques')
        .select('*')
        .eq('profile_id', activeProfileId)
        .order('date', { ascending: false })

      if (!ignore) setPerformanceHistory(perfData || [])
    })()

    return () => {
      ignore = true
    }
  }, [activeProfileId, competencies])

  // Auto-select first category and skill
  useEffect(() => {
    if (categories.length > 0 && !categories.includes(activeCategoryId)) {
      setActiveCategoryId(categories[0])
    }
  }, [activeCategoryId, categories])

  useEffect(() => {
    const skills = Object.keys(competenciesForCategory)
    if (skills.length > 0 && !skills.includes(activeSkillName)) {
      setActiveSkillName(skills[0])
    }
  }, [activeSkillName, competenciesForCategory])

  useEffect(() => {
    if (levelsForActiveSkill.length > 0 && !levelsForActiveSkill.some((l) => l.level_rank === activeLevel)) {
      setActiveLevel(levelsForActiveSkill[0].level_rank)
    }
  }, [activeLevel, levelsForActiveSkill])

  const handleUpdateDescription = async () => {
    if (!supabase || !activeLevelDetails || !userId) return
    if (!canManage) return

    setSaving(true)

    try {
      const { error } = await supabase
        .from('competency_framework')
        .update({
          level_name: editedLevelNameText,
          level_description: editedDescriptionText
        })
        .eq('id', activeLevelDetails.id)

      if (error) throw error

      setCompetencies(prev => 
        prev.map(c => 
          c.id === activeLevelDetails.id 
            ? { ...c, level_name: editedLevelNameText, level_description: editedDescriptionText } 
            : c
        )
      )
      setEditingDescription(false)
    } catch (err) {
      console.error("Error updating competency description:", err)
      alert("Erreur lors de la modification : " + formatSupabaseError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleSetLevel = async (competencyId: string, levelRank: number) => {
    if (!supabase || !activeProfileId || !userId) return
    if (!canManage) return

    setSaving(true)

    try {
      // Pour éviter les erreurs de doublons (legacy data), 
      // on commence par identifier tous les IDs possibles pour cette compétence
      const skillName = activeSkillName
      const allCompIdsForSkill = competencies
        .filter(c => c.competency_name === skillName)
        .map(c => c.id)

      // On supprime proprement TOUTES les anciennes entrées pour cette compétence et ce joueur
      const { error: deleteError } = await supabase
        .from('player_competency_levels')
        .delete()
        .eq('profile_id', activeProfileId)
        .in('competency_id', allCompIdsForSkill)

      if (deleteError) throw deleteError

      // On insère maintenant la nouvelle ligne unique et propre
      const { error: insertError } = await supabase.from('player_competency_levels').insert({
        profile_id: activeProfileId,
        competency_id: competencyId,
        current_level_rank: levelRank,
        updated_by: userId,
      })

      if (insertError) throw insertError

      // Mise à jour de l'état local
      setPlayerLevels(prev => ({
        ...prev,
        [skillName]: levelRank
      }))

    } catch (err) {
      console.error("Error setting level:", err)
      alert("Erreur lors de la validation : " + formatSupabaseError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleSavePerformance = async () => {
    if (!supabase || !activeProfileId || !userId || !perfScore) return
    setSaving(true)
    try {
      const scoreNum = parseFloat(perfScore.replace(',', '.'))
      if (isNaN(scoreNum)) throw new Error("Le score doit être un nombre")

      const { data, error } = await supabase.from('tests_physiques').insert({
        profile_id: activeProfileId,
        type_test: perfType,
        score: scoreNum,
        date: new Date().toISOString(),
        created_by: userId
      }).select().single()

      if (error) throw error
      setPerformanceHistory(current => [data, ...current])
      setPerfScore('')
    } catch (err) {
      alert("Erreur lors de l'enregistrement: " + formatSupabaseError(err))
    } finally {
      setSaving(false)
    }
  }

  const skills = Object.keys(competenciesForCategory)

  const handleInitializeDefaults = async () => {
    if (!supabase || !club?.id || !userId) return
    setSaving(true)
    try {
      // Define the defaults directly here to match seed_competencies.sql
      const defaults = [
        // TECHNIQUE
        { cat: 'Technique', name: 'Conduite de balle', rank: 1, lname: 'Découverte', desc: 'Conduit le ballon lentement avec contrôle irrégulier.' },
        { cat: 'Technique', name: 'Conduite de balle', rank: 2, lname: 'En progression', desc: 'Garde le contrôle en mouvement avec peu de pertes.' },
        { cat: 'Technique', name: 'Conduite de balle', rank: 3, lname: 'Maîtrise', desc: 'Alterne rythmes et directions avec ballon proche du pied.' },
        { cat: 'Technique', name: 'Conduite de balle', rank: 4, lname: 'Référence', desc: 'Conduit vite, protège et élimine sous pression réelle.' },
        { cat: 'Technique', name: 'Passe sous pression', rank: 1, lname: 'Découverte', desc: 'Passe réussie sans adversaire proche.' },
        { cat: 'Technique', name: 'Passe sous pression', rank: 2, lname: 'En progression', desc: 'Trouve un partenaire avec opposition modérée.' },
        { cat: 'Technique', name: 'Passe sous pression', rank: 3, lname: 'Maîtrise', desc: 'Choisit la bonne passe dans un espace réduit.' },
        { cat: 'Technique', name: 'Passe sous pression', rank: 4, lname: 'Référence', desc: 'Enchaîne passe juste et rapide sous pressing intense.' },
        // MENTAL
        { cat: 'Mental', name: 'Concentration', rank: 1, lname: 'Découverte', desc: 'Perd vite le fil de la consigne en séance.' },
        { cat: 'Mental', name: 'Concentration', rank: 2, lname: 'En progression', desc: 'Reste concentré sur des séquences courtes.' },
        { cat: 'Mental', name: 'Concentration', rank: 3, lname: 'Maîtrise', desc: 'Maintient son attention même après une erreur.' },
        { cat: 'Mental', name: 'Concentration', rank: 4, lname: 'Référence', desc: 'Concentration stable du début à la fin.' },
        { cat: 'Mental', name: 'Gestion émotionnelle', rank: 1, lname: 'Découverte', desc: 'Réagit fortement à la frustration.' },
        { cat: 'Mental', name: 'Gestion émotionnelle', rank: 2, lname: 'En progression', desc: 'Retrouve son calme avec accompagnement.' },
        { cat: 'Mental', name: 'Gestion émotionnelle', rank: 3, lname: 'Maîtrise', desc: 'Contrôle ses réactions dans les temps faibles.' },
        { cat: 'Mental', name: 'Gestion émotionnelle', rank: 4, lname: 'Référence', desc: 'Reste lucide et positif dans les moments critiques.' },
        // TACTIQUE
        { cat: 'Tactique', name: 'Placement défensif', rank: 1, lname: 'Découverte', desc: 'Repère tardivement sa zone et son rôle.' },
        { cat: 'Tactique', name: 'Placement défensif', rank: 2, lname: 'En progression', desc: 'Occupe globalement la bonne zone.' },
        { cat: 'Tactique', name: 'Placement défensif', rank: 3, lname: 'Maîtrise', desc: 'Ajuste son placement selon ballon et partenaires.' },
        { cat: 'Tactique', name: 'Placement défensif', rank: 4, lname: 'Référence', desc: 'Anticipe et ferme les espaces avant le danger.' },
        { cat: 'Tactique', name: 'Lecture des transitions', rank: 1, lname: 'Découverte', desc: 'Réagit tard aux pertes et récupérations.' },
        { cat: 'Tactique', name: 'Lecture des transitions', rank: 2, lname: 'En progression', desc: 'Déclenche un replacement simple.' },
        { cat: 'Tactique', name: 'Lecture des transitions', rank: 3, lname: 'Maîtrise', desc: 'Fait le bon choix en transition offensive/défensive.' },
        { cat: 'Tactique', name: 'Lecture des transitions', rank: 4, lname: 'Référence', desc: 'Influence positivement la transition de toute l équipe.' },
        // PHYSIQUE
        { cat: 'Physique', name: 'VMA / capacité aérobie', rank: 1, lname: 'Découverte', desc: 'Difficulté à tenir les blocs d effort.' },
        { cat: 'Physique', name: 'VMA / capacité aérobie', rank: 2, lname: 'En progression', desc: 'Tient l intensité sur des séquences limitées.' },
        { cat: 'Physique', name: 'VMA / capacité aérobie', rank: 3, lname: 'Maîtrise', desc: 'Répète les courses avec récupération correcte.' },
        { cat: 'Physique', name: 'VMA / capacité aérobie', rank: 4, lname: 'Référence', desc: 'Maintient haute intensité sur toute la séance.' },
        { cat: 'Physique', name: 'Sprint 20m', rank: 1, lname: 'Découverte', desc: 'Départ et accélération encore lents.' },
        { cat: 'Physique', name: 'Sprint 20m', rank: 2, lname: 'En progression', desc: 'Accélération correcte sur les premiers mètres.' },
        { cat: 'Physique', name: 'Sprint 20m', rank: 3, lname: 'Maîtrise', desc: 'Bonne fréquence et vitesse terminale stable.' },
        { cat: 'Physique', name: 'Sprint 20m', rank: 4, lname: 'Référence', desc: 'Sprint explosif et reproductible en série.' },
        // PERCEPTIF
        { cat: 'Perceptif', name: 'Vision périphérique', rank: 1, lname: 'Découverte', desc: 'Observe surtout le ballon, peu l environnement.' },
        { cat: 'Perceptif', name: 'Vision périphérique', rank: 2, lname: 'En progression', desc: 'Identifie quelques options autour de lui.' },
        { cat: 'Perceptif', name: 'Vision périphérique', rank: 3, lname: 'Maîtrise', desc: 'Scanne fréquemment avant de recevoir.' },
        { cat: 'Perceptif', name: 'Vision périphérique', rank: 4, lname: 'Référence', desc: 'Utilise infos périphériques pour devancer le jeu.' },
        { cat: 'Perceptif', name: 'Orientation du corps', rank: 1, lname: 'Découverte', desc: 'Orientation fermée, options de jeu limitées.' },
        { cat: 'Perceptif', name: 'Orientation du corps', rank: 2, lname: 'En progression', desc: 'Ouvre son corps dans des situations simples.' },
        { cat: 'Perceptif', name: 'Orientation du corps', rank: 3, lname: 'Maîtrise', desc: 'Oriente son contrôle selon la pression.' },
        { cat: 'Perceptif', name: 'Orientation du corps', rank: 4, lname: 'Référence', desc: 'Orientation optimale et constante avant réception.' },
        // COGNITIF
        { cat: 'Cognitif', name: 'Vitesse de décision', rank: 1, lname: 'Découverte', desc: 'Hésite souvent avant de choisir.' },
        { cat: 'Cognitif', name: 'Vitesse de décision', rank: 2, lname: 'En progression', desc: 'Prend des décisions simples avec délai réduit.' },
        { cat: 'Cognitif', name: 'Vitesse de décision', rank: 3, lname: 'Maîtrise', desc: 'Choisit vite et juste dans des contextes variables.' },
        { cat: 'Cognitif', name: 'Vitesse de décision', rank: 4, lname: 'Référence', desc: 'Décision immédiate et pertinente sous forte pression.' },
        { cat: 'Cognitif', name: 'Mémoire tactique', rank: 1, lname: 'Découverte', desc: 'Retient partiellement les principes collectifs.' },
        { cat: 'Cognitif', name: 'Mémoire tactique', rank: 2, lname: 'En progression', desc: 'Applique les consignes récurrentes.' },
        { cat: 'Cognitif', name: 'Mémoire tactique', rank: 3, lname: 'Maîtrise', desc: 'Transfère les schémas vus à l entrainement.' },
        { cat: 'Cognitif', name: 'Mémoire tactique', rank: 4, lname: 'Référence', desc: 'Mobilise automatiquement les repères tactiques.' }
      ]

      const payload = defaults.map(d => ({
        club_id: club.id,
        category: d.cat,
        competency_name: d.name,
        level_rank: d.rank,
        level_name: d.lname,
        level_description: d.desc
      }))

      const { error } = await supabase.from('competency_framework').insert(payload)
      if (error) throw error

      // Refresh data
      const { data: newData } = await supabase
        .from('competency_framework')
        .select('id, category, competency_name, level_rank, level_name, level_description')
        .eq('club_id', club.id)
        .order('category', { ascending: true })
        .order('competency_name', { ascending: true })
        .order('level_rank', { ascending: true })

      setCompetencies((newData as any[]) ?? [])
    } catch (err) {
      alert("Erreur lors de l'initialisation: " + formatSupabaseError(err))
    } finally {
      setSaving(false)
    }
  }

  // Synchroniser mediaSrc avec l'illustration personnalisée en priorité
  useEffect(() => {
    if (!club?.id) return
    const safeCat = slugify(activeCategoryId)
    const safeSkill = slugify(activeSkillName)
    const customPath = `tests/${club.id}/${safeCat}/${safeSkill}/level-${activeLevel}.jpg`
    const customUrl = supabase ? supabase.storage.from('club-logos').getPublicUrl(customPath).data.publicUrl : ''
    setMediaSrc(customUrl ? `${customUrl}?t=${imageTimestamp}` : '')
    setCustomImageExists(false)
  }, [activeCategoryId, activeSkillName, activeLevel, imageTimestamp, club?.id])

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !supabase || !club?.id) return

    setUploadingImage(true)
    try {
      const safeCat = slugify(activeCategoryId)
      const safeSkill = slugify(activeSkillName)
      const customPath = `tests/${club.id}/${safeCat}/${safeSkill}/level-${activeLevel}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('club-logos')
        .upload(customPath, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      setImageTimestamp(Date.now())
      alert('Illustration mise à jour avec succès ! ✓')
    } catch (err) {
      console.error(err)
      alert("Erreur lors de l'upload de l'image: " + formatSupabaseError(err))
    } finally {
      setUploadingImage(false)
    }
  }

  const handleDeleteImage = async () => {
    if (!supabase || !club?.id) return

    const confirmDelete = window.confirm("Voulez-vous vraiment supprimer l'illustration personnalisée et revenir à l'image par défaut ?")
    if (!confirmDelete) return

    setUploadingImage(true)
    try {
      const safeCat = slugify(activeCategoryId)
      const safeSkill = slugify(activeSkillName)
      const customPath = `tests/${club.id}/${safeCat}/${safeSkill}/level-${activeLevel}.jpg`

      const { error: deleteError } = await supabase.storage
        .from('club-logos')
        .remove([customPath])

      if (deleteError) throw deleteError

      setCustomImageExists(false)
      setImageTimestamp(Date.now())
      alert('Illustration supprimée avec succès ! ✓')
    } catch (err) {
      console.error(err)
      alert("Erreur lors de la suppression de l'image: " + formatSupabaseError(err))
    } finally {
      setUploadingImage(false)
    }
  }

  // Media path logic
  const getMediaPath = (cat: string, skill: string, lvl: number) => {
    const safeCat = slugify(cat)
    const safeSkill = slugify(skill)
    return `/media/tests/${safeCat}/${safeSkill}/level-${lvl}.jpg`
  }

  return (
    <section className="page tests-page">
      <header className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>{role === 'parent' && activeChild ? `Tests de ${activeChild.nom || "l'enfant"}` : 'Tests & Compétences'}</h2>
          <p>Évaluation des performances et suivi technique</p>
        </div>
        <div className="view-toggle">
          <button className={`toggle-btn ${viewMode === 'skills' ? 'active' : ''}`} onClick={() => setViewMode('skills')}>Compétences</button>
          <button className={`toggle-btn ${viewMode === 'performance' ? 'active' : ''}`} onClick={() => setViewMode('performance')}>Performances</button>
        </div>
      </header>

      {supabase && canManage && (
        <article className="panel" style={{ padding: '1rem', marginBottom: '0.5rem' }}>
          <label>
            Joueur à évaluer
            <select value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.target.value)}>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.nom}
                </option>
              ))}
            </select>
          </label>
        </article>
      )}

      {viewMode === 'skills' ? (
        <>
          <div className="skill-tabs">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`skill-tab ${category.toLowerCase() === activeCategoryId.toLowerCase() ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategoryId(category)
                  const skillsList = Object.keys(competenciesForCategory)
                  if (skillsList.length > 0) setActiveSkillName(skillsList[0])
                  setActiveLevel(1)
                }}
              >
                {categoryIcons[category] || '📍'} {category}
              </button>
            ))}
          </div>

          {competencies.length === 0 ? (
            <article className="panel" style={{ padding: '2.5rem', textAlign: 'center', display: 'grid', gap: '1rem' }}>
              <div style={{ fontSize: '3rem' }}>📋</div>
              <h3>Initialisation des Tests</h3>
              <p className="muted">
                Il semble que les tests n'ont pas encore été configurés pour votre club.<br />
                Vous pouvez charger les tests standards (Technique, Physique, Mental, etc.) en un clic.
              </p>
              <button
                className="primary-button"
                style={{ width: 'fit-content', margin: '0 auto' }}
                onClick={handleInitializeDefaults}
                disabled={saving}
              >
                {saving ? 'Chargement...' : 'Charger les tests par défaut'}
              </button>
            </article>
          ) : (
            <div className="tests-chat-grid">
              <aside>
                <h3 className="eyebrow">Compétences</h3>
                <div className="skill-list" style={{ marginTop: '0.75rem' }}>
                  {skills.map((skill) => {
                    const currentLvl = playerLevels[skill] || null
                    return (
                      <button
                        key={skill}
                        type="button"
                        className={`skill-item ${skill === activeSkillName ? 'active' : ''}`}
                        onClick={() => {
                          setActiveSkillName(skill)
                          setActiveLevel(1)
                        }}
                      >
                        <span>{skill}</span>
                        {currentLvl && <span className="level-badge">Lvl {currentLvl}</span>}
                      </button>
                    )
                  })}
                </div>
              </aside>

              <article className="panel" style={{ padding: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ color: 'var(--neon-green)' }}>{activeSkillName}</h3>
                  <span className="muted">Niveaux 1-4</span>
                </div>

                <div className="level-grid">
                  {[1, 2, 3, 4].map((l) => {
                    const isValidated = (playerLevels[activeSkillName] || 0) >= l
                    return (
                      <button
                        key={l}
                        type="button"
                        className={`level-btn ${activeLevel === l ? 'active' : ''} ${isValidated ? 'validated' : ''}`}
                        onClick={() => setActiveLevel(l)}
                      >
                        {l}
                      </button>
                    )
                  })}
                </div>

                <div className="level-card-content">
                  {editingDescription ? (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <label style={{ display: 'grid', gap: '0.25rem' }}>
                        <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nom du niveau</span>
                        <input
                          type="text"
                          value={editedLevelNameText}
                          onChange={(e) => setEditedLevelNameText(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.6rem',
                            borderRadius: '0.5rem',
                            border: '1px solid rgba(0, 243, 255, 0.3)',
                            background: 'rgba(30, 41, 59, 0.7)',
                            color: 'var(--text-color, #f8fafc)',
                            fontSize: '0.9rem'
                          }}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: '0.25rem' }}>
                        <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Description</span>
                        <textarea
                          rows={3}
                          value={editedDescriptionText}
                          onChange={(e) => setEditedDescriptionText(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.6rem',
                            borderRadius: '0.5rem',
                            border: '1px solid rgba(0, 243, 255, 0.3)',
                            background: 'rgba(30, 41, 59, 0.7)',
                            color: 'var(--text-color, #f8fafc)',
                            fontSize: '0.9rem',
                            resize: 'vertical'
                          }}
                        />
                      </label>
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                        <button
                          type="button"
                          className="primary-button"
                          style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', background: 'var(--neon-green)', borderColor: 'var(--neon-green)', color: '#000', fontWeight: 'bold' }}
                          onClick={handleUpdateDescription}
                          disabled={saving}
                        >
                          {saving ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                        <button
                          type="button"
                          className="link-button"
                          style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', color: '#94a3b8' }}
                          onClick={() => {
                            setEditingDescription(false)
                            if (activeLevelDetails) {
                              setEditedDescriptionText(activeLevelDetails.level_description || '')
                              setEditedLevelNameText(activeLevelDetails.level_name || '')
                            }
                          }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h4 style={{ margin: 0 }}>{activeLevelDetails?.level_name || `Niveau ${activeLevel}`}</h4>
                        {canManage && activeLevelDetails && (
                          <button
                            type="button"
                            className="link-button"
                            style={{ 
                              padding: '0.25rem 0.5rem', 
                              fontSize: '0.8rem', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.25rem',
                              color: 'var(--neon-blue, #00f3ff)',
                              background: 'rgba(0, 243, 255, 0.1)',
                              border: '1px solid rgba(0, 243, 255, 0.2)',
                              borderRadius: '0.25rem',
                              cursor: 'pointer'
                            }}
                            onClick={() => setEditingDescription(true)}
                          >
                            ✏️ Modifier
                          </button>
                        )}
                      </div>
                      <p>{activeLevelDetails?.level_description || "Description non disponible."}</p>

                      {canManage && activeLevelDetails && (
                        <div style={{ marginTop: '1.25rem', display: 'grid', gap: '0.5rem' }}>
                          <button
                            className="primary-button"
                            style={{ width: 'fit-content', padding: '0.5rem 1.25rem', fontSize: '0.8rem' }}
                            onClick={() => handleSetLevel(activeLevelDetails.id, activeLevel)}
                            disabled={saving}
                          >
                            {saving ? 'Validation...' : `Valider Niveau ${activeLevel}`}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="media-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ position: 'relative', width: '100%', minHeight: '150px' }}>
                    <img
                      key={`${activeCategoryId}-${activeSkillName}-${activeLevel}-${imageTimestamp}`}
                      src={mediaSrc || getMediaPath(activeCategoryId, activeSkillName, activeLevel)}
                      alt="Illustration du test"
                      className="media-content"
                      style={{ display: 'none', borderRadius: '0.75rem', width: '100%' }}
                      onLoad={(e) => {
                        e.currentTarget.style.display = 'block'
                        const p = e.currentTarget.nextElementSibling as HTMLElement
                        if (p) p.style.display = 'none'

                        // Set customImageExists if the loaded URL is our Supabase Storage URL
                        if (e.currentTarget.src.includes('supabase.co')) {
                          setCustomImageExists(true)
                        } else {
                          setCustomImageExists(false)
                        }
                      }}
                      onError={(e) => {
                        const staticPath = getMediaPath(activeCategoryId, activeSkillName, activeLevel)
                        const target = e.currentTarget
                        if (!target.src.endsWith(staticPath)) {
                          target.src = staticPath
                        } else {
                          target.style.display = 'none'
                          const p = target.nextElementSibling as HTMLElement
                          if (p) p.style.display = 'flex'
                        }
                      }}
                    />
                    <div className="media-placeholder" style={{ display: 'flex', width: '100%' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      <p style={{ marginTop: '1rem' }}>Illustration du test</p>
                      <p className="muted" style={{ fontSize: '0.8rem' }}>
                        Image manquante. Utilisez le bouton ci-dessous pour l'ajouter.
                      </p>
                    </div>
                  </div>

                  {canManage && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <label
                        className="skill-tab"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          cursor: 'pointer',
                          padding: '0.5rem 1rem',
                          fontSize: '0.85rem',
                          background: 'rgba(0, 243, 255, 0.1)',
                          border: '1px solid rgba(0, 243, 255, 0.2)',
                          borderRadius: '8px',
                          color: 'var(--neon-cyan)',
                          fontWeight: 600,
                          margin: 0
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        {uploadingImage ? 'Chargement...' : (customImageExists ? "Changer l'image" : 'Ajouter une image')}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => void handleUploadImage(e)}
                          disabled={uploadingImage}
                          style={{ display: 'none' }}
                        />
                      </label>

                      {customImageExists && (
                        <button
                          type="button"
                          className="skill-tab"
                          onClick={() => void handleDeleteImage()}
                          disabled={uploadingImage}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            fontSize: '0.85rem',
                            background: 'rgba(255, 0, 85, 0.12)',
                            border: '1px solid #ff0055',
                            borderRadius: '8px',
                            color: '#ff3366',
                            fontWeight: 600,
                            margin: 0
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Supprimer
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            </div>
          )}
        </>
      ) : (
        <div className="performance-view">
          {canManage && (
            <article className="panel" style={{ marginBottom: '1.5rem' }}>
              <h3 className="eyebrow" style={{ marginBottom: '1rem' }}>Nouvelle Mesure</h3>
              <div className="perf-form">
                <select value={perfType} onChange={(e) => { setPerfType(e.target.value); setPerfUnit(perfTypes.find(t => t.label === e.target.value)?.unit || 's'); }}>
                  {perfTypes.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
                </select>
                <div style={{ position: 'relative' }}>
                  <input type="text" placeholder="Score" value={perfScore} onChange={(e) => setPerfScore(e.target.value)} style={{ paddingRight: '2.5rem' }} />
                  <span className="unit-label">{perfUnit}</span>
                </div>
                <button className="primary-button" onClick={handleSavePerformance} disabled={saving || !perfScore}>Enregistrer</button>
              </div>
            </article>
          )}

          <div className="perf-history-grid">
            <article className="panel">
              <h3 className="eyebrow" style={{ marginBottom: '1rem' }}>Dernières Performances</h3>
              {performanceHistory.length > 0 ? (
                <div className="perf-list">
                  {performanceHistory.map(p => (
                    <div key={p.id} className="perf-item">
                      <div className="perf-info">
                        <strong>{p.type_test}</strong>
                        <span className="date">{new Date(p.date).toLocaleDateString()}</span>
                      </div>
                      <div className="perf-value">
                        {p.score} <span className="u">{perfTypes.find(t => t.label === p.type_test)?.unit || ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="muted">Aucune mesure enregistrée.</p>}
            </article>

            <article className="panel">
              <h3 className="eyebrow" style={{ marginBottom: '1rem' }}>Records Personnels</h3>
              <div className="records-grid">
                {perfTypes.map(type => {
                  const best = performanceHistory
                    .filter(p => p.type_test === type.label)
                    .sort((a, b) => type.unit === 's' ? a.score - b.score : b.score - a.score)[0]
                  return best ? (
                    <div key={type.label} className="record-card">
                      <span>{type.label}</span>
                      <div className="val">{best.score} {type.unit}</div>
                    </div>
                  ) : null
                })}
              </div>
            </article>
          </div>
        </div>
      )}
    </section>
  )
}

function ClubSetupPage({
  userId,
  role,
  needsClubSetup,
}: {
  userId: string
  role: Role | null
  needsClubSetup: boolean
}) {
  const navigate = useNavigate()
  const [clubName, setClubName] = useState('')
  const [clubSlug, setClubSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSignOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  useEffect(() => {
    if (!slugTouched) {
      setClubSlug(slugify(clubName))
    }
  }, [clubName, slugTouched])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return

    if (role !== 'admin' || !needsClubSetup) {
      setError("Acces reserve a l'admin principal (creation de club).")
      return
    }

    const nom = clubName.trim()
    const slug = clubSlug.trim()

    if (!nom) {
      setError('Nom du club requis.')
      return
    }
    if (!slug) {
      setError('Slug requis (ex: soissons-ifc).')
      return
    }

    setBusy(true)
    setError(null)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        throw new Error(`Session: ${formatSupabaseError(sessionError)}`)
      }
      const session = sessionData.session
      if (!session) {
        throw new Error("Session absente/expiree. Reconnecte-toi (bouton 'Se deconnecter' puis connexion) avant d'uploader un logo.")
      }
      if (session.user.id !== userId) {
        throw new Error(
          `Session incoherente: session.user.id=${session.user.id} != userId=${userId}. ` +
          "Deconnecte-toi puis reconnecte-toi avant de refaire l'upload.",
        )
      }
      const jwtPayload = decodeJwtPayload(session.access_token)
      const jwtSub = jwtPayload?.sub
      const jwtRole = jwtPayload?.role

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, needs_club_setup, club_id')
        .eq('id', userId)
        .maybeSingle()
      if (profileError) {
        throw new Error(`Lecture profil: ${formatSupabaseError(profileError)}`)
      }

      const serverRole = (profile as unknown as { role?: unknown } | null)?.role
      const serverNeedsSetup = Boolean((profile as unknown as { needs_club_setup?: unknown } | null)?.needs_club_setup)
      const serverClubId = (profile as unknown as { club_id?: unknown } | null)?.club_id
      if (serverRole !== 'admin' || !serverNeedsSetup || serverClubId) {
        throw new Error(
          "Ton profil n'est pas dans l'etat 'admin principal en setup'. " +
          `Etat actuel: role=${String(serverRole ?? 'null')}, needs_club_setup=${String(serverNeedsSetup)}, club_id=${String(serverClubId ?? 'null')}. ` +
          "Attendu: role=admin, needs_club_setup=true, club_id=null."
        )
      }

      let logoPath: string | null = null
      if (logoFile) {
        const ext = logoFile.name.split('.').pop() || 'png'
        const path = `clubs/${userId}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('club-logos')
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type })
        if (uploadError) {
          const msg = formatSupabaseError(uploadError)
          if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('security policy')) {
            setLogoFile(null)
            throw new Error(
              'Upload logo bloque par RLS (Storage). ' +
              `bucket=club-logos path=${path}. ` +
              'Verifie les policies sur storage.objects (insert/update) et fais un “Reload schema” dans Supabase. ' +
              `JWT: sub=${String(jwtSub ?? 'null')} role=${String(jwtRole ?? 'null')}. ` +
              `Details: ${msg}`,
            )
          }
          setLogoFile(null)
          throw new Error(`Upload logo: ${msg} (bucket=club-logos path=${path})`)
        }
        logoPath = path
      }

      const { data: club, error: clubError } = await supabase
        .from('clubs')
        .insert({ slug, nom, logo_path: logoPath, created_by: userId })
        .select('id, slug, nom, logo_path, chat_restricted')
        .single()
      if (clubError) {
        const msg = formatSupabaseError(clubError)
        if (
          msg.toLowerCase().includes('clubs_slug_key') ||
          msg.toLowerCase().includes('duplicate key value') ||
          String((clubError as unknown as { code?: unknown } | null)?.code ?? '') === '23505'
        ) {
          const suggestion = `${slug}-${Math.random().toString(36).slice(2, 5).toLowerCase()}`
          throw new Error(
            `Ce slug existe deja: "${slug}". Choisis-en un autre (ex: "${suggestion}").`,
          )
        }

        throw new Error(msg)
      }

      const { error: claimError } = await supabase
        .from('profiles')
        .update({ club_id: club.id, needs_club_setup: false })
        .eq('id', userId)
      if (claimError) {
        throw new Error(`Mise a jour profil: ${formatSupabaseError(claimError)}`)
      }

      const categories = ['U9', 'U12', 'U18', 'U21', 'Seniors']
      const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
      const equipesPayload = categories.map((categorie) => ({
        club_id: club.id,
        categorie,
        nom: categorie,
        code_invitation: `${slug.toUpperCase()}-${categorie}-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      }))

      const { error: equipesError } = await supabase.from('equipes').insert(equipesPayload)
      if (equipesError) {
        throw new Error(`Creation equipes: ${formatSupabaseError(equipesError)}`)
      }

      const iconUrl =
        club.logo_path && supabase
          ? supabase.storage.from('club-logos').getPublicUrl(club.logo_path).data.publicUrl
          : null
      applyBranding(club.nom, iconUrl)

      navigate('/dashboard')
    } catch (caught) {
      const message = formatSupabaseError(caught)
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page login-page">
      <header className="page-title">
        <h2>Creation du club</h2>
        <p>Nom + equipes par defaut</p>
        <button type="button" className="btn secondary" onClick={onSignOut}>
          Se deconnecter
        </button>
      </header>

      <form className="panel login-form" onSubmit={onSubmit}>
        <label>
          Nom du club
          <input value={clubName} onChange={(event) => setClubName(event.target.value)} placeholder="Soissons IFC" />
        </label>

        <label>
          Slug (sous-domaine)
          <input
            value={clubSlug}
            onChange={(event) => {
              setSlugTouched(true)
              setClubSlug(slugify(event.target.value))
            }}
            placeholder="soissons-ifc"
          />
        </label>

        <label>
          Logo (optionnel)
          <input type="file" accept="image/*" onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)} />
        </label>

        {error && <p className="form-feedback error">{error}</p>}

        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? 'Creation...' : 'Creer le club'}
        </button>
      </form>
    </section>
  )
}

function SettingsPage({
  currentRole,
  userId,
  club,
  setClub,
}: {
  currentRole: Role | null
  userId: string | null
  club: ClubRow | null
  setClub: (next: ClubRow | null) => void
}) {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState(true)
  const [profileRole, setProfileRole] = useState<Role | null>(currentRole)
  const [teams, setTeams] = useState<Array<{ id: string; nom: string; categorie: string }>>([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Category management states
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryValue, setNewCategoryValue] = useState('U13')
  const [categoryBusy, setCategoryBusy] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [categoryInfo, setCategoryInfo] = useState<string | null>(null)

  // Chat reset target state
  const [resetTarget, setResetTarget] = useState<string>('global')

  const [inviteRole, setInviteRole] = useState<Role>('joueur')
  const [superAdminInviteKind, setSuperAdminInviteKind] = useState<'super_admin' | 'club_admin_create'>(
    'club_admin_create',
  )
  const [inviteTeamId, setInviteTeamId] = useState<string>('')
  const [inviteCode, setInviteCode] = useState<string>('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteInfo, setInviteInfo] = useState<string | null>(null)

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [logoInfo, setLogoInfo] = useState<string | null>(null)

  const [clubNameDraft, setClubNameDraft] = useState('')
  const [clubNameBusy, setClubNameBusy] = useState(false)
  const [clubNameError, setClubNameError] = useState<string | null>(null)
  const [clubNameInfo, setClubNameInfo] = useState<string | null>(null)

  const [chatRestrictedDraft, setChatRestrictedDraft] = useState<boolean>(Boolean(club?.chat_restricted))
  const [chatBusy, setChatBusy] = useState(false)
  const [chatResetBusy, setChatResetBusy] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [chatInfo, setChatInfo] = useState<string | null>(null)

  const clubLogoUrl = useMemo(() => {
    if (!supabase) return null
    if (!club?.logo_path) return null
    return supabase.storage.from('club-logos').getPublicUrl(club.logo_path).data.publicUrl
  }, [club?.logo_path])

  const uploadClubLogo = async () => {
    setLogoError(null)
    setLogoInfo(null)

    if (!supabase || !userId || !club?.id || !logoFile) {
      if (!logoFile) setLogoError('Sélectionne une image')
      else setLogoError('Configuration manquante')
      return
    }

    setLogoBusy(true)
    try {
      const ext = logoFile.name.split('.').pop() || 'png'
      // Use club_id in path instead of user_id — more stable and avoids RLS edge cases
      const path = `clubs/${club.id}/logo-${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('club-logos')
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type })

      if (uploadError) {
        throw new Error(`Upload logo: ${formatSupabaseError(uploadError)}`)
      }

      const { data: updatedClub, error: updateError } = await supabase
        .from('clubs')
        .update({ logo_path: path })
        .eq('id', club.id)
        .select('id, slug, nom, logo_path, chat_restricted')
        .single()

      if (updateError) {
        throw new Error(`Mise à jour club: ${formatSupabaseError(updateError)}`)
      }

      const nextClub = (updatedClub as ClubRow) ?? null
      setClub(nextClub)
      setLogoFile(null)

      const iconUrl = nextClub.logo_path
        ? supabase.storage.from('club-logos').getPublicUrl(nextClub.logo_path).data.publicUrl
        : null
      applyBranding(nextClub.nom, iconUrl)

      setLogoInfo('Logo mis à jour ✓')
    } catch (caught) {
      setLogoError(formatSupabaseError(caught))
    } finally {
      setLogoBusy(false)
    }
  }

  const updateClubName = async () => {
    setClubNameError(null)
    setClubNameInfo(null)

    if (!supabase) {
      setClubNameError("Supabase n'est pas configure")
      return
    }

    if (profileRole !== 'admin') {
      setClubNameError('Acces reserve aux admins')
      return
    }

    if (!club?.id) {
      setClubNameError('Club non configure')
      return
    }

    const nextName = clubNameDraft.trim()
    if (!nextName) {
      setClubNameError('Nom du club requis')
      return
    }

    setClubNameBusy(true)
    try {
      const { data: updatedClub, error: updateError } = await supabase
        .from('clubs')
        .update({ nom: nextName })
        .eq('id', club.id)
        .select('id, slug, nom, logo_path, chat_restricted')
        .single()

      if (updateError) {
        throw new Error(`Mise a jour club: ${formatSupabaseError(updateError)}`)
      }

      const nextClub = (updatedClub as ClubRow) ?? null
      setClub(nextClub)

      const iconUrl = nextClub.logo_path
        ? supabase.storage.from('club-logos').getPublicUrl(nextClub.logo_path).data.publicUrl
        : null
      applyBranding(nextClub.nom, iconUrl)

      setClubNameInfo('Nom du club mis a jour')
    } catch (caught) {
      setClubNameError(formatSupabaseError(caught))
    } finally {
      setClubNameBusy(false)
    }
  }

  useEffect(() => {
    setProfileRole(currentRole)
  }, [currentRole])

  useEffect(() => {
    setClubNameDraft(club?.nom ?? '')
  }, [club?.nom])

  useEffect(() => {
    setChatRestrictedDraft(Boolean(club?.chat_restricted))
  }, [club?.chat_restricted])

  const persistChatRestriction = async (nextValue: boolean) => {
    setChatError(null)
    setChatInfo(null)

    if (!supabase) {
      setChatError("Supabase n'est pas configure")
      return
    }

    if (!club?.id) {
      setChatError('Club non configure')
      return
    }

    if (profileRole !== 'admin') {
      setChatError('Acces reserve aux admins')
      return
    }

    setChatBusy(true)
    try {
      const { error: rpcError } = await supabase.rpc('set_chat_restricted', {
        p_club_id: club.id,
        p_value: nextValue,
      })
      if (rpcError) {
        throw rpcError
      }

      const { data: refreshed, error: refreshError } = await supabase
        .from('clubs')
        .select('id, slug, nom, logo_path, chat_restricted')
        .eq('id', club.id)
        .maybeSingle()
      if (refreshError) {
        throw refreshError
      }

      const nextClub = (refreshed as ClubRow | null) ?? null
      if (nextClub) {
        setClub(nextClub)
      }

      setChatRestrictedDraft(nextValue)
      setChatInfo(nextValue ? 'Chat restreint active' : 'Chat restreint desactive')
    } catch (caught) {
      setChatRestrictedDraft(Boolean(club?.chat_restricted))
      setChatError(formatSupabaseError(caught))
    } finally {
      setChatBusy(false)
    }
  }

  const resetChat = async () => {
    setChatError(null)
    setChatInfo(null)

    if (!supabase || !club?.id) {
      setChatError('Configuration manquante')
      return
    }

    // Admins et coachs peuvent réinitialiser le chat
    if (profileRole !== 'admin' && profileRole !== 'coach') {
      setChatError('Accès réservé aux admins et coachs')
      return
    }

    const confirmReset = window.confirm(
      "Voulez-vous vraiment vider l'historique de cette discussion ? Cette action est irréversible."
    )
    if (!confirmReset) return

    setChatResetBusy(true)
    try {
      const targetEquipeId = resetTarget === 'global' ? null : resetTarget
      const { error: rpcError } = await supabase.rpc('reset_chat_v2', {
        p_club_id: club.id,
        p_equipe_id: targetEquipeId,
      })
      if (rpcError) {
        throw rpcError
      }
      setChatInfo('Historique du chat vidé avec succès ✓')
    } catch (caught) {
      setChatError(formatSupabaseError(caught))
    } finally {
      setChatResetBusy(false)
    }
  }

  useEffect(() => {
    if (!supabase) {
      return
    }

    if (!userId) {
      return
    }

    if (profileRole !== 'coach') {
      return
    }

    let ignore = false

    void (async () => {
      const { data, error } = await supabase.rpc('my_profile')
      if (error) {
        return
      }
      const row = Array.isArray(data) ? data[0] : null
      const equipeId = (row?.equipe_id as string | null) ?? ''
      if (!ignore && equipeId) {
        setInviteTeamId(equipeId)
        setResetTarget(equipeId)
      }
    })()

    return () => {
      ignore = true
    }
  }, [profileRole, userId])

  useEffect(() => {
    if (!supabase) {
      return
    }

    if (profileRole !== 'admin') {
      return
    }

    if (!club?.id) {
      setTeams([])
      return
    }

    let ignore = false

    void (async () => {
      const { data: equipes } = await supabase
        .from('equipes')
        .select('id, nom, categorie')
        .eq('club_id', club.id)
        .order('categorie')
      if (!ignore && equipes) {
        setTeams(equipes)
        if (!inviteTeamId && equipes.length) {
          setInviteTeamId(equipes[0].id)
        }
      }
    })()

    return () => {
      ignore = true
    }
  }, [club?.id, inviteTeamId, profileRole, refreshTrigger])

  const handleCreateCategory = async () => {
    setCategoryError(null)
    setCategoryInfo(null)

    if (!supabase || !club?.id) {
      setCategoryError('Configuration manquante')
      return
    }

    const nom = newCategoryName.trim()
    const cat = newCategoryValue.trim()
    if (!nom) {
      setCategoryError('Nom de l’équipe requis (ex: "Équipe A")')
      return
    }
    if (!cat) {
      setCategoryError('Nom de la catégorie requis (ex: "U13")')
      return
    }

    setCategoryBusy(true)
    try {
      const invitationPrefix = club.slug.toUpperCase()
      const suffix = Math.random().toString(36).slice(2, 7).toUpperCase()
      const code = `${invitationPrefix}-JOIN-${cat.toUpperCase()}-${suffix}`

      const { error } = await supabase
        .from('equipes')
        .insert({
          club_id: club.id,
          nom,
          categorie: cat,
          code_invitation: code,
        })

      if (error) throw error

      setCategoryInfo(`Catégorie ${cat} (${nom}) créée avec succès ✓`)
      setNewCategoryName('')
      setRefreshTrigger((prev) => prev + 1)
    } catch (caught) {
      setCategoryError(formatSupabaseError(caught))
    } finally {
      setCategoryBusy(false)
    }
  }

  const handleDeleteCategory = async (teamId: string, teamLabel: string) => {
    setCategoryError(null)
    setCategoryInfo(null)

    if (!supabase || !club?.id) {
      setCategoryError('Configuration manquante')
      return
    }

    const confirmDelete = window.confirm(`Voulez-vous vraiment supprimer la catégorie "${teamLabel}" ? Cela supprimera tous les joueurs, entraînements, matchs et messages associés.`)
    if (!confirmDelete) return

    setCategoryBusy(true)
    try {
      const { error } = await supabase
        .from('equipes')
        .delete()
        .eq('id', teamId)

      if (error) throw error

      setCategoryInfo(`Catégorie "${teamLabel}" supprimée ✓`)
      setRefreshTrigger((prev) => prev + 1)
    } catch (caught) {
      setCategoryError(formatSupabaseError(caught))
    } finally {
      setCategoryBusy(false)
    }
  }

  const generateInviteCode = (prefix: string, role: Role) => {
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase()
    return `${prefix}-${role.toUpperCase()}-${stamp}-${suffix}`
  }

  const formatInviteError = (caught: unknown) => {
    const message = formatSupabaseError(caught)
    if (
      message.includes('PGRST204') &&
      message.includes("'invitation_codes'") &&
      (message.includes("'club_id'") || message.includes('club_id'))
    ) {
      return (
        "Ta base Supabase n'est pas a jour: la colonne club_id manque sur invitation_codes. " +
        'Applique la migration (alter table invitation_codes add column club_id ...) puis recharge le schema API.'
      )
    }
    return message
  }

  const createInvite = async () => {
    setInviteError(null)
    setInviteInfo(null)
    setInviteCode('')

    if (!supabase) {
      setInviteError("Supabase n'est pas configure")
      return
    }

    if (!userId) {
      setInviteError('Utilisateur non connecte')
      return
    }

    if (profileRole === 'super_admin') {
      const targetRole: Role = superAdminInviteKind === 'super_admin' ? 'super_admin' : 'admin'
      const code = generateInviteCode('PLATFORM', targetRole)
      setInviteBusy(true)
      try {
        const payload = {
          code,
          kind: superAdminInviteKind,
          role: targetRole,
          club_id: null,
          equipe_id: null,
          active: true,
          max_uses: 1,
          used_count: 0,
          created_by: userId,
        }

        const { error } = await supabase.from('invitation_codes').insert(payload)
        if (error) {
          throw error
        }

        setInviteCode(code)
        setInviteInfo(
          superAdminInviteKind === 'super_admin'
            ? 'Code cree (admin general).'
            : 'Code cree (admin principal de club).',
        )
      } catch (caught) {
        setInviteError(formatInviteError(caught))
      } finally {
        setInviteBusy(false)
      }
      return
    }

    if (profileRole !== 'admin' && profileRole !== 'coach') {
      setInviteError('Acces reserve aux admins/coachs')
      return
    }

    if (!club?.id) {
      setInviteError('Club non configure')
      return
    }

    if (inviteRole === 'super_admin') {
      setInviteError('Role invalide')
      return
    }

    if (profileRole === 'coach' && inviteRole === 'admin') {
      setInviteError('Un coach ne peut pas inviter un admin.')
      return
    }

    const requiresTeam = inviteRole === 'coach' || inviteRole === 'joueur'
    if (requiresTeam && !inviteTeamId) {
      setInviteError("Equipe requise pour ce role")
      return
    }

    const code = generateInviteCode(club.slug.toUpperCase(), inviteRole)
    setInviteBusy(true)
    try {
      const payload = {
        code,
        kind: 'club_member',
        role: inviteRole,
        club_id: club.id,
        equipe_id: requiresTeam ? inviteTeamId : null,
        active: true,
        max_uses: 1,
        used_count: 0,
        created_by: userId,
      }

      const { error } = await supabase.from('invitation_codes').insert(payload)
      if (error) {
        throw error
      }

      setInviteCode(code)
      setInviteInfo('Code cree (1 seule utilisation).')
    } catch (caught) {
      setInviteError(formatInviteError(caught))
    } finally {
      setInviteBusy(false)
    }
  }

  const signOut = async () => {
    if (!supabase) {
      return
    }
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  return (
    <section className="page settings-page">
      <header className="page-title">
        <h2>{profileRole === 'super_admin' ? 'Parametres plateforme' : 'Parametres du club'}</h2>
        <p>{profileRole === 'super_admin' ? 'Administration globale' : club?.nom ?? 'Administration et personnalisation'}</p>
      </header>

      <div className="settings-grid">
        {profileRole !== 'super_admin' && (
          <article className="panel setting-card">
            <h3>Club</h3>
            {club ? (
              <div className="club-card">
                <div className={`club-mark ${clubLogoUrl ? 'club-logo' : 'club-text'}`}>
                  {clubLogoUrl ? (
                    <img src={clubLogoUrl} alt={club.nom ? `Logo ${club.nom}` : 'Logo club'} />
                  ) : (
                    club.nom
                  )}
                </div>
                <div>
                  <p>{`${club.nom} (${club.slug})`}</p>
                  <p className="muted">{club.logo_path ? `Logo: ${club.logo_path}` : 'Logo: non defini'}</p>
                </div>
              </div>
            ) : (
              <p>Aucun club associe</p>
            )}

            {profileRole === 'admin' && club && (
              <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.65rem' }}>
                <label>
                  Nom du club
                  <input
                    value={clubNameDraft}
                    onChange={(event) => {
                      setClubNameError(null)
                      setClubNameInfo(null)
                      setClubNameDraft(event.target.value)
                    }}
                    disabled={clubNameBusy}
                  />
                </label>

                {clubNameError && <p className="form-feedback error">{clubNameError}</p>}
                {clubNameInfo && <p className="form-feedback info">{clubNameInfo}</p>}

                <button type="button" className="primary-button" onClick={updateClubName} disabled={clubNameBusy}>
                  {clubNameBusy ? 'Mise a jour...' : 'Mettre a jour le nom'}
                </button>

                <label>
                  Changer le logo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      setLogoError(null)
                      setLogoInfo(null)
                      setLogoFile(event.target.files?.[0] ?? null)
                    }}
                    disabled={logoBusy}
                  />
                </label>

                {logoError && <p className="form-feedback error">{logoError}</p>}
                {logoInfo && <p className="form-feedback info">{logoInfo}</p>}

                <button type="button" className="primary-button" onClick={uploadClubLogo} disabled={logoBusy}>
                  {logoBusy ? 'Upload...' : 'Uploader le logo'}
                </button>
              </div>
            )}
          </article>
        )}

        {profileRole === 'admin' && (
          <article className="panel setting-card">
            <h3>Catégories du Club</h3>
            <p className="muted">Gérez les catégories (équipes) de votre club.</p>

            {categoryError && <p className="form-feedback error">{categoryError}</p>}
            {categoryInfo && <p className="form-feedback info">{categoryInfo}</p>}

            <div className="teams-list-admin" style={{ margin: '1rem 0', maxHeight: '200px', overflowY: 'auto', display: 'grid', gap: '0.5rem' }}>
              {teams.length === 0 ? (
                <p className="muted">Aucune catégorie créée pour le moment.</p>
              ) : (
                teams.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px' }}>
                    <div>
                      <strong>{t.categorie}</strong> <span className="muted">— {t.nom}</span>
                    </div>
                    <button
                      type="button"
                      className="link-button"
                      style={{ color: '#ef4444', padding: '0.25rem 0.5rem' }}
                      onClick={() => void handleDeleteCategory(t.id, `${t.categorie} — ${t.nom}`)}
                      disabled={categoryBusy}
                    >
                      Supprimer
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'grid', gap: '0.65rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '1rem' }}>
              <h4>Nouvelle catégorie</h4>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <label style={{ flex: 1 }}>
                  Catégorie (ex: U13, U15)
                  <input
                    value={newCategoryValue}
                    placeholder="U13"
                    onChange={(e) => setNewCategoryValue(e.target.value)}
                    disabled={categoryBusy}
                  />
                </label>
                <label style={{ flex: 2 }}>
                  Nom de l'équipe (ex: Équipe A)
                  <input
                    value={newCategoryName}
                    placeholder="Équipe A"
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    disabled={categoryBusy}
                  />
                </label>
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={() => void handleCreateCategory()}
                disabled={categoryBusy}
              >
                {categoryBusy ? 'Création...' : 'Ajouter la catégorie'}
              </button>
            </div>
          </article>
        )}

        {profileRole !== 'super_admin' && club && (profileRole === 'admin' || profileRole === 'coach') && (
          <article className="panel setting-card">
            <h3>Chat</h3>

            {profileRole === 'admin' && (
              <>
                <p className="muted">Option: réserver le chat aux coachs/admins.</p>
                <label className="toggle-row" style={{ marginBottom: '1.25rem' }}>
                  <span>Chat restreint</span>
                  <input
                    type="checkbox"
                    checked={chatRestrictedDraft}
                    disabled={chatBusy || chatResetBusy}
                    onChange={(event) => {
                      const nextValue = event.target.checked
                      setChatRestrictedDraft(nextValue)
                      void persistChatRestriction(nextValue)
                    }}
                  />
                </label>
              </>
            )}

            <div style={{ display: 'grid', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <label>
                Discussion à réinitialiser
                {profileRole === 'admin' ? (
                  <select value={resetTarget} onChange={(e) => setResetTarget(e.target.value)} disabled={chatResetBusy}>
                    <option value="global">Chat général du club</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        Chat équipe {t.categorie} — {t.nom}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select value={resetTarget} disabled={true}>
                    <option value={resetTarget}>Mon équipe</option>
                  </select>
                )}
              </label>
            </div>

            {chatError && <p className="form-feedback error">{chatError}</p>}
            {chatInfo && <p className="form-feedback info">{chatInfo}</p>}

            <div className="invite-actions">
              <button type="button" className="primary-button" onClick={() => void resetChat()} disabled={chatResetBusy} style={{ background: '#ef4444', borderColor: '#ef4444' }}>
                {chatResetBusy ? 'Réinitialisation...' : 'Réinitialiser le chat'}
              </button>
            </div>
          </article>
        )}
        <article className="panel setting-card">
          <h3>Notifications</h3>
          <label className="toggle-row">
            <span>Alertes matchs et tests</span>
            <input
              type="checkbox"
              checked={notifications}
              onChange={() => setNotifications((value) => !value)}
            />
          </label>
        </article>

        {profileRole === 'super_admin' && (
          <article className="panel setting-card">
            <h3>Invitations (Admin general)</h3>
            <p>Cree des codes a usage unique pour des admins generaux ou des admins principaux de club.</p>

            <div className="invite-grid">
              <label>
                Type
                <select
                  value={superAdminInviteKind}
                  onChange={(event) => setSuperAdminInviteKind(event.target.value as 'super_admin' | 'club_admin_create')}
                >
                  <option value="club_admin_create">Admin principal (creer un club)</option>
                  <option value="super_admin">Admin general (plateforme)</option>
                </select>
              </label>
            </div>

            {inviteError && <p className="form-feedback error">{inviteError}</p>}
            {inviteInfo && <p className="form-feedback info">{inviteInfo}</p>}

            {inviteCode && (
              <div className="invite-code-box" role="status">
                <strong>Code:</strong> <span>{inviteCode}</span>
              </div>
            )}

            <div className="invite-actions">
              <button type="button" className="primary-button" onClick={createInvite} disabled={inviteBusy}>
                {inviteBusy ? 'Creation...' : 'Generer un code'}
              </button>
            </div>
          </article>
        )}

        {(profileRole === 'admin' || profileRole === 'coach') && (
          <article className="panel setting-card">
            <h3>{profileRole === 'admin' ? 'Invitations (Admin)' : 'Invitations (Coach)'}</h3>
            <p>
              {profileRole === 'admin'
                ? 'Cree des codes a usage unique pour Admin/Coach/Joueur/Parent.'
                : 'Cree des codes a usage unique pour Coach/Joueur/Parent de ta categorie.'}
            </p>

            <div className="invite-grid">
              <label>
                Role
                <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Role)}>
                  {profileRole === 'admin' && <option value="admin">Admin</option>}
                  <option value="coach">Coach</option>
                  <option value="joueur">Joueur</option>
                  <option value="parent">Parent</option>
                </select>
              </label>

              {profileRole === 'admin' && (inviteRole === 'coach' || inviteRole === 'joueur') && (
                <label>
                  Equipe
                  <select value={inviteTeamId} onChange={(event) => setInviteTeamId(event.target.value)}>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.categorie} - {team.nom}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {profileRole === 'coach' && (
                <div className="muted" style={{ alignSelf: 'end' }}>
                  Equipe: ta categorie
                </div>
              )}
            </div>

            {inviteError && <p className="form-feedback error">{inviteError}</p>}
            {inviteInfo && <p className="form-feedback info">{inviteInfo}</p>}

            {inviteCode && (
              <div className="invite-code-box" role="status">
                <strong>Code:</strong> <span>{inviteCode}</span>
              </div>
            )}

            <div className="invite-actions">
              <button type="button" className="primary-button" onClick={createInvite} disabled={inviteBusy}>
                {inviteBusy ? 'Creation...' : 'Generer un code'}
              </button>
            </div>
          </article>
        )}

        {supabase && (
          <article className="panel setting-card">
            <h3>Session</h3>
            <button type="button" className="link-button" onClick={signOut}>
              Se deconnecter
            </button>
          </article>
        )}
      </div>
    </section>
  )
}

function BottomNav({ role }: { role: Role | null }) {
  const isSuperAdmin = role === 'super_admin'
  const isParent = role === 'parent'
  return (
    <nav className="bottom-nav">
      {!isSuperAdmin && <NavLink to="/dashboard">Accueil</NavLink>}
      {!isSuperAdmin && !isParent && <NavLink to="/team">Equipe</NavLink>}
      {!isSuperAdmin && <NavLink to="/strategy">Stratégie</NavLink>}
      {!isSuperAdmin && <NavLink to="/events">Evenements</NavLink>}
      {!isSuperAdmin && <NavLink to="/chat">Chat</NavLink>}
      {!isSuperAdmin && <NavLink to="/tests">Tests</NavLink>}
      <NavLink to="/settings">Parametres</NavLink>
    </nav>
  )
}

function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const hideBottomNav =
    location.pathname === '/' || location.pathname === '/reset-password' || location.pathname === '/club-setup'

  const [authReady, setAuthReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [profileReady, setProfileReady] = useState(false)
  const [role, setRole] = useState<Role | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [authorName, setAuthorName] = useState<string | null>(null)
  const [equipe, setEquipe] = useState<EquipeRow | null>(null)
  const [allClubTeams, setAllClubTeams] = useState<EquipeRow[]>([])
  const [selectedEquipeId, setSelectedEquipeId] = useState<string | null>(null)
  const [club, setClub] = useState<ClubRow | null>(null)
  const [needsClubSetup, setNeedsClubSetup] = useState(false)

  // Parent children context
  const [parentChildren, setParentChildren] = useState<Array<{ id: string; nom: string; equipe_id: string | null; team_name: string; team_category: string; is_approved: boolean }>>([])
  const [activeChildId, setActiveChildId] = useState<string>('')

  const refreshParentChildren = async (pUserId?: string, pRole?: string | null) => {
    const currentUserId = pUserId || userId
    const currentRole = pRole !== undefined ? pRole : role
    if (!supabase || currentRole !== 'parent' || !currentUserId) {
      setParentChildren([])
      setActiveChildId('')
      return
    }

    const { data: links, error: linksError } = await supabase
      .from('parent_children')
      .select('*, profiles!child_id(*, equipes(id, nom, categorie))')
      .eq('parent_id', currentUserId)

    if (linksError || !links) {
      setParentChildren([])
      setActiveChildId('')
      return
    }

    const childrenList = links
      .map((l: any) => {
        const p = l.profiles
        if (!p) return null
        return {
          id: p.id,
          nom: p.nom,
          equipe_id: p.equipe_id,
          is_approved: p.is_approved,
          team_name: p.equipes ? `${p.equipes.nom} (${p.equipes.categorie})` : 'Sans équipe',
          team_category: p.equipes ? p.equipes.categorie : '',
        }
      })
      .filter(Boolean)

    setParentChildren(childrenList)
    if (childrenList.length > 0) {
      const approved = childrenList.find((c) => c.is_approved)
      setActiveChildId((prev) => {
        if (prev && childrenList.some((c) => c.id === prev)) return prev
        return approved ? approved.id : childrenList[0].id
      })
    } else {
      setActiveChildId('')
    }
  }

  useEffect(() => {
    if (!supabase) {
      setSignedIn(true)
      setAuthReady(true)
      setProfileReady(true)
      setRole('admin')
      setUserId(null)
      setEquipe(null)
      setClub(null)
      setNeedsClubSetup(false)
      return
    }

    let ignore = false

    void supabase.auth.getSession().then(({ data }) => {
      if (ignore) return
      setSignedIn(Boolean(data.session))
      setAuthReady(true)
      setUserId(data.session?.user.id ?? null)
      setProfileReady(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session))
      setUserId(session?.user.id ?? null)
      setProfileReady(false)
    })

    return () => {
      ignore = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      return
    }

    if (!authReady || !signedIn || !userId) {
      setRole(null)
      setAuthorName(null)
      setEquipe(null)
      setClub(null)
      setNeedsClubSetup(false)
      setProfileReady(false)
      setParentChildren([])
      setActiveChildId('')
      return
    }

    let ignore = false

    void (async () => {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, nom, club_id, needs_club_setup, equipe_id')
        .eq('id', userId)
        .maybeSingle()

      // Compat: si la DB n'a pas encore les colonnes multi-club, on retombe sur un select minimal.
      if (profileError) {
        const { data: minimalProfileData } = await supabase
          .from('profiles')
          .select('id, role, nom, equipe_id')
          .eq('id', userId)
          .maybeSingle()

        if (ignore) return

        const minimal = (minimalProfileData as unknown as ProfileRow | null) ?? null
        setRole(minimal?.role ?? null)
        setAuthorName(minimal?.nom ?? null)
        setNeedsClubSetup(false)
        setClub(null)
        setProfileReady(true)

        if (!minimal?.equipe_id) {
          setEquipe(null)
          return
        }

        const { data: equipeData } = await supabase
          .from('equipes')
          .select('id, nom, categorie, strategy_shared, strategy_zoom')
          .eq('id', minimal.equipe_id)
          .maybeSingle()

        if (!ignore) {
          setEquipe((equipeData as EquipeRow | null) ?? null)
        }
        return
      }

      if (ignore) return

      const nextProfile = (profileData as ProfileRow | null) ?? null
      setRole(nextProfile?.role ?? null)
      setAuthorName(nextProfile?.nom ?? null)
      setNeedsClubSetup(Boolean(nextProfile?.needs_club_setup))
      setProfileReady(true)

      if (nextProfile?.role === 'parent') {
        void refreshParentChildren(userId, nextProfile.role)
      }

      if (nextProfile?.club_id) {
        const { data: clubData } = await supabase
          .from('clubs')
          .select('id, slug, nom, logo_path, chat_restricted')
          .eq('id', nextProfile.club_id)
          .maybeSingle()
        const nextClub = (clubData as ClubRow | null) ?? null
        setClub(nextClub)

        if (nextClub?.id) {
          // Si admin, on charge toutes les équipes du club
          if (nextProfile.role === 'admin' || nextProfile.role === 'super_admin') {
            const { data: teamsData } = await supabase
              .from('equipes')
              .select('id, nom, categorie')
              .eq('club_id', nextClub.id)
              .order('categorie')
            setAllClubTeams((teamsData as EquipeRow[]) ?? [])

            // Si l'admin n'a pas encore choisi d'équipe, on prend la première
            if (!selectedEquipeId && teamsData && teamsData.length > 0) {
              setSelectedEquipeId(teamsData[0].id)
            }
          }
        }

        if (nextClub?.nom) {
          const iconUrl =
            nextClub.logo_path && supabase
              ? supabase.storage.from('club-logos').getPublicUrl(nextClub.logo_path).data.publicUrl
              : null
          applyBranding(nextClub.nom, iconUrl)
        }
      } else {
        setClub(null)
      }

      // Déterminer l'équipe active
      const targetEquipeId = (nextProfile?.role === 'admin' || nextProfile?.role === 'super_admin')
        ? selectedEquipeId
        : nextProfile?.equipe_id

      if (!targetEquipeId) {
        setEquipe(null)
        return
      }

      const { data: equipeData } = await supabase
        .from('equipes')
        .select('id, nom, categorie, strategy_shared, strategy_zoom')
        .eq('id', targetEquipeId)
        .maybeSingle()

      if (!ignore) {
        setEquipe((equipeData as EquipeRow | null) ?? null)
      }
    })()

    return () => {
      ignore = true
    }
  }, [authReady, signedIn, userId, selectedEquipeId])

  const canAccess = (path: string, userRole: Role | null, needsSetup: boolean) => {
    if (path === '/') return true
    if (path === '/reset-password') return true
    if (path === '/club-setup') return Boolean(userRole)
    if (!userRole) return false
    if (needsSetup) {
      return path === '/club-setup' || path === '/settings'
    }
    if (userRole === 'super_admin') return true
    if (userRole === 'admin') return true
    if (userRole === 'coach') return true
    if (userRole === 'parent') {
      return path === '/dashboard' || path === '/events' || path === '/chat' || path === '/tests' || path === '/strategy' || path === '/settings'
    }
    // joueur
    return path === '/dashboard' || path === '/events' || path === '/chat' || path === '/tests' || path === '/team' || path === '/strategy' || path === '/settings'
  }

  useEffect(() => {
    if (!supabase) {
      return
    }

    if (!authReady) {
      return
    }

    if (!signedIn && location.pathname !== '/') {
      if (location.pathname === '/reset-password') {
        return
      }
      navigate('/')
    }
  }, [authReady, location.pathname, navigate, signedIn])

  useEffect(() => {
    if (!supabase) {
      return
    }
    if (!authReady) {
      return
    }
    if (location.pathname === '/') {
      return
    }

    // Tant qu'on n'a pas le profil (role), on évite les redirections en boucle.
    if (signedIn && !profileReady) {
      return
    }

    // Si pas connecte (ou role introuvable), retour au login plutot que /events.
    if (!signedIn) {
      if (location.pathname === '/reset-password') {
        return
      }
      if (location.pathname !== '/') {
        navigate('/', { replace: true })
      }
      return
    }

    if (signedIn && profileReady && !role) {
      navigate('/', { replace: true })
      return
    }

    if (!canAccess(location.pathname, role, needsClubSetup)) {
      if (needsClubSetup) {
        navigate('/club-setup')
      } else if (role === 'super_admin') {
        navigate('/dashboard')
      } else {
        navigate('/events')
      }
    }
  }, [authReady, location.pathname, navigate, needsClubSetup, profileReady, role, signedIn])

  useEffect(() => {
    if (!supabase) {
      return
    }
    if (!authReady || !signedIn) {
      return
    }
    if (!needsClubSetup) {
      return
    }
    if (location.pathname === '/club-setup') {
      return
    }
    navigate('/club-setup')
  }, [authReady, location.pathname, navigate, needsClubSetup, signedIn])

  // Sync selectedEquipeId from profile or first team
  useEffect(() => {
    if (role === 'admin' && allClubTeams.length > 0 && !selectedEquipeId) {
      setSelectedEquipeId(allClubTeams[0].id)
    }
  }, [role, allClubTeams, selectedEquipeId])

  return (
    <div className="app-shell">
      <div className="ambient-lights" aria-hidden="true" />

      {/* Header global avec sélecteur d'équipe pour l'admin */}
      {!hideBottomNav && (role === 'admin' || role === 'super_admin') && allClubTeams.length > 0 && (
        <header className="global-team-selector">
          <div className="selector-content">
            <span className="muted">Équipe active :</span>
            <select
              value={selectedEquipeId ?? ''}
              onChange={(e) => setSelectedEquipeId(e.target.value)}
              className="team-select"
            >
              {allClubTeams.map(t => (
                <option key={t.id} value={t.id}>{t.categorie} - {t.nom}</option>
              ))}
            </select>
          </div>
        </header>
      )}

      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/club-setup"
          element={userId ? <ClubSetupPage userId={userId} role={role} needsClubSetup={needsClubSetup} /> : <LoginPage />}
        />
        <Route path="/dashboard" element={<DashboardPage club={club} role={role} equipe={equipe} userId={userId} authorName={authorName} parentChildren={parentChildren} activeChildId={activeChildId} setActiveChildId={setActiveChildId} refreshParentChildren={refreshParentChildren} />} />
        <Route path="/team" element={<TeamPage club={club} equipe={equipe} role={role} />} />
        <Route path="/strategy" element={<StrategyPage club={club} equipe={equipe} role={role} parentChildren={parentChildren} activeChildId={activeChildId} />} />
        <Route path="/events" element={<EventsPage equipe={equipe} userId={userId} club={club} role={role} parentChildren={parentChildren} activeChildId={activeChildId} />} />
        <Route path="/chat" element={<ChatPage club={club} authorName={authorName} userId={userId} role={role} equipe={equipe} parentChildren={parentChildren} activeChildId={activeChildId} />} />
        <Route path="/tests" element={<TestsPage userId={userId} role={role} club={club} equipe={equipe} parentChildren={parentChildren} activeChildId={activeChildId} />} />
        <Route path="/settings" element={<SettingsPage currentRole={role} userId={userId} club={club} setClub={setClub} />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>

      {!hideBottomNav && <BottomNav role={role} />}
    </div>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'white', background: 'red', minHeight: '100vh' }}>
          <h2>Erreur d'application détectée</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '1rem', marginTop: '1rem' }}>{this.state.error?.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', marginTop: '1rem', color: '#ffaaaa' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  )
}
