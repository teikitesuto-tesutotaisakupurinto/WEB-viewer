import {
  requireAdmin,
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


async function start() {

  const admin =
    await requireAdmin();

  if (!admin) {
    return;
  }


  document.getElementById(
    "logout"
  ).onclick =
    event => {

      event.preventDefault();

      logout();

    };


  const target =
    document.getElementById(
      "target"
    );


  const studentArea =
    document.getElementById(
      "studentArea"
    );


  target.onchange =
    () => {

      studentArea.classList.toggle(
        "hidden",
        target.value !==
          "selected"
      );

    };


  document.getElementById(
    "selectAll"
  ).onchange =
    event => {

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
  ).onclick =
    createMaterial;


  await loadStudents();

  await loadMaterials();


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
      throw error;
    }


    document.getElementById(
      "students"
    ).innerHTML =
      (data || []).map(
        student => `

        <label class="student-row">

          <input
            class="student-check"
            type="checkbox"
            value="${student.id}">

          ${escapeHtml(
            student.display_name
          )}

        </label>

        `
      ).join("");

  }


  async function loadMaterials() {

    const box =
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
          all_students,
          created_at
        `)
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {
      throw error;
    }


    box.innerHTML =
      (data || []).map(
        material => `

        <div class="material-row">

          <div class="material-title">
            ${escapeHtml(
              material.title
            )}
          </div>

          <div class="material-target">
            ${
              material.all_students
                ? "全生徒"
                : "指定生徒"
            }
          </div>

        </div>

        `
      ).join("")
      ||
      "配信済み資料はありません。";

  }


  async function createMaterial() {

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


    const message =
      document.getElementById(
        "message"
      );


    if (
      !title ||
      !file
    ) {

      message.textContent =
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

      message.textContent =
        "PDF、JPG、JPEG、PNGのみ対応しています。";

      return;

    }


    try {

      const path =
        "materials/" +
        crypto.randomUUID() +
        "." +
        extension;


      const {
        error:
          uploadError
      } =
        await supabase.storage
          .from("web-viewer")
          .upload(
            path,
            file
          );


      if (uploadError) {
        throw uploadError;
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
        throw error;
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


        if (!ids.length) {

          throw new Error(
            "対象生徒を選択してください。"
          );

        }


        const {
          error:
            recipientError
        } =
          await supabase
            .from(
              "material_recipients"
            )
            .insert(
              ids.map(
                student_id => ({
                  material_id:
                    material.id,

                  student_id
                })
              )
            );


        if (recipientError) {
          throw recipientError;
        }

      }


      message.textContent =
        "資料を配信しました。";


      await loadMaterials();

    }
    catch (error) {

      message.textContent =
        "登録エラー: " +
        error.message;

    }

  }

}


start()
  .catch(
    error => {

      console.error(error);

      document.querySelector(
        ".admin-content"
      ).innerHTML += `

        <div class="page-error">

          <h2>
            資料画面を読み込めませんでした
          </h2>

          <p>
            ${escapeHtml(
              error.message
            )}
          </p>

        </div>

      `;

    }
  );
