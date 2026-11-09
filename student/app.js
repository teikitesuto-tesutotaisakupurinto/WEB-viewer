import {
  requireStudent
}
from "../assets/js/auth.js";

import {
  supabase
}
from "../assets/js/supabase.js";


const student =
  await requireStudent();


if (!student) {

  throw new Error(
    "Unauthorized"
  );

}


/*
 * メンテナンス確認
 */

const {
  data: maintenance,
  error
} =
  await supabase
    .from(
      "maintenance_settings"
    )
    .select(
      "enabled,message"
    )
    .eq(
      "id",
      1
    )
    .single();


if (error) {

  console.error(
    "MAINTENANCE CHECK ERROR:",
    error
  );

}


/*
 * メンテナンス中
 */

if (
  !error &&
  maintenance?.enabled
) {

  document.getElementById(
    "app"
  ).innerHTML = `

<div class="maintenance-page">

<div class="maintenance-card">

<div class="maintenance-title">
WEB-viewer
</div>

<h1>
メンテナンス中です
</h1>

<p>
${escapeHtml(
  maintenance.message
)}
</p>

</div>

</div>

`;


}
else {

  /*
   * 通常時はMy Booksへ直接
   */

  location.replace(
    "./books/"
  );

}


function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )
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
