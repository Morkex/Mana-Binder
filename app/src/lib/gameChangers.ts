/** Game Changers oficiales (actualización Wizards Oct 2025). */
export const GAME_CHANGERS: string[] = [
  "Drannith Magistrate",
  "Humility",
  "Serra's Sanctum",
  "Smothering Tithe",
  "Enlightened Tutor",
  "Teferi's Protection",
  "Consecrated Sphinx",
  "Cyclonic Rift",
  "Force of Will",
  "Fierce Guardianship",
  "Gifts Ungiven",
  "Intuition",
  "Mystical Tutor",
  "Narset, Parter of Veils",
  "Rhystic Study",
  "Thassa's Oracle",
  "Ad Nauseam",
  "Bolas's Citadel",
  "Braids, Cabal Minion",
  "Demonic Tutor",
  "Imperial Seal",
  "Necropotence",
  "Opposition Agent",
  "Orcish Bowmasters",
  "Tergrid, God of Fright",
  "Vampiric Tutor",
  "Gamble",
  "Jeska's Will",
  "Underworld Breach",
  "Crop Rotation",
  "Gaea's Cradle",
  "Natural Order",
  "Seedborn Muse",
  "Survival of the Fittest",
  "Worldly Tutor",
  "Aura Shards",
  "Coalition Victory",
  "Grand Arbiter Augustin IV",
  "Notion Thief",
  "Ancient Tomb",
  "Chrome Mox",
  "Field of the Dead",
  "Glacial Chasm",
  "Grim Monolith",
  "Lion's Eye Diamond",
  "Mana Vault",
  "Mishra's Workshop",
  "Mox Diamond",
  "Panoptic Mirror",
  "The One Ring",
  "The Tabernacle at Pendrell Vale",
]

/** Normaliza nombre para comparar (cara frontal, sin acentos). */
export function normalizeCardName(name: string): string {
  return name
    .split('//')[0]
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

const GC_SET = new Set(GAME_CHANGERS.map(normalizeCardName))

export function isGameChanger(name: string): boolean {
  return GC_SET.has(normalizeCardName(name))
}

export function findGameChangers(names: string[]): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  for (const name of names) {
    const key = normalizeCardName(name)
    if (GC_SET.has(key) && !seen.has(key)) {
      seen.add(key)
      found.push(name.split('//')[0].trim())
    }
  }
  return found
}
