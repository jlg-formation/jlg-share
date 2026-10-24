# ADR-0002 — Application Bun, TypeScript, React et SQLite

Date : 24 octobre 2026
Statut : retenu pour la première implémentation

## Décision

Un seul serveur applicatif Bun, en TypeScript, utilise ses API HTTP, WebSocket et SQLite natives. L'interface React/TypeScript est construite avec Vite puis servie par ce même processus en production. Pas de dépendance à Node.js pour exécuter le projet.

SQLite stocke les sessions, participants, autorisations et publications ; les fichiers restent hors du répertoire public. Les écritures de quota sont transactionnelles. Le mode journal DELETE et secure_delete réduisent les copies persistantes des textes supprimés. La purge s'exécute périodiquement et avant les accès ; un VPS arrêté ne peut pas effacer physiquement ses données avant de redémarrer.

Un cookie HttpOnly identifie le navigateur ; le rôle administrateur est distinct et limité dans le temps. Les requêtes mutantes et WebSocket contrôlent l'origine. Une identité de navigateur permet de retrouver les participations sans stocker un mot de passe stagiaire. Pseudo unique par session, nom réservé jusqu'à suppression de la session.

LiveKit est un service distinct derrière un adaptateur média. Le chat et les fichiers fonctionnent sans lui. Les versions sont verrouillées ; les SDK sont testés avec Bun.

## Conséquences

Un seul processus applicatif assure la cohérence des connexions et des quotas ; ne pas multiplier ses instances sans revoir la coordination. Les sessions multiples sont possibles dans la limite du disque ; un seul écran peut diffuser à la fois. La licence du code public reste à choisir avant publication.
