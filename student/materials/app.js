import {
  requireStudent,
  logout
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


document.getElementById(
  "logout"
).onclick =
  logout;


const container =
  document.getElementById(
    "materials"
  );


const {
  data,
  error
} =
  await supabase
    .from("materials")
    .select(`
      id,
      title,
      description,
      file_path,
      file_type,
      all_students,
      created_at,
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

  container.innerHTML =
    `
    <div class="material-card">
      資料を取得できませんでした。
    </div>
    `;

}
else {

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


  container.innerHTML =
    materials.map(
      item => `

<article class="material-card">

<h2>
${escapeHtml(
  item.title
)}
</h2>

<p>
${escapeHtml(
  item.description || ""
)}
</p>

<button
  class="primary-button"
  data-file="${escapeHtml(
    item.file_path || ""
  )}">
開く
</button>

<div class="material-date">
${new Date(
  item.created_at
).toLocaleDateString("ja-JP")}
</div>

</article>

`
    ).join("") ||
    `
    <div class="material-card">
      配信された資料はありません。
    </div>
    `;


  container
    .querySelectorAll(
      "[data-file]"
    )
    .forEach(
      button => {

        button.onclick =
          async () => {

            const {
              data: urlData,
              error: urlError
            } =
              await supabase.storage
                .from("web-viewer")
                .createSignedUrl(
                  button.dataset.file,
                  600
                );


            if (
              urlError ||
              !urlData?.signedUrl
            ) {

              alert(
                "資料を開けませんでした。"
              );

              return;
            }


            window.open(
              urlData.signedUrl,
              "_blank"
            );

          };

      }
    );

}
