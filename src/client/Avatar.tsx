import React, { useId } from "react";
import {
  AVATARS,
  DEFAULT_AVATAR,
  isAvatarId,
  avatarIds,
} from "../shared/avatars";

// These original vector drawings share a palette and proportions, while each
// character keeps its own silhouette, accessories and expression at small sizes.
const characters = [
  [
    "#d7c8e9",
    "#c88f63",
    "#315f78",
    "#d69b4e",
    "pixie",
    "none",
    "freckles",
    "wink",
  ],
  [
    "#ffc3a6",
    "#dc9c62",
    "#493026",
    "#e9ac43",
    "curls",
    "none",
    "hoops",
    "side",
  ],
  [
    "#a8d0e4",
    "#f2bf80",
    "#173a46",
    "#3981a5",
    "quiff",
    "none",
    "moustache",
    "raised",
  ],
  [
    "#d4c3e8",
    "#f0b879",
    "#573b31",
    "#9a78b4",
    "bun",
    "none",
    "hoops",
    "surprise",
  ],
  [
    "#ffdc83",
    "#edac6b",
    "#b05c30",
    "#4c805c",
    "spikes",
    "none",
    "none",
    "grin",
  ],
  [
    "#9bcbe5",
    "#f2bb8a",
    "#e5edf0",
    "#9c79b6",
    "waves",
    "round",
    "earrings",
    "laugh",
  ],
  [
    "#bbceb2",
    "#dca36d",
    "#263f45",
    "#e4ad42",
    "messy",
    "none",
    "beard",
    "sleepy",
  ],
  [
    "#ffe093",
    "#efb77c",
    "#34343a",
    "#598464",
    "bob",
    "none",
    "earrings",
    "wink",
  ],
  [
    "#ffbda0",
    "#edb27a",
    "#b76538",
    "#9c8bb9",
    "waves",
    "round",
    "longnose",
    "side",
  ],
  ["#a1cce3", "#a86339", "#183c48", "#33799e", "quiff", "none", "none", "grin"],
  [
    "#ffb89c",
    "#f3bd87",
    "#bd6335",
    "#42869b",
    "pigtails",
    "none",
    "freckles",
    "laugh",
  ],
  [
    "#d2c1e8",
    "#a7633b",
    "#34323b",
    "#dc6554",
    "bald",
    "round",
    "none",
    "laugh",
  ],
  [
    "#9fcde6",
    "#efb682",
    "#f1eee8",
    "#29454b",
    "pixie",
    "angular",
    "hoops",
    "side",
  ],
  [
    "#bdd2b6",
    "#eebd85",
    "#203e43",
    "#e8b44d",
    "cap",
    "none",
    "stubble",
    "grin",
  ],
  ["#ffe095", "#ab6940", "#203b40", "#a587c2", "afro", "none", "hoops", "side"],
  [
    "#c1d5b8",
    "#f1c399",
    "#e2e9e8",
    "#8b7861",
    "waves",
    "none",
    "moustache",
    "raised",
  ],
  [
    "#ffbfa8",
    "#e8b77c",
    "#765185",
    "#25454e",
    "pixie",
    "none",
    "earrings",
    "raised",
  ],
  [
    "#d3c3e8",
    "#e1a36e",
    "#734934",
    "#3586a2",
    "beanie",
    "none",
    "beard",
    "laugh",
  ],
  ["#a0cfe7", "#e1a774", "#63402e", "#558967", "bob", "teal", "hoops", "side"],
  [
    "#ffbea6",
    "#f0be8e",
    "#edf0e8",
    "#65534a",
    "bald",
    "none",
    "bowtie",
    "smile",
  ],
  [
    "#bfd2b4",
    "#efb878",
    "#4b3830",
    "#487a53",
    "bald",
    "round",
    "beard",
    "smile",
  ],
  [
    "#f5d1b7",
    "#9e6041",
    "#e5dfd0",
    "#6c4b7d",
    "curls",
    "round",
    "hoops",
    "wink",
  ],
  [
    "#cad6ed",
    "#efbf92",
    "#a55431",
    "#4c6f62",
    "waves",
    "none",
    "moustache",
    "grin",
  ],
  [
    "#e8d29d",
    "#ab704b",
    "#705181",
    "#315d73",
    "bun",
    "angular",
    "earrings",
    "smile",
  ],
  [
    "#e3c4d5",
    "#dca672",
    "#513d36",
    "#3b6262",
    "quiff",
    "round",
    "bowtie",
    "laugh",
  ],
  [
    "#b8d9db",
    "#f0c6a0",
    "#31526c",
    "#94554b",
    "bob",
    "none",
    "hoops",
    "raised",
  ],
] as const;

function Hair({ style, color }: { style: string; color: string }) {
  const paths: Record<string, string> = {
    quiff:
      "M24 43Q14 28 25 21L20 12L35 19L36 5Q49 8 47 18Q58 0 64 8L61 19Q79 10 80 22L73 29L78 42L68 37Q61 22 44 29L29 38Z",
    spikes:
      "M23 44L10 33L24 31L11 18L32 23L26 7L43 18L49 4L57 21L70 9L69 25L89 20L77 35L89 42L72 44L66 29L52 35L41 27L28 42Z",
    messy:
      "M22 46L12 38L23 32L12 24L30 25L25 11L41 20L45 5L56 19L70 10L68 25L85 25L74 36L84 43L69 45L64 30L49 35L34 28L29 45Z",
    pixie:
      "M23 54Q9 31 23 22L17 16L34 18L38 7L50 16L63 6L63 18L80 13L73 26L86 29L72 41L70 53L64 31L49 39L51 28L29 44L29 60Z",
    waves:
      "M23 48Q7 47 13 35Q4 24 20 23Q15 10 29 14Q29 1 44 9Q58-1 65 13Q81 7 79 23Q94 26 84 39Q92 51 74 53L67 33Q59 22 44 25L30 39L29 52Z",
    bob: "M20 71Q9 51 18 30Q22 10 49 12Q77 9 83 35L86 69Q74 83 65 75L67 42L55 26Q43 40 27 42L32 77Z",
    pigtails:
      "M24 36Q6 18 5 40L13 36L7 53L23 46Q15 63 19 71L31 59L31 30Q50 14 69 31L70 58L83 69L81 51L95 44L84 38L94 25L75 32Q76 13 62 18L54 7L45 18L28 10L32 23L17 20Z",
    bun: "M27 42Q13 19 37 18Q23 0 44 4Q60-4 64 14Q82 9 77 28L75 47L68 37Q64 22 50 25L29 41Z",
    afro: "M23 43Q9 36 19 24Q6 13 24 10Q25-3 39 5Q50-6 59 5Q78-2 78 14Q95 17 84 33Q90 47 74 51L68 35Q56 23 30 37Z",
  };
  if (style === "bald") return null;
  if (style === "curls")
    return (
      <g fill={color}>
        {[
          [23, 29],
          [29, 17],
          [41, 13],
          [55, 12],
          [68, 19],
          [77, 29],
          [80, 43],
          [78, 58],
          [72, 70],
          [24, 67],
          [17, 55],
          [17, 42],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="10" />
        ))}
      </g>
    );
  if (style === "cap")
    return (
      <g fill="#507d56">
        <path d="M19 35Q17 8 48 9Q70 8 75 30L43 41Z" />
        <path d="M40 33Q68 18 86 23Q99 33 65 39Z" />
        <path d="M35 11L41 32" fill="none" />
      </g>
    );
  if (style === "beanie")
    return (
      <g fill="#c9613b">
        <path d="M20 34Q18 7 48 7Q76 6 79 36Z" />
        <path d="M20 30Q47 19 78 29L79 39Q49 29 21 43Z" />
        <path d="M31 12L35 27M46 8L48 24M61 11L64 25" fill="none" />
      </g>
    );
  return <path d={paths[style]} fill={color} />;
}

export function Avatar({
  id,
  decorative = false,
}: {
  id: number;
  decorative?: boolean;
}) {
  const number = isAvatarId(id) ? id : DEFAULT_AVATAR;
  const [
    background,
    skin,
    hair,
    shirt,
    hairstyle,
    glasses,
    accessory,
    expression,
  ] = characters[number - 1];
  const clip = useId();
  const happy = expression === "laugh" || expression === "grin";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="character-avatar"
      viewBox="0 0 100 100"
      width="100"
      height="100"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={
        decorative ? undefined : `Avatar ${number} : ${AVATARS[number - 1]}`
      }
      data-avatar-id={number}
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="50" cy="50" r="49" />
        </clipPath>
      </defs>
      <g
        clipPath={`url(#${clip})`}
        stroke="#163b43"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="50" cy="50" r="50" fill={background} stroke="none" />
        {(hairstyle === "bob" ||
          hairstyle === "curls" ||
          hairstyle === "pigtails") && <Hair style={hairstyle} color={hair} />}
        <path
          d="M12 105Q12 82 38 80L40 72H61L64 80Q88 82 90 105"
          fill={shirt}
        />
        <path d="M39 77Q49 91 63 77L61 68H40Z" fill={skin} />
        <g
          transform={
            number === 9
              ? "rotate(-9 50 50)"
              : number === 17
                ? "rotate(6 50 50)"
                : undefined
          }
        >
          <path
            d={
              number === 9
                ? "M28 37Q31 17 50 20Q72 20 74 39L69 67Q65 83 49 83Q32 79 30 64L22 57Q15 45 28 46Z"
                : "M27 39Q26 18 49 18Q74 17 74 40L76 46Q88 40 86 54Q85 64 75 62Q72 81 51 82Q29 81 25 61Q12 63 13 52Q13 42 25 46Z"
            }
            fill={skin}
          />
          {!["bob", "curls", "pigtails"].includes(hairstyle) && (
            <Hair style={hairstyle} color={hair} />
          )}
          {hairstyle === "curls" && (
            <path
              d="M27 38Q36 41 39 27Q49 40 56 25Q62 39 72 35Q74 19 50 18Q29 17 27 38Z"
              fill={hair}
            />
          )}
          {hairstyle === "pigtails" && (
            <path d="M27 35L37 21L45 32L53 22L68 34L64 21L39 18Z" fill={hair} />
          )}
          {hairstyle === "bob" && (
            <path
              d="M25 40Q45 38 56 25L70 42Q67 18 51 19Q31 19 25 40Z"
              fill={hair}
            />
          )}
          {number === 20 && (
            <g fill={hair}>
              <path d="M26 39Q11 30 17 48Q6 53 26 60M73 39Q90 30 83 48Q95 53 75 60" />
              <path d="M33 36Q39 27 46 34M56 33Q65 26 70 35" strokeWidth="5" />
            </g>
          )}
          <path
            d={
              expression === "raised"
                ? "M33 34Q38 28 44 32M57 35L67 37"
                : "M33 35Q38 32 43 35M57 34Q62 30 68 34"
            }
            fill="none"
            stroke={hair}
            strokeWidth="3"
          />
          {expression === "laugh" ? (
            <g fill="none">
              <path d="M33 46Q39 38 45 46M57 46Q63 38 69 46" />
            </g>
          ) : (
            <>
              <ellipse
                cx="39"
                cy="45"
                rx="6"
                ry="8"
                fill="#fffdf4"
                stroke="none"
              />
              <ellipse
                cx="40"
                cy={expression === "sleepy" ? 48 : 46}
                rx="2.8"
                ry="4.2"
                fill="#163b43"
                stroke="none"
              />
              {expression === "wink" ? (
                <path d="M57 46Q63 40 69 46" fill="none" />
              ) : (
                <>
                  <ellipse
                    cx="63"
                    cy="44"
                    rx="6"
                    ry="8"
                    fill="#fffdf4"
                    stroke="none"
                  />
                  <ellipse
                    cx="64"
                    cy={expression === "sleepy" ? 47 : 45}
                    rx="2.8"
                    ry="4.2"
                    fill="#163b43"
                    stroke="none"
                  />
                </>
              )}
              {expression === "sleepy" && (
                <path
                  d="M32 42H46M56 41H70"
                  fill="none"
                  strokeWidth="4"
                  stroke={skin}
                />
              )}
            </>
          )}
          {accessory === "longnose" ? (
            <path d="M53 49Q91 44 88 57Q82 65 56 58" fill={skin} />
          ) : (
            <path d="M51 47Q62 48 60 56Q58 60 49 57" fill={skin} />
          )}
          {glasses !== "none" && (
            <g
              fill="none"
              stroke={
                glasses === "angular"
                  ? "#bd4b3a"
                  : glasses === "teal"
                    ? "#26756d"
                    : "#163b43"
              }
              strokeWidth="2.8"
            >
              {glasses === "angular" ? (
                <path d="M28 36L48 39L46 54L34 55ZM55 39L77 34L71 54L57 54Z" />
              ) : (
                <>
                  <circle cx="39" cy="45" r="11" />
                  <circle cx="64" cy="44" r="11" />
                </>
              )}
              <path d="M49 44Q52 41 54 44M17 43L28 45M75 44L81 41" />
            </g>
          )}
          {(accessory === "beard" || accessory === "stubble") && (
            <path
              d="M28 57L35 64L42 59L50 63L61 59L73 55Q74 80 52 83Q30 80 28 57Z"
              fill={accessory === "stubble" ? skin : hair}
              stroke={hair}
              strokeDasharray={accessory === "stubble" ? "1 4" : undefined}
            />
          )}
          {expression === "surprise" ? (
            <ellipse cx="51" cy="68" rx="3.6" ry="5.2" fill="#163b43" />
          ) : happy ? (
            <>
              <path
                d="M35 62Q50 72 69 59Q63 81 49 78Q39 76 35 62Z"
                fill={expression === "laugh" ? "#163b43" : "#fffdf4"}
              />
              <path
                d="M38 64Q53 71 66 62L62 69Q48 75 39 68Z"
                fill="#fffdf4"
                stroke="none"
              />
            </>
          ) : (
            <path
              d={
                expression === "side"
                  ? "M43 67Q55 77 66 64M63 64L68 63"
                  : "M40 67Q51 76 64 65"
              }
              fill="none"
              stroke={accessory === "beard" ? "#fff0d6" : "#163b43"}
            />
          )}
          {(accessory === "moustache" || accessory === "bowtie") && (
            <path
              d="M51 59Q42 53 36 63Q34 71 50 65Q67 72 70 61Q63 54 54 59Z"
              fill={accessory === "bowtie" ? hair : hair}
            />
          )}
          {(accessory === "hoops" || accessory === "earrings") && (
            <g fill="#efbd45">
              <ellipse
                cx="24"
                cy="65"
                rx={accessory === "hoops" ? 4 : 3}
                ry={accessory === "hoops" ? 6 : 3}
              />
              <ellipse
                cx="78"
                cy="63"
                rx={accessory === "hoops" ? 4 : 3}
                ry={accessory === "hoops" ? 6 : 3}
              />
            </g>
          )}
          {accessory === "freckles" && (
            <g fill="#bf6349" stroke="none">
              {[30, 35, 40, 64, 69, 74].map((x, i) => (
                <circle key={x} cx={x} cy={56 + (i % 2) * 4} r="1.4" />
              ))}
            </g>
          )}
        </g>
        {number >= 21 && (
          <g fill="#fff4da">
            <path d="M36 81L43 94L49 87M64 81L57 94L51 87" />
            <path d="M24 88L31 99M77 88L70 99" fill="none" />
          </g>
        )}
        {accessory === "bowtie" && (
          <g fill="#be4e40">
            <path d="M48 87L37 82L37 96L48 92M53 87L64 82L64 96L53 92" />
            <circle cx="51" cy="89" r="4" />
          </g>
        )}
        {number === 11 && (
          <path
            d="M21 91H34M68 91H81M22 98H35M68 98H83"
            stroke="#fff4df"
            strokeWidth="4"
          />
        )}
        {number === 19 && (
          <path
            d="M65 99L61 87Q57 82 63 80L65 72Q67 69 69 73L68 81Q79 80 77 87L75 99"
            fill={skin}
          />
        )}
      </g>
    </svg>
  );
}

export function AvatarPicker({
  value,
  onChange,
  disabled = false,
  admin = false,
}: {
  value: number;
  onChange: (id: number) => void;
  disabled?: boolean;
  admin?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="avatar-picker" disabled={disabled}>
      <legend>
        {admin
          ? "Votre personnage de formateur"
          : "Choisissez votre personnage"}
      </legend>
      <div className="avatar-grid">
        {avatarIds(admin).map((id) => (
          <label
            className={"avatar-option" + (value === id ? " selected" : "")}
            key={id}
            title={AVATARS[id - 1]}
          >
            <input
              className="avatar-radio"
              type="radio"
              name={name}
              value={id}
              checked={value === id}
              onChange={() => onChange(id)}
              aria-label={`Avatar ${id} : ${AVATARS[id - 1]}`}
            />
            <Avatar id={id} decorative />
            <span className="avatar-number" aria-hidden="true">
              {id}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
