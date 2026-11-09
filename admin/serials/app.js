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
  escapeHtml,
  showError
}
from "../../assets/js/common.js";


const bookSelect =
  document.getElementById(
    "book"
  );

const studentsBox =
  document.getElementById(
    "students"
  );

const serialsBox =
  document.getElementById(
    "serials"
  );

const message =
  document.getElementById(
    "message"
  );


async function start() {

  const admin =
    await requireAdmin();

  if (!admin) {
    return;
  }


  document.getElementById(
    "logout"
  ).onclick =
    logout;


  document.getElementById(
    "selectAll"
  ).onchange =
    event => {

      document
        .querySelectorAll(
          ".student-checkbox"
        )
        .forEach(
          checkbox => {

            checkbox.checked =
              event.target.checked;

          }
        );

    };


  document.getElementById(
    "issue"
  ).onclick =
    () => issue(admin);


  await loadBooks();

  await loadStudents();

  await loadSerials();

}


async function loadBooks() {

  const {
    data,
    error
  } =
    await supabase
      .from("books")
      .select(
        "id,title"
      )
      .eq(
        "enabled",
        true
      )
      .order(
        "title",
        {
          ascending: true
        }
      );


  if (error) {
    throw error;
  }


  bookSelect.innerHTML =
    `
    <option value="">
      Bookを選択してください
    </option>
    ` +
    (data || []).map(
      book => `
      <option value="${book.id}">
        ${escapeHtml(book.title)}
      </option>
      `
    ).join("");

}


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
        "display_name",
        {
          ascending: true
        }
      );


  if (error) {
    throw error;
  }


  if (
    !data ||
    data.length === 0
  ) {

    studentsBox.innerHTML =
      `
      <div class="list-row">
        Studentが登録されていません。
      </div>
      `;

    return;
  }


  studentsBox.innerHTML =
    data.map(
      student => `
      <label class="student-row">

        <input
          class="student-checkbox"
          type="checkbox"
          value="${student.id}">

        <span>
          ${escapeHtml(
            student.display_name
          )}
        </span>

      </label>
      `
    ).join("");

}


async function issue(
  admin
) {

  const bookId =
    bookSelect.value;


  const studentIds =
    Array.from(
      document.querySelectorAll(
        ".student-checkbox:checked"
      )
    ).map(
      checkbox =>
        checkbox.value
    );


  if (!bookId) {

    message.textContent =
      "Bookを選択してください。";

    return;
  }


  if (
    studentIds.length === 0
  ) {

    message.textContent =
      "Studentを選択してください。";

    return;
  }


  message.style.color =
    "#222";

  message.textContent =
    "発行しています。";


  /*
   * 既存発行を確認
   */

  const {
    data: existing,
    error: existingError
  } =
    await supabase
      .from("licenses")
      .select(
        "student_id"
      )
      .eq(
        "book_id",
        bookId
      )
      .in(
        "student_id",
        studentIds
      );


  if (existingError) {

    message.textContent =
      "既存シリアルの確認に失敗しました: " +
      existingError.message;

    return;
  }


  const existingIds =
    new Set(
      (existing || []).map(
        row =>
          row.student_id
      )
    );


  const newIds =
    studentIds.filter(
      id =>
        !existingIds.has(id)
    );


  if (
    newIds.length === 0
  ) {

    message.textContent =
      "選択したStudentにはすでにシリアルが発行されています。";

    return;
  }


  /*
   * codeはDB側のDEFAULTで
   * 自動生成
   */

  const rows =
    newIds.map(
      studentId => ({
        book_id:
          bookId,

        student_id:
          studentId,

        status:
          "unused",

        created_by:
          admin.id
      })
    );


  const {
    error
  } =
    await supabase
      .from("licenses")
      .insert(
        rows
      );


  if (error) {

    message.style.color =
      "#b00020";

    message.textContent =
      "発行エラー: " +
      error.message;

    return;
  }


  message.style.color =
    "#222";

  message.textContent =
    `${newIds.length}人分のシリアルを発行しました。`;


  document.getElementById(
    "selectAll"
  ).checked =
    false;


  document
    .querySelectorAll(
      ".student-checkbox"
    )
    .forEach(
      checkbox => {

        checkbox.checked =
          false;

      }
    );


  await loadSerials();

}


async function loadSerials() {

  const {
    data,
    error
  } =
    await supabase
      .from("licenses")
      .select(`
        id,
        code,
        status,
        created_at,
        books (
          title
        ),
        users:student_id (
          display_name
        )
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


  if (
    !data ||
    data.length === 0
  ) {

    serialsBox.innerHTML =
      `
      <div class="list-row">
        発行済みシリアルはありません。
      </div>
      `;

    return;
  }


  serialsBox.innerHTML =
    data.map(
      item => `

      <div class="serial-row">

        <div>
          ${escapeHtml(
            item.books?.title || ""
          )}
        </div>

        <div>
          ${escapeHtml(
            item.users?.display_name || ""
          )}
        </div>

        <div class="serial-code">
          ${escapeHtml(
            item.code || ""
          )}
        </div>

        <div class="serial-status">
          ${
            item.status === "used"
              ? "使用済み"
              : item.status === "disabled"
                ? "停止"
                : "未使用"
          }
        </div>

      </div>

      `
    ).join("");

}


start()
  .catch(
    error => {

      console.error(
        "SERIAL PAGE ERROR:",
        error
      );


      showError(
        error.message,
        document.querySelector(
          ".admin-content"
        )
      );

    }
  );
