import {
  requireStudent
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";

import {
  escapeHtml
}
from "../../assets/js/common.js";


const student =
  await requireStudent();

if (!student) {
  throw new Error("Unauthorized");
}


const {
  data,
  error
} =
  await supabase
    .from("materials")
    .select(`
      *,
      material_recipients (
        student_id
      )
    `)
    .eq(
      "enabled",
      true
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


if (error) {

  console.error(error);

}


const materials =
  (data || []).filter(
    item => {

      if (
        item.all_students
      ) {
        return true;
      }


      return (
        item.material_recipients ||
        []
      ).some(
        recipient =>
          recipient.student_id ===
          student.id
      );

    }
  );


const container =
  document.getElementById(
    "materials"
  );


container.innerHTML =
  materials.map(
    item => `

<div class="card">

<h2>
${escapeHtml(item.title)}
</h2>

<p>
${escapeHtml(item.description)}
</p>

<button
  class="primary-button"
  data-file="${escapeHtml(
    item.file_path || ""
  )}">
開く
</button>

</div>

`
  ).join("") ||
  `<div class="card">
    資料はありません。
  </div>`;


container
  .querySelectorAll(
    "[data-file]"
  )
  .forEach(
    button => {

      button.onclick =
        async () => {

          const {
            data,
            error
          } =
            await supabase.storage
              .from("web-viewer")
              .createSignedUrl(
                button.dataset.file,
                300
              );


          if (error) {

            alert(
              "資料を開けませんでした。"
            );

            return;
          }


          location.href =
            data.signedUrl;

        };

    }
  );
