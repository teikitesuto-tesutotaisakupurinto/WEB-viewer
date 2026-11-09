import {
  requireStudent,
  logout
}
from "../assets/js/auth.js";

import {
  openDrawer,
  closeDrawer
}
from "../assets/js/common.js";


const profile =
  await requireStudent();

if (!profile) {
  throw new Error("Unauthorized");
}


document.getElementById(
  "name"
).textContent =
  profile.display_name;


document.getElementById(
  "menu"
).onclick =
  openDrawer;


document.getElementById(
  "backdrop"
).onclick =
  closeDrawer;


document.getElementById(
  "logout"
).onclick =
  logout;
