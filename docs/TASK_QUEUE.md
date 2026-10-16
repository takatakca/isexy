# ISEXY — File des tâches

Dernière mise à jour : 2026-10-16. Reprendre la première ligne exécutable,
sans refaire les migrations déjà appliquées.

| Priorité | Tâche | État / critère d'acceptation |
| --- | --- | --- |
| P0 | Réconcilier les SHA | Render `dd06a77b` live; CI `38950628292` encore en cours; CI précédentes 38949682815/38950001783/38950381063 success. Vérifier CI du dernier HEAD et release.json |
| P0 | Examiner Coolify puis `isexy.ca` | GitHub `main` → image publiée; SSL, DNS, `/auth`, `/discover` et URL canonique vérifiés |
| P0 | Rétablir GitHub → Supabase | Secrets `ISEXY_DB_URL` et `SUPABASE_ACCESS_TOKEN` disponibles dans l'environnement du job; aucune étape prod sautée, résultat observable |
| P0 | Vérifier Data API et Takatak Auth | Contrôle Data API REST schéma isexy passé dans CI 38882814481; Auth Google/email/SMS et RLS réelles restent à valider |
| P0 | Audit paiement et fournisseurs | Migration 0011 atomique appliquée; webhook v4 ACTIVE avec identité Stripe sans fallback email. Version checkout subscription corrigée (`dd06a77b`) à publier seulement après CI. Sandbox Stripe, boosts/dons atomiques et reprise échecs manquants |
| P0 | Recette 18+ / modération / confidentialité | 0006 âge et 0009/0010 tickets protégés; confirmer inscription réelle, modération, blocage et politique de confidentialité |
| P0 | Cron des allocations | Handler v3 JWT+POST, workflow GitHub quotidien existe; secret ISEXY_CRON_SECRET GitHub et HTTP 200 d'une exécution planifiée non vérifiés. Aucun reset de test en prod |
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
