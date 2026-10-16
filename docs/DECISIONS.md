# ISEXY — Décisions permanentes

Dernière revue : 2026-10-14.

1. **Produit** : ISEXY est un réseau social canadien **18+** (amis,
   conversations et communautés), pas une application de rencontres amoureuses.
   Définitions détaillées : `docs/REPOSITIONING.md`.
2. **Données centrales** : l'identité vient de TAKATAK Auth (V1);
   `isexy.profiles.id = user_id = auth.users.id`. Pas de CRM maître
   parallèle, pas de menus ISEXY dans le tableau de bord général.
3. **Séparation technique** : schéma `isexy`, RLS, fonctions `isexy-*`,
   buckets et variables `ISEXY_*`; ne jamais modifier les tables
   `public` de V1 ni exécuter `supabase db push`.
4. **Migrations** : uniquement `supabase/isexy-migrations/000N_*.sql`,
   runner `scripts/isexy/migrate.sh` et table d'empreintes
   `isexy.schema_migrations`. Ne jamais éditer une migration appliquée.
5. **Cuba** : suppression / requalification des contenus Cuba **en attente**,
   aucune donnée Cuba à effacer; conserver les parcours Cuba existants.
6. **Hébergement** : cible souhaitée Coolify (`coolify.takatak.ca`),
   `isexy.ca` domaine final; Render `isexy.onrender.com` reste repli actif
   tant que la nouvelle production n'a pas été démontrée.
7. **Paiements** : Stripe côté serveur, abonnements CAD, désactivés en réel
   tant que les critères de recette ne sont pas remplis; `ISEXY_*`
   requis pour isoler les secrets des autres applications.
8. **Automatisation** : publier `main` lorsque les protections et
   secrets le permettent, vérifier les jobs non exécutés et la version
   effectivement servie. Pas de force-push, pas de certificats inventés.
9. **Données de démonstration** : profils de semence uniquement en
   environnement contrôlé, jamais présentés comme de vrais membres.
10. **Marque** : suivre `BRAND.md` pour les éléments GROUPE TAKATAK;
    respecter l'identité propre de l'interface ISEXY.

11. **Âge minimum déclaré** : le schéma ISEXY rejette au niveau du serveur
    toute création/modification de profil avec date de naissance de moins de
    18 ans (migration 0006). Cela ne remplace pas une vérification d'identité.
12. **Achats mobiles** : aucune activation fondée sur un reçu non vérifié.
    `isexy-verify-iap-receipt` retourne 501 tant que l'intégration officielle
    Apple/Google n'est pas complète; tester les achats réels avant activation.

13. **RPC privilégiés** : les tâches d'allocations et de nettoyage ne
    sont exécutables que par le rôle de service. `get_admin_users` doit
    filtrer côté serveur les utilisateurs n'appartenant pas à l'équipe.
    Migrations `0007` et `0008`.
14. **Quarantaine d'Edge Functions** : `isexy-seed-profiles` et
    `isexy-subscription-resets` sont exclus du pipeline tant que leur
    utilisation en production n'est pas explicitement sécurisée.
15. **Cron** : aucune fonction autorisée par secret Cron seul ne peut être
    déclarée disponible si la Gateway requiert également un JWT; régler
    et éprouver les deux couches avant de programmer un job.

16. **Tickets d'assistance** : tout champ administratif d'un ticket
    doit être contrôlé par déclencheur PostgreSQL côté serveur. Les
    politiques membres lisent les claims Auth ou l'UID, jamais
    directement les lignes `auth.users` (migrations 0009–0010).
17. **Isolation Stripe** : un e-mail partagé ne suffit jamais à
    attribuer un client Stripe à un membre ISEXY; seul
    `metadata.isexy_user_id` correspondant permet la réutilisation.
    Les connexions uniquement par téléphone sont valides.
18. **Navigation après paiement** : redirection uniquement vers
    l'URL du site configurée côté serveur, jamais une origine fournie
    par le navigateur.
19. **Promotions** : les comptes à rebours et remises non matérialisées
    dans le serveur de paiement ne sont pas affichés.
20. **Preuves de publication** : `release.json` fait correspondre
    le SHA Git au build servi; aucun seul statut de CI ne suffit à
    confirmer l'hébergement cible, DNS ou le fonctionnement métier.

21. **Paiement sans confiance dans le client** : seules les
    métadonnées de destinataire nécessaires aux cadeaux/dons
    franchissent l'API checkout; le type d'achat, produit,
    membre payeur et ID du package sont déterminés par le serveur.
22. **Webhook Stripe** : ne jamais accepter un paiement unique
    non soldé ni accuser réception d'un événement absent du
    journal ou en état de traitement/échec. Les échecs partiels
    nécessitent une procédure de reprise atomique, à finaliser
    avant commercialisation.
23. **Passerelle de paiement** : état fournisseur inconnu ou
    clé absente = aucune session de checkout; les retours
    doivent pointer exclusivement vers Stripe.
24. **API multi-tenant** : le smoke test de production doit
    valider une lecture REST du schéma `isexy`, et pas
    uniquement l'existence des privilèges SQL.

25. **Attribution atomique Stripe** : solde et journal crédits/minutes dans la même transaction SQL, idempotente par session, service-role uniquement (migration 0011 à valider).
26. **Cron protégé** : conserver `verify_jwt=true`; utiliser JWT anon public pour la Gateway + `ISEXY_CRON_SECRET` privé pour le handler, méthode POST seulement.

29. **Identité d'acheteur Stripe** : ne jamais attribuer à un profil par correspondance d'adresse courriel. Accepter exclusivement l'identifiant TAKATAK issu des métadonnées rédigées par le backend de checkout et le faire concorder avec le propriétaire du client Stripe; sessions historiques ambiguës à rapprocher manuellement.
30. **Confirmations de tickets** : une référence de ticket ne donne aucun pouvoir d'envoi d'email. Un utilisateur connecté propriétaire ou staff peut demander une confirmation; les tickets créés anonymement demeurent consultables par les parcours autorisés, mais aucun email automatique depuis un client inconnu sans vérification.
31. **Droits abonnements** : un Stripe Checkout terminé n'accorde pas Premium si `subscription.status` n'est pas `active` ou `trialing`. Les erreurs de synchronisation des droits sont traitées comme erreurs, non comme succès de webhook.
