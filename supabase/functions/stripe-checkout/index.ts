// Edge Function « stripe-checkout » : toute la logique est dans ../_shared/traitement.js (testée dans tests/test-abonnement.mjs).
import { servir } from '../_shared/serveur.js';
import { gererCheckout } from '../_shared/traitement.js';

Deno.serve(servir(gererCheckout));
