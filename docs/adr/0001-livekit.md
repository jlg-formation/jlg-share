# ADR-0001 — Utiliser LiveKit auto-hébergé pour le partage d'écran

Date : 24 octobre 2026  
Statut : accepté

## Contexte

JLG Share privilégie le partage rapide de chat et fichiers en formation présentielle. Le partage d'écran est secondaire, avec un formateur et jusqu'à vingt spectateurs. Les flux sont redistribués par un VPS OVH. Le micro, la caméra et la visioconférence sont hors périmètre actuel.

Le propriétaire souhaite utiliser LiveKit tout en gardant la possibilité de changer de composant média ultérieurement.

## Décision

Utiliser le serveur LiveKit auto-hébergé et son SDK navigateur pour le partage d'écran. Aucun abonnement LiveKit Cloud n'est nécessaire au fonctionnement retenu. LiveKit ne constitue pas le stockage de référence des messages, fichiers ou sessions métier.

Isoler cette dépendance dans des adaptateurs dédiés :

- Côté navigateur : rejoindre/quitter la diffusion, publier/arrêter l'écran, recevoir le flux et remonter les états de connexion via une interface interne à JLG Share.
- Côté serveur : attribuer les autorisations média à partir des droits applicatifs, produire les accès temporaires et gérer la fermeture de la diffusion.
- Traduire les identifiants et événements LiveKit aux frontières de ces adaptateurs. Garder les objets SDK et les secrets propres au fournisseur dans ces modules.
- Conserver dans JLG Share les sessions, participants, règles d'expiration, droits, messages et fichiers. Les jetons média sont éphémères et ne deviennent pas des identifiants métier.
- Séparer le service média et sa configuration des autres services dans le déploiement.

La couche commune reste limitée aux fonctions réellement utilisées. Ne pas développer un système de plugins ou un second fournisseur pour anticiper un changement hypothétique.

## Alternatives considérées

- mediasoup : moteur personnalisable mais davantage de gestion applicative et de signalisation à construire.
- Janus : serveur modulaire envisageable, avec plus d'assemblage pour notre usage.
- Jitsi Meet : application de réunion complète, moins alignée sur la priorité chat et fichiers avec interface spécifique.

Ces choix ne reposent pas sur un benchmark comparatif. Aucune supériorité de consommation de ressources n'est affirmée.

## Conséquences et limites

Le moteur WebRTC existant évite de réécrire le transport média et permet une évolution éventuelle vers l'audio et la caméra, sous réserve d'une nouvelle décision de périmètre et d'un dimensionnement adapté.

Changer de fournisseur nécessitera de remplacer les adaptateurs, de modifier la configuration réseau et de déploiement, et de refaire les essais d'accès, de connexion et de charge. L'objectif est de préserver le chat, les fichiers, les sessions et leurs données, pas de promettre un remplacement sans travail.

Le VPS candidat doit être validé avec une diffusion d'écran et vingt spectateurs. Les permissions média sont appliquées côté serveur ; masquer un bouton n'est pas une protection suffisante.

## Validation de la séparation

- Le chat et les fichiers fonctionnent si le service média est désactivé ou indisponible.
- Le code métier du chat, des fichiers et des sessions n'importe pas le SDK LiveKit.
- Les essais des autorisations applicatives peuvent utiliser un adaptateur média simulé.
- Une défaillance média affiche un état explicite sans interrompre les échanges de ressources.

## Références

- [Auto-hébergement LiveKit](https://docs.livekit.io/transport/self-hosting/)
- [Architecture SFU LiveKit](https://docs.livekit.io/reference/internals/livekit-sfu/)
- [Spécification JLG Share](../../SPECIFICATION.md)
