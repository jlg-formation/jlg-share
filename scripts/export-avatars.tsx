import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Avatar } from "../src/client/Avatar";
import { AVATARS } from "../src/shared/avatars";

// Export the same vectors used in the interface as a numbered review sheet.
const sheet = renderToStaticMarkup(
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1000"
    height="1220"
    viewBox="0 0 1000 1220"
    role="img"
    aria-label="JLG Share : 20 avatars stagiaires et 6 avatars formateur"
  >
    <rect width="1000" height="1220" fill="#fffdf8" />
    <text
      x="28"
      y="954"
      fontFamily="Segoe UI, sans-serif"
      fontSize="24"
      fontWeight="700"
      fill="#163b43"
    >
      Collection réservée au formateur
    </text>
    {AVATARS.map((label, index) => (
      <g
        key={label}
        transform={
          index < 20
            ? `translate(${(index % 5) * 200 + 24} ${Math.floor(index / 5) * 230 + 16})`
            : `translate(${(index - 20) * 166 + 7} 978)`
        }
      >
        <svg width="152" height="152" viewBox="0 0 100 100">
          <Avatar id={index + 1} />
        </svg>
        <text
          x="76"
          y="181"
          textAnchor="middle"
          fontFamily="Segoe UI, sans-serif"
          fontSize="22"
          fontWeight="700"
          fill="#163b43"
        >
          {index + 1}
        </text>
        <text
          x="76"
          y="205"
          textAnchor="middle"
          fontFamily="Segoe UI, sans-serif"
          fontSize="12"
          fill="#163b43"
        >
          {label}
        </text>
      </g>
    ))}
  </svg>,
);
await Bun.write(new URL("../docs/avatars.svg", import.meta.url), sheet + "\n");
