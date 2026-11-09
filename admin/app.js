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
    "Admin authentication failed"
  );

}


/*
 * Admin名
 */

document.getElementById(
  "name"
).textContent =
  profile.display_name || "";


/*
 * サイドバー
 */

document.getElementById(
  "menu"
).onclick =
  openDrawer;


document.getElementById(
  "backdrop"
).onclick =
  closeDrawer;


/*
 * ログアウト
 */

document.getElementById(
  "logout"
).onclick =
  logout;


/*
 * Books件数
 */

const {
  count: bookCount,
  error: bookError
} =
  await supabase
    .from("books")
    .select(
      "id",
      {
        count: "exact",
        head: true
      }
    );


if (bookError) {

  console.error(
    "Books count error:",
    bookError
  );

}


/*
 * シリアル件数
 */

const {
  count: licenseCount,
  error: licenseError
} =
  await supabase
    .from("licenses")
    .select(
      "id",
      {
        count: "exact",
        head: true
      }
    );


if (licenseError) {

  console.error(
    "License count error:",
    licenseError
  );

}


/*
 * Student件数
 */

const {
  count: studentCount,
  error: studentError
} =
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


if (studentError) {

  console.error(
    "Student count error:",
    studentError
  );

}


/*
 * 表示
 */

document.getElementById(
  "bookCount"
).textContent =
  bookCount || 0;


document.getElementById(
  "licenseCount"
).textContent =
  licenseCount || 0;


document.getElementById(
  "studentCount"
).textContent =
  studentCount || 0;
