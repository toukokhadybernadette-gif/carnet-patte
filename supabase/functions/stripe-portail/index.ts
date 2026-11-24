// Edge Function « stripe-portail » : toute la logique est dans ../_shared/traitement.js (testée dans tests/test-abonnement.mjs).
import { servir } from '../_shared/serveur.js';
import { gererPortail } from '../_shared/traitement.js';

Deno.serve(servir(gererPortail));
