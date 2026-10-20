/**
 * LUMINA — Calculs numérologie déterministes
 * Basé sur la numérologie pythagoricienne standard.
 * Ces calculs sont reproductibles et documentés — pas d'IA ici.
 */

// ── Tables de correspondance ──────────────────────────────────────────────────

const LETTER_VALUES: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
  J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
  S: 1, T: 2, U: 3, V: 4, W: 5, X: 6, Y: 7, Z: 8,
};

const VOWELS = new Set(["A", "E", "I", "O", "U", "Y"]);

// ── Réduction numérique ───────────────────────────────────────────────────────

/** Réduit un nombre à un chiffre (1-9) ou maître nombre (11, 22, 33) */
export function reduceToDigit(n: number): number {
  const MASTER = new Set([11, 22, 33]);
  while (n > 9 && !MASTER.has(n)) {
    n = String(n)
      .split("")
      .reduce((sum, d) => sum + Number(d), 0);
  }
  return n;
}

// ── Chemin de vie ─────────────────────────────────────────────────────────────

/**
 * Calcul du chemin de vie à partir de la date de naissance.
 * Méthode : réduction de chaque composante (jour, mois, année) séparément,
 * puis addition et réduction finale.
 */
export function calculateLifePath(birthDate: string): {
  number: number;
  isMaster: boolean;
  calculation: string;
} {
  const date = new Date(birthDate);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const dayR = reduceToDigit(day);
  const monthR = reduceToDigit(month);
  const yearR = reduceToDigit(
    String(year)
      .split("")
      .reduce((sum, d) => sum + Number(d), 0)
  );

  const total = dayR + monthR + yearR;
  const result = reduceToDigit(total);
  const isMaster = [11, 22, 33].includes(result);

  return {
    number: result,
    isMaster,
    calculation: `${day}(${dayR}) + ${month}(${monthR}) + ${year}(${yearR}) = ${total} → ${result}`,
  };
}

// ── Expression (nom complet) ──────────────────────────────────────────────────

export function calculateExpression(fullName: string): {
  number: number;
  isMaster: boolean;
} {
  const letters = fullName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("");

  const total = letters.reduce((sum, l) => sum + (LETTER_VALUES[l] ?? 0), 0);
  const number = reduceToDigit(total);

  return { number, isMaster: [11, 22, 33].includes(number) };
}

// ── Désir de l'âme (voyelles) ─────────────────────────────────────────────────

export function calculateSoulUrge(fullName: string): {
  number: number;
  isMaster: boolean;
} {
  const vowels = fullName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .filter((l) => VOWELS.has(l));

  const total = vowels.reduce((sum, l) => sum + (LETTER_VALUES[l] ?? 0), 0);
  const number = reduceToDigit(total);

  return { number, isMaster: [11, 22, 33].includes(number) };
}

// ── Personnalité extérieure (consonnes) ───────────────────────────────────────

export function calculatePersonality(fullName: string): {
  number: number;
  isMaster: boolean;
} {
  const consonants = fullName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .filter((l) => !VOWELS.has(l));

  const total = consonants.reduce(
    (sum, l) => sum + (LETTER_VALUES[l] ?? 0),
    0
  );
  const number = reduceToDigit(total);

  return { number, isMaster: [11, 22, 33].includes(number) };
}

// ── Nombre de naissance (jour) ────────────────────────────────────────────────

export function calculateBirthDay(birthDate: string): number {
  const day = new Date(birthDate).getDate();
  return reduceToDigit(day);
}

// ── Année personnelle ──────────────────────────────────────────────────────────

export function calculatePersonalYear(
  birthDate: string,
  targetYear = new Date().getFullYear()
): number {
  const date = new Date(birthDate);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const yearR = reduceToDigit(
    String(targetYear)
      .split("")
      .reduce((sum, d) => sum + Number(d), 0)
  );
  const monthR = reduceToDigit(month);
  const dayR = reduceToDigit(day);

  return reduceToDigit(yearR + monthR + dayR);
}

// ── Calcul complet ────────────────────────────────────────────────────────────

export interface NumerologyProfile {
  lifePath: { number: number; isMaster: boolean; calculation: string };
  expression: { number: number; isMaster: boolean };
  soulUrge: { number: number; isMaster: boolean };
  personality: { number: number; isMaster: boolean };
  birthDay: number;
  personalYear: number;
  personalYearNext: number;
}

export function calculateNumerology(
  fullName: string,
  birthDate: string
): NumerologyProfile {
  const currentYear = new Date().getFullYear();
  return {
    lifePath: calculateLifePath(birthDate),
    expression: calculateExpression(fullName),
    soulUrge: calculateSoulUrge(fullName),
    personality: calculatePersonality(fullName),
    birthDay: calculateBirthDay(birthDate),
    personalYear: calculatePersonalYear(birthDate, currentYear),
    personalYearNext: calculatePersonalYear(birthDate, currentYear + 1),
  };
}
