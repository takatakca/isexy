# ISEXY — File des tâches

Dernière mise à jour : 2026-10-15. Reprendre la première ligne exécutable,
sans refaire les migrations déjà appliquées.

| Priorité | Tâche | État / critère d'acceptation |
| --- | --- | --- |
| P0 | Réconcilier les SHA | Render `f889e931` live; la CI de ce SHA est à revérifier après son exécution |
| P0 | Examiner Coolify puis `isexy.ca` | GitHub `main` → image publiée; SSL, DNS, `/auth`, `/discover` et URL canonique vérifiés |
| P0 | Rétablir GitHub → Supabase | Secrets `ISEXY_DB_URL` et `SUPABASE_ACCESS_TOKEN` disponibles dans l'environnement du job; aucune étape prod sautée, résultat observable |
| P0 | Vérifier Data API et Takatak Auth | `isexy` exposé via API avec RLS; redirections ISEXY, Google, email-code, SMS-code valides |
| P0 | Audit paiement et fournisseurs | `ISEXY_*` présents côté serveur, clés non visibles dans le frontend; webhooks Stripe de test, mode réel non activé sans validation |
| P0 | Recette 18+ / modération / confidentialité | Déclencheur SQL 0006 + parcours Cuba sans fausse date; confirmer inscription réelle, modération et blocage |
| P0 | Cron des allocations | Fonction `isexy-reset-allowances` v2 déployée, erreurs remontées en HTTP 500; JWT Gateway reste requis en plus du secret Cron. Configurer et vérifier un appel scheduler autorisé. |
| P1 | Publication de `isexy-subscription-resets` | Quarantaine maintenue, ne pas publier ni utiliser tant que son comportement global n'est pas corrigé |
| P1 | `isexy-seed-profiles` | Ne pas déployer en production par défaut : profils d'essai ne doivent pas apparaître comme réels |
| P1 | Validation Apple/Google d'achats mobiles | Fonction IAP en HTTP 501 par défaut; implémenter validation côté fournisseur avant activation commerciale |
| P1 | Réduire les avis de performance | 71 contraintes FK restantes sans index couvrant; sélectionner par charge métier, éviter index inutiles |
| P1 | Recette de bout en bout | Profil, découverte, match, chat/realtime, traduction, appel, PhoneLine, support, abonnement |
| P1 | Documenter les secrets et dépendances | Inventaire des noms sans valeurs, responsable de rotation, repli/rollback |
| P2 | UX/a11y, performance mobile et nettoyage de lint | Tests automatisés additionnels; pas de régression de marque |
| P2 | Contenu Cuba en attente | Aucune suppression sans décision explicite; voir `REPOSITIONING.md` |

## Règles de traitement

Pour toute modification : lire `AGENTS.md` et `WORKLOG.md`, contrôler
`main`, faire le changement minimal, vérifier CI et déploiement réel,
puis mettre à jour la relève. Ne pas déclarer « 100 % » tant qu'un P0
n'est pas démontré.
