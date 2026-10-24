import { savePasswordHash } from "./password-config";

// Read from an interactive terminal only, so secrets never appear in shell history.
if (!process.stdin.isTTY)
  throw new Error("Lancez cette commande dans un terminal interactif.");
process.stdout.write("Mot de passe administrateur (12 caractères minimum) : ");
process.stdin.setRawMode(true);
process.stdin.setEncoding("utf8");
let password = "";
process.stdin.on("data", async (chunk: string) => {
  for (const char of chunk) {
    if (char === "\u0003") process.exit(130);
    if (char === "\r" || char === "\n") {
      process.stdin.removeAllListeners("data");
      process.stdin.setRawMode(false);
      process.stdin.pause();
      if (password.length < 12) {
        process.stderr.write("\nMot de passe trop court.\n");
        process.exit(1);
      }
      try {
        const hash = await Bun.password.hash(password, {
          algorithm: "argon2id",
        });
        password = "";
        if (process.argv.includes("--print")) {
          process.stdout.write(`\nADMIN_PASSWORD_HASH='${hash}'\n`);
        } else {
          savePasswordHash(process.cwd(), hash);
          process.stdout.write(
            "\nMot de passe enregistré dans .env. Vous pouvez lancer bun run dev.\n",
          );
        }
      } catch {
        process.stderr.write(
          "\nImpossible d'enregistrer le mot de passe. Vérifiez les droits sur .env.\n",
        );
        process.exitCode = 1;
      }
      return;
    }
    if (char === "\u007f" || char === "\b") password = password.slice(0, -1);
    else password += char;
  }
});
