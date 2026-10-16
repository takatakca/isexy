# ISEXY — File des tâches

Dernière mise à jour : 2026-10-16. Reprendre la première ligne exécutable,
sans refaire les migrations déjà appliquées.

| Priorité | Tâche | État / critère d'acceptation |
| --- | --- | --- |
| P0 | Réconcilier les SHA | Render `f6e6a029` live; CI 830c1062, 5b9a6845, 705cc269 vertes. Vérifier CI du dernier SHA et `/release.json` |
| P0 | Examiner Coolify puis `isexy.ca` | GitHub `main` → image publiée; SSL, DNS, `/auth`, `/discover` et URL canonique vérifiés |
| P0 | Rétablir GitHub → Supabase | Secrets `ISEXY_DB_URL` et `SUPABASE_ACCESS_TOKEN` disponibles dans l'environnement du job; aucune étape prod sautée, résultat observable |
| P0 | Vérifier Data API et Takatak Auth | USAGE du schéma et SELECT ticket_categories vérifiés au niveau DB; nouveau smoke test REST 200 en CI en cours. Encore prouver Auth Google/email/SMS et RLS par session réelle |
| P0 | Audit paiement et fournisseurs | Checkout one-time v3, webhook v2, gate v2 ACTIVE. Métadonnées et statut payé durcis; exigence non levée : essais Stripe réels en mode test et idempotence atomique des soldes / rapprochement des événements échoués |
| P0 | Recette 18+ / modération / confidentialité | 0006 âge et 0009/0010 tickets protégés; confirmer inscription réelle, modération, blocage et politique de confidentialité |
| P0 | Cron des allocations | Toujours bloqué : fonction v2 exige JWT Gateway en plus du secret Cron. Ne pas désactiver la protection ou lancer une remise à zéro sans auth et contrôle de cadence |
| P1 | Publication de `isexy-subscription-resets` | Quarantaine maintenue, ne pas publier ni utiliser tant que son comportement global n'est pas corrigé |
| P1 | `isexy-seed-profiles` | Ne pas déployer en production par défaut : profils d'essai ne doivent pas apparaître comme réels |
| P1 | Validation Apple/Google d'achats mobiles | Fonction IAP en HTTP 501 par défaut; implémenter validation côté fournisseur avant activation commerciale |
| P1 | Réduire les avis de performance | 71 contraintes FK restantes sans index couvrant; sélectionner par charge métier, éviter index inutiles |
| P1 | Recette de bout en bout | Ticket restauration relié à TAKATAK Auth + CI SQL vérifiée; encore tester profil, découverte, match, chat/realtime, traduction, appels, PhoneLine, notifications et abonnement |
| P1 | Documenter les secrets et dépendances | Inventaire des noms sans valeurs, responsable de rotation, repli/rollback |
| P2 | UX/a11y, performance mobile et nettoyage de lint | Tests automatisés additionnels; pas de régression de marque |
| P2 | Contenu Cuba en attente | Aucune suppression sans décision explicite; voir `REPOSITIONING.md` |

| P1 | Promotions et prix | Bannière 50 % désactivée, CTA sous verrou de paiement; ne réactiver une promotion qu'après validation de la remise Stripe et concordance des tarifs |

## Règles de traitement

Pour toute modification : lire `AGENTS.md` et `WORKLOG.md`, contrôler
`main`, faire le changement minimal, vérifier CI et déploiement réel,
puis mettre à jour la relève. Ne pas déclarer « 100 % » tant qu'un P0
n'est pas démontré.
