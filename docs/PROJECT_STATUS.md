# ISEXY — État réel du projet

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
| Migrations | 0001–0005 enregistrées; empreintes 0004 et 0005 contrôlées | Appliquées |
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
