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
    (data || []).map(item => `

<div class="card">

<h3>
${escapeHtml(item.title)}
</h3>

<p>
${escapeHtml(item.description)}
</p>

</div>

`).join("");
}


document.getElementById(
  "send"
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

  const studentIds =
    document.getElementById(
      "students"
    ).value
      .split(",")
      .map(value => value.trim())
      .filter(Boolean);


  if (!title || !file) {

    alert(
      "タイトルとファイルを指定してください。"
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

    console.error(
      upload.error
    );

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
          studentIds.length === 0,
        created_by: admin.id
      })
      .select()
      .single();


  if (error) {

    await supabase.storage
      .from("web-viewer")
      .remove([path]);

    alert(
      "資料登録に失敗しました。"
    );

    return;
  }


  if (studentIds.length > 0) {

    const recipients =
      studentIds.map(
        studentId => ({
          material_id:
            material.id,

          student_id:
            studentId
        })
      );


    await supabase
      .from(
        "material_recipients"
      )
      .insert(recipients);

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
    "students"
  ).value = "";


  document.getElementById(
    "message"
  ).textContent =
    "配信しました。";


  await loadMaterials();

};


loadMaterials();
