# ISEXY — État réel du projet

**Mise à jour 2026-10-15 :** correctif `59496103` sur les erreurs de maintenance des allocations, Edge Function `isexy-reset-allowances` v2 ACTIVE et `verify_jwt=true`. Le planificateur Cron reste non vérifié. La dernière CI validée avant ce correctif était `731a6e2e` (SUCCESS), Render `731a6e2e` LIVE.

## Revue du 15 octobre 2026 (état plus récent que les notes historiques ci-dessous)

- `main` : `f889e93111a5821dacd5c9a75b59cbad324d5127` avant cette mise à jour documentaire.
- Render `srv-db37s2s9v7es73b8g60g` : SHA `f889e931` confirmé **live**.
  GitHub Actions sur ce SHA était **en cours**; `e353ede9` et
  `e12c3ade` avaient leurs runs CI **success**.
- Supabase TAKATAK V1 `pcjfahhlozsseqqevimi` : huit migrations ISEXY
  0001–0008 appliquées, 69 tables, 25/27 Edge Functions `isexy-*` actives.
- Correctifs : `6140d541` bloque les profils Cuba à date de naissance
  inventée et exclut deux fonctions à risque du déploiement automatique;
  `e12c3ade` empêche la soumission de pièces justificatives non chargées;
  `e353ede9` restreint les RPC de réinitialisation et rend l'octroi mensuel
  conditionnel à la date prévue; `f889e931` ferme les RPC de maintenance et
  contrôle le rôle dans le listing administratif.
- Permissions vérifiées dans PostgreSQL : anon et authenticated ne peuvent
  pas appeler les RPC de maintenance ni réinitialiser globalement les quotas;
  seuls les membres autorisés de l'équipe obtiennent des résultats de
  `get_admin_users`. Aucun nouvel avertissement ciblant le schéma ISEXY
  dans l'analyse de sécurité Supabase consultée.
- Bloquant : `isexy-reset-allowances` reste déployée avec
  `verify_jwt=true` et attend `x-cron-secret`. Un Cron utilisant uniquement
  ce secret peut donc échouer avant l'exécution. Le correctif de configuration
  tenté n'a **pas été appliqué** : opération bloquée par les vérifications de
  sécurité du connecteur. Ne pas dire que la maintenance Cron est active.
- GitHub → Supabase : secrets de déploiement absents/non disponibles dans
  le job; publication SQL/fonctions depuis GitHub reste **skipped**.
  Coolify, `isexy.ca` (DNS et TLS), clés Stripe/Twilio/Claude et achats réels
  ne sont pas validés.
- Aucune suppression des parcours Cuba ni activation de profils de
  démonstration.

---


Dernière revue : 2026-10-14, dépôt `takatakca/isexy`, branche `main`.

## Objectif produit

Réseau social canadien 18+ (FR/EN), rencontres amicales, découverte, chat
traduit, appels audio/vidéo, PhoneLine, support et abonnements.
ISEXY garde son interface propre. TAKATAK V1 fournit l'identité partagée;
les données de l'application restent dans le schéma `isexy` avec RLS.
Les fonctions et services liés à Cuba restent en place sur décision du
propriétaire : **aucune suppression Cuba autorisée**.

## Éléments démontrés

| Couche | Vérification | Statut |
| --- | --- | --- |
| GitHub | `main`, écriture possible, aucune PR / issue ouverte lors du relevé | Confirmé |
| CI | Run complet `38612389598` sur `eabe0204` réussi; run `38612705942` de la migration 0005 démarré | CI connue verte avant 0005; revérifier |
| Render | Service statique `isexy`, `main`, déploiement automatique, un SHA observé `live` | Confirmé pour `eabe0204` |
| Coolify / `isexy.ca` | Hôte cible décrit par `docs/V1-MIGRATION.md`, pas de preuve de SHA ni DNS/TLS | Non vérifié |
| TAKATAK V1 | `pcjfahhlozsseqqevimi`, 69 tables ISEXY, 68 sous RLS | Confirmé |
| Migrations | 0001–0008 enregistrées; empreintes 0004 et 0005 contrôlées | Appliquées |
| Edge Functions | 25 noms `isexy-*` ACTIVE sur 27 | Partiel |
| Fournisseurs | Stripe, Anthropic, Twilio/WhatsApp, mail, TURN : secrets et scénarios non vérifiés | Non certifié |
| Comptes | 0 lignes dans `isexy.profiles` au contrôle | Pas de recette réelle |

## Correctifs de cette reprise

- `d713375` : authentification SMS sans courriel pour la facturation,
  URL de retour du portail Stripe contrôlée côté serveur.
- `f54b35f` : migration 0004, recherche SQL figée; l'avertissement
  `isexy.normalize_gender` a disparu des recommandations sécurité.
- `75139c2` : migration 0005, index pour messagerie, blocage, groupes,
  support et voix; alertes d'index FK de 82 à 71 après application.

## Définition de « terminé »

Ne pas compter une CI verte comme preuve que les Edge Functions se sont
publiées : les étapes de publication peuvent être sautées. Pour déclarer le
site terminé, obtenir au minimum la version active des deux hébergeurs,
le domaine de production et SSL, l'accès API au schéma, les secrets
fournisseurs, une recette 18+/sécurité et les paiements testés puis validés.

Voir `TASK_QUEUE.md` pour les prochaines actions classées.

## Nouveaux correctifs de sécurité et d'expérience (14 octobre)

- Commit `6c90acc9` : `MySubscription` indique une erreur récupérable lorsque
  Stripe est indisponible, au lieu d'afficher faussement un forfait gratuit.
- Commit `e0f9a445` : migration `0006_require_adult_profiles.sql`
  enregistrée et appliquée, contrôle côté PostgreSQL de 18 ans minimum pour
  insertion et modification de `birth_date`, test ajouté dans CI.
  Cette mesure contrôle l'âge **déclaré**, pas l'identité réelle.
- Commit `b668f2cd` : vérification Apple/Google inachevée maintenant en
  échec explicite HTTP 501, fonction IAP version 2 active; aucun abonnement
  n'est accordé sur des justificatifs non vérifiés.
- Render : commit `b668f2cdd3678af80950465027c3a918d5f38932`
  confirmé `live` le 14 octobre à 18:18 UTC.
- **CI récente** : `75139c2` vert, les runs plus récents peuvent être
  annulés ou en attente dans la file GitHub. Revérifier la CI du SHA final.
