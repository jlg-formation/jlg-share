# Sécurité

## Signaler une vulnérabilité

Utiliser le [signalement privé GitHub](https://github.com/jlg-formation/jlg-share/security/advisories/new). Ne pas publier de secret, de contenu de session ou de détail permettant une exploitation dans une issue publique.

Indiquer la version concernée, les étapes de reproduction avec des données fictives, l'impact et, si possible, une proposition de correction. Le projet ne garantit pas de délai de réponse ; utiliser la dernière version de `main` pour bénéficier des correctifs disponibles.

## Secrets et données locales

- Conserver les mots de passe, hachages et clés LiveKit dans les fichiers `.env` locaux ou dans les secrets de l'environnement de déploiement, jamais dans Git.
- Les fichiers `.env`, les données de `data/`, les copies de bases SQLite et les formats usuels de clés privées sont exclus par `.gitignore`. Cette exclusion ne protège pas un fichier déjà suivi par Git ni un secret placé dans le code.
- Seuls les fichiers d'exemple sans identifiants réels doivent être publiés. Les mots de passe présents dans les tests sont fictifs et réservés aux répertoires temporaires de test.
- Un workflow Gitleaks contrôle l'historique à chaque push sur `main` et à chaque pull request. Il masque les valeurs détectées. Ce contrôle intervient après l'envoi ; il complète la protection GitHub contre les secrets et la vérification locale avant chaque publication.
- Si un secret est publié, le révoquer ou le remplacer immédiatement auprès du service concerné, puis nettoyer le dépôt et son historique. Supprimer seulement la ligne ou le fichier ne suffit pas.

## Exploitation

Consulter le [guide de déploiement](docs/DEPLOIEMENT.md) pour HTTPS, les ports, les permissions et la conservation des données. Le chat et les fichiers fonctionnent sans clés LiveKit. Le déploiement VPS est déclenché manuellement et nécessite des secrets distincts ; publier le dépôt ne déploie pas l'application.

Le contrôle des secrets ne constitue pas un audit complet de sécurité du code ou de l'infrastructure.
