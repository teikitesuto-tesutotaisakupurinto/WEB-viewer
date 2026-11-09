import {
  requireAdmin,
  logout
}
from "../assets/js/auth.js";

import {
  supabase
}
from "../assets/js/supabase.js";

import {
  openDrawer,
  closeDrawer
}
from "../assets/js/common.js";


const profile =
  await requireAdmin();

if (!profile) {
  throw new Error(
    "Unauthorized"
  );
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


const books =
  await supabase
    .from("books")
    .select(
      "id",
      {
        count: "exact",
        head: true
      }
    );


const licenses =
  await supabase
    .from("licenses")
    .select(
      "id",
      {
        count: "exact",
        head: true
      }
    );


const students =
  await supabase
    .from("users")
    .select(
      "id",
      {
        count: "exact",
        head: true
      }
    )
    .eq(
      "role",
      "student"
    );


document.getElementById(
  "bookCount"
).textContent =
  books.count || 0;


document.getElementById(
  "licenseCount"
).textContent =
  licenses.count || 0;


document.getElementById(
  "studentCount"
).textContent =
  students.count || 0;
