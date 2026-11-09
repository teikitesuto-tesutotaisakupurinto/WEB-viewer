import {
  requireAdmin
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


const admin =
  await requireAdmin();

if (!admin) {
  throw new Error(
    "Unauthorized"
  );
}


const target =
  document.getElementById(
    "target"
  );

const studentBox =
  document.getElementById(
    "studentBox"
  );


target.onchange = () => {

  studentBox.classList.toggle(
    "hidden",
    target.value !==
      "students"
  );

};


async function loadStudents() {

  const {
    data,
    error
  } =
    await supabase
      .from("users")
      .select(
        "id,display_name"
      )
      .eq(
        "role",
        "student"
      )
      .order(
        "display_name"
      );


  if (error) {
    console.error(error);
    return;
  }


  document.getElementById(
    "students"
  ).innerHTML =
    (data || []).map(
      student => `

<label class="select-row">

<input
  type="checkbox"
  class="student-check"
  value="${student.id}">

${escapeHtml(
  student.display_name
)}

</label>

`
    ).join("");

}


document.getElementById(
  "selectAll"
).onchange = event => {

  document
    .querySelectorAll(
      ".student-check"
    )
    .forEach(
      checkbox => {

        checkbox.checked =
          event.target.checked;

      }
    );

};


document.getElementById(
  "create"
).onclick = async () => {

  const title =
    document.getElementById(
      "title"
    ).value.trim();

  const description =
    document.getElementById(
      "description"
    ).value.trim();

  const file =
    document.getElementById(
      "file"
    ).files[0];


  if (
    !title ||
    !file
  ) {

    document.getElementById(
      "message"
    ).textContent =
      "タイトルとファイルを入力してください。";

    return;
  }


  const extension =
    file.name
      .split(".")
      .pop()
      .toLowerCase();


  if (
    ![
      "pdf",
      "jpg",
      "jpeg",
      "png"
    ].includes(
      extension
    )
  ) {

    document.getElementById(
      "message"
    ).textContent =
      "PDF、JPG、JPEG、PNGのみ対応しています。";

    return;
  }


  const path =
    "materials/" +
    crypto.randomUUID() +
    "." +
    extension;


  document.getElementById(
    "message"
  ).textContent =
    "配信しています。";


  const {
    error: uploadError
  } =
    await supabase.storage
      .from("web-viewer")
      .upload(
        path,
        file
      );


  if (uploadError) {

    console.error(
      uploadError
    );

    document.getElementById(
      "message"
    ).textContent =
      "ファイルのアップロードに失敗しました。";

    return;
  }


  const allStudents =
    target.value ===
    "all";


  const {
    data: material,
    error
  } =
    await supabase
      .from("materials")
      .insert({
        title,
        description,
        file_path:
          path,
        file_type:
          extension,
        all_students:
          allStudents,
        created_by:
          admin.id
      })
      .select()
      .single();


  if (error) {

    await supabase.storage
      .from("web-viewer")
      .remove([
        path
      ]);

    console.error(error);

    document.getElementById(
      "message"
    ).textContent =
      "資料登録に失敗しました。";

    return;
  }


  if (!allStudents) {

    const ids =
      Array.from(
        document.querySelectorAll(
          ".student-check:checked"
        )
      ).map(
        checkbox =>
          checkbox.value
      );


    if (
      ids.length === 0
    ) {

      document.getElementById(
        "message"
      ).textContent =
        "対象Studentを選択してください。";

      return;
    }


    const rows =
      ids.map(
        id => ({
          material_id:
            material.id,

          student_id:
            id
        })
      );


    const {
      error:
        recipientError
    } =
      await supabase
        .from(
          "material_recipients"
        )
        .insert(
          rows
        );


    if (recipientError) {

      console.error(
        recipientError
      );

      return;
    }

  }


  document.getElementById(
    "message"
  ).textContent =
    "資料を配信しました。";


  document.getElementById(
    "title"
  ).value = "";

  document.getElementById(
    "description"
  ).value = "";

  document.getElementById(
    "file"
  ).value = "";


  await loadMaterials();

};


async function loadMaterials() {

  const {
    data,
    error
  } =
    await supabase
      .from("materials")
      .select(
        "id,title,description,all_students,created_at"
      )
      .order(
        "created_at",
        {
          ascending:
            false
        }
      );


  if (error) {
    return;
  }


  document.getElementById(
    "materials"
  ).innerHTML =
    (data || []).map(
      item => `

<div class="list-row">

<div>

<strong>
${escapeHtml(
  item.title
)}
</strong>

<div class="muted">
${item.all_students
  ? "全Student"
  : "指定Student"}
</div>

</div>

</div>

`
    ).join("") ||
    "<p>配信済み資料はありません。</p>";

}


await loadStudents();
await loadMaterials();
