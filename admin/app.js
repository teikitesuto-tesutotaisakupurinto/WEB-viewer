import {
  requireAdmin,
  logout
}
from "../assets/js/auth.js";

import {
  supabase
}
from "../assets/js/supabase.js";


const admin =
  await requireAdmin();

if (!admin) {
  throw new Error("Unauthorized");
}


document.getElementById(
  "logout"
).onclick = logout;


const [
  books,
  licenses,
  students
] =
  await Promise.all([

    supabase
      .from("books")
      .select(
        "id",
        {
          count: "exact",
          head: true
        }
      ),

    supabase
      .from("licenses")
      .select(
        "id",
        {
          count: "exact",
          head: true
        }
      ),

    supabase
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
      )

  ]);


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
