import { z } from 'zod';

/**
 * Auth input contract. Validated at the edge before any network call — see
 * docs/security/checklist.md SEC-INPUT-001.
 */

/**
 * Longueur minimale d'un mot de passe, la MÊME partout : connexion, inscription, réinitialisation,
 * et réglage du serveur (`minimum_password_length` dans `supabase/config.toml`). Pas de règle de
 * composition (majuscule, chiffre…) : elles poussent à choisir « Motdepasse1 » plutôt qu'une phrase
 * longue, et la longueur protège mieux (recommandation NIST SP 800-63B).
 */
export const MIN_PASSWORD = 8;

/** Au-delà, ce n'est plus un mot de passe mais une tentative de saturer le hachage côté serveur. */
export const MAX_PASSWORD = 72;

export const PasswordSchema = z
  .string()
  .min(MIN_PASSWORD, `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`)
  .max(MAX_PASSWORD, `Le mot de passe ne peut pas dépasser ${MAX_PASSWORD} caractères.`);

export const CredentialsSchema = z.object({
  email: z.email({ error: 'Entrez une adresse e-mail valide.' }),
  password: PasswordSchema,
});

export type Credentials = z.infer<typeof CredentialsSchema>;

/** Le code à usage unique reçu par e-mail ou SMS : six chiffres. */
export const OTP_LENGTH = 6;
export const OtpSchema = z
  .string()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Le code comporte ${OTP_LENGTH} chiffres.`);
