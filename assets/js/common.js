export function escapeHtml(value) {

  return String(value ?? "")
    .replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[character])
    );
}


export function makeCode() {

  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (
    let i = 0;
    i < 12;
    i++
  ) {

    result +=
      characters[
        Math.floor(
          Math.random() *
          characters.length
        )
      ];
  }

  return (
    result.slice(0, 4) +
    "-" +
    result.slice(4, 8) +
    "-" +
    result.slice(8)
  );
}


export function openDrawer() {

  document
    .getElementById("drawer")
    ?.classList.add("open");

  document
    .getElementById("backdrop")
    ?.classList.add("show");
}


export function closeDrawer() {

  document
    .getElementById("drawer")
    ?.classList.remove("open");

  document
    .getElementById("backdrop")
    ?.classList.remove("show");
}
