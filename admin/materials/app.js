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
  throw new Error("Unauthorized");
}


document.getElementById(
  "target"
).onchange = event => {

  document.getElementById(
    "studentBox"
  ).classList.toggle(
    "hidden",
    event.target.value !== "students"
  );

};


async function loadMaterials() {

  const {
    data,
    error
  } =
    await supabase
      .from("materials")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    console.error(error);

    return;
  }


  document.getElementById(
    "materials"
  ).innerHTML =
    (data || []).map(
      item => `

<div
  style="
    padding:15px 0;
    border-bottom:1px solid #eee;
  ">

<strong>
${escapeHtml(item.title)}
</strong>

<p>
${escapeHtml(item.description)}
</p>

<p>
${item.all_students
  ? "全Student"
  : "指定Student"}
</p>

</div>

`
    ).join("") ||
    "<p>配信済み資料はありません。</p>";

}


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

  const target =
    document.getElementById(
      "target"
    ).value;

  const ids =
    document.getElementById(
      "studentIds"
    ).value
      .split(",")
      .map(
        value => value.trim()
      )
      .filter(Boolean);


  if (!title || !file) {

    alert(
      "タイトルとファイルを入力してください。"
    );

    return;
  }


  if (
    target === "students" &&
    ids.length === 0
  ) {

    alert(
      "Student UIDを入力してください。"
    );

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
    ].includes(extension)
  ) {

    alert(
      "PDF、JPG、JPEG、PNGのみ対応しています。"
    );

    return;
  }


  const path =
    "materials/" +
    crypto.randomUUID() +
    "." +
    extension;


  const upload =
    await supabase.storage
      .from("web-viewer")
      .upload(
        path,
        file
      );


  if (upload.error) {

    console.error(upload.error);

    alert(
      "ファイルのアップロードに失敗しました。"
    );

    return;
  }


  const {
    data: material,
    error
  } =
    await supabase
      .from("materials")
      .insert({
        title,
        description,
        file_path: path,
        file_type: extension,
        all_students:
          target === "all",
        created_by:
          admin.id
      })
      .select()
      .single();


  if (error) {

    await supabase.storage
      .from("web-viewer")
      .remove([path]);

    console.error(error);

    alert(
      "資料登録に失敗しました。"
    );

    return;
  }


  if (
    target === "students"
  ) {

    const rows =
      ids.map(
        studentId => ({
          material_id:
            material.id,

          student_id:
            studentId
        })
      );


    const {
      error: recipientError
    } =
      await supabase
        .from(
          "material_recipients"
        )
        .insert(rows);


    if (recipientError) {

      console.error(
        recipientError
      );

      alert(
        "対象Studentの登録に失敗しました。"
      );

      return;
    }

  }


  document.getElementById(
    "title"
  ).value = "";

  document.getElementById(
    "description"
  ).value = "";

  document.getElementById(
    "file"
  ).value = "";

  document.getElementById(
    "studentIds"
  ).value = "";


  document.getElementById(
    "message"
  ).textContent =
    "配信しました。";


  await loadMaterials();

};


loadMaterials();
