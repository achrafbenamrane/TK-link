import { z } from 'zod';

/**
 * Auth input contract. Validated at the edge before any network call — see
 * docs/security/checklist.md SEC-INPUT-001.
 */
export const CredentialsSchema = z.object({
  email: z.email({ error: 'Entrez une adresse e-mail valide.' }),
  password: z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères.'),
});

export type Credentials = z.infer<typeof CredentialsSchema>;
