/**
 * Name validation for the leaderboard.
 *
 * Names are public and this game's audience is young, so the default is a
 * generated signage name and anything a player types has to survive this.
 * Validation is server-side only — a client-side check is decoration.
 *
 * The blocklist below is deliberately compact and WILL need extending. Treat a
 * name that gets through as a bug report, not as an argument that filtering is
 * pointless. Length is capped hard because 12 characters of [A-Z0-9-] is a
 * genuinely small space to be offensive in, and that cap does more work than
 * the list does.
 */

/** Uppercase, alphanumeric and single interior hyphens. No unicode. */
const SHAPE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/
const MIN_LEN = 3
const MAX_LEN = 12

/**
 * Characters commonly substituted to slip a word past a filter. Applied before
 * matching so `n1gg4` and `nigga` normalise to the same string.
 */
const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '2': 'z',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'i',
  '+': 't',
}

/**
 * Substrings that disqualify a name. Slurs and sexual terms, kept to stems so
 * that suffixes and prefixes are caught by the substring test.
 */
const BLOCKED: readonly string[] = [
  // racial and ethnic slurs
  'nigg', 'nigr', 'negr', 'chink', 'gook', 'kike', 'spic', 'wetback',
  'paki', 'coon', 'raghead', 'towelhead', 'beaner', 'jigab', 'darkie',
  'gypo', 'gyppo', 'abo',
  // sexuality and gender slurs
  'faggot', 'fagot', 'fag', 'dyke', 'tranny', 'shemale', 'ladyboy',
  // ability slurs
  'retard', 'tard', 'spastic', 'mongoloid',
  // sexual content
  'fuck', 'fuk', 'phuck', 'shit', 'cunt', 'twat', 'wank', 'bitch',
  'whore', 'slut', 'rape', 'rapist', 'pedo', 'paedo', 'incest',
  'cock', 'dick', 'penis', 'vagina', 'pussy', 'anus', 'anal', 'cum',
  'blowjob', 'handjob', 'porn', 'boob', 'tits', 'titties',
  // hate
  'hitler', 'nazi', 'kkk', 'holocaust', 'lynch', 'isis',
  // impersonation of the game's own voice
  'admin', 'moderator', 'official',
]

/** Collapses evasion tricks so the blocklist can be short. */
function normalise(name: string): string {
  const lowered = name.toLowerCase()

  let mapped = ''
  for (const ch of lowered) mapped += LEET[ch] ?? ch

  // Strip everything that is not a letter, so hyphens and digits used as
  // spacers (f-u-c-k, f1u1c1k) cannot hide a word.
  const lettersOnly = mapped.replace(/[^a-z]/g, '')

  // Collapse runs so `fuuuuck` and `fuck` match the same stem.
  return lettersOnly.replace(/(.)\1+/g, '$1')
}

export type NameCheck =
  | { ok: true; name: string }
  | { ok: false; reason: string }

export function checkName(input: unknown): NameCheck {
  if (typeof input !== 'string') {
    return { ok: false, reason: 'Name must be text.' }
  }

  const name = input.trim().toUpperCase()

  if (name.length < MIN_LEN) {
    return { ok: false, reason: `Too short — ${MIN_LEN} characters minimum.` }
  }
  if (name.length > MAX_LEN) {
    return { ok: false, reason: `Too long — ${MAX_LEN} characters maximum.` }
  }
  if (!SHAPE.test(name)) {
    return { ok: false, reason: 'Letters, numbers and hyphens only.' }
  }

  // Match against both the collapsed form and the un-collapsed letters, so
  // neither `ass` inside a legitimate word nor `aass` slips through wrongly.
  const collapsed = normalise(name)
  const letters = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  let mappedLetters = ''
  for (const ch of letters) mappedLetters += LEET[ch] ?? ch
  const plain = mappedLetters.replace(/[^a-z]/g, '')

  for (const term of BLOCKED) {
    if (collapsed.includes(term) || plain.includes(term)) {
      return { ok: false, reason: 'Pick another name.' }
    }
  }

  return { ok: true, name }
}
