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
