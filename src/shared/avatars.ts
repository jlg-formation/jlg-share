export const AVATARS = [
  "Le sourire aux cheveux bleus",
  "La bouclée malicieuse",
  "La moustache espiègle",
  "Le chignon étonné",
  "Les cheveux en pétard",
  "La mamie joyeuse",
  "Le rêveur barbu",
  "Le clin d’œil",
  "Le grand nez curieux",
  "Le grand sourire",
  "Les couettes rousses",
  "Les lunettes enthousiastes",
  "La coupe argentée",
  "La casquette complice",
  "Le chignon afro",
  "La moustache argentée",
  "La coupe violette",
  "Le bonnet rieur",
  "La penseuse à lunettes",
  "Le nœud papillon",
  "Le professeur barbu à lunettes",
  "La formatrice aux boucles argentées",
  "Le formateur à la moustache rousse",
  "La formatrice au chignon violet",
  "Le professeur au nœud papillon",
  "La formatrice au carré bleu",
] as const;

export const DEFAULT_AVATAR = 1;
export const DEFAULT_TRAINER_AVATAR = 21;
export function avatarIds(admin: boolean): number[] {
  return Array.from(
    { length: admin ? 6 : 20 },
    (_, index) => index + (admin ? 21 : 1),
  );
}
export function avatarAllowed(value: unknown, admin: boolean): value is number {
  return isAvatarId(value) && (admin ? value >= 21 : value <= 20);
}
export function isAvatarId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= AVATARS.length
  );
}
