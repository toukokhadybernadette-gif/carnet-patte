// Edge Function « stripe-webhook » : toute la logique est dans ../_shared/traitement.js (testée dans tests/test-abonnement.mjs).
import { servir } from '../_shared/serveur.js';
import { traiterWebhook } from '../_shared/traitement.js';

Deno.serve(servir(traiterWebhook));
