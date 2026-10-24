(() => {
  let theme;
  try {
    const saved = localStorage.getItem("jlg-share-theme");
    if (saved === "light" || saved === "dark") theme = saved;
  } catch {}
  theme ??= matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#121b17" : "#f6f7f3");
})();
