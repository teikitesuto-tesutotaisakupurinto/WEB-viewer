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
      .order("title");


  if (error) {
    throw error;
  }


  document.getElementById(
    "book"
  ).innerHTML =
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
          class="student-checkbox"
          type="checkbox"
          value="${student.id}">

        ${escapeHtml(
          student.display_name
        )}

      </label>

      `
    ).join("");

}


async function issue(admin) {

  const bookId =
    document.getElementById(
      "book"
    ).value;


  const studentIds =
    Array.from(
      document.querySelectorAll(
        ".student-checkbox:checked"
      )
    ).map(
      checkbox =>
        checkbox.value
    );


  const message =
    document.getElementById(
      "message"
    );


  if (!bookId) {

    message.textContent =
      "Bookを選択してください。";

    return;

  }


  if (!studentIds.length) {

    message.textContent =
      "生徒を選択してください。";

    return;

  }


  message.textContent =
    "発行しています。";


  try {

    const {
      data: existing,
      error
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


    if (error) {
      throw error;
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


    if (!newIds.length) {

      message.textContent =
        "選択した生徒にはすでに発行済みです。";

      return;

    }


    const {
      error:
        insertError
    } =
      await supabase
        .from("licenses")
        .insert(
          newIds.map(
            student_id => ({
              book_id:
                bookId,

              student_id,

              status:
                "unused",

              created_by:
                admin.id

            })
          )
        );


    if (insertError) {
      throw insertError;
    }


    message.textContent =
      `${newIds.length}人分を発行しました。`;


    await loadSerials();

  }
  catch (error) {

    message.textContent =
      "発行エラー: " +
      error.message;

  }

}


async function loadSerials() {

  const box =
    document.getElementById(
      "serials"
    );


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
        books(title),
        users:student_id(display_name)
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


  if (!data?.length) {

    box.innerHTML =
      `
      <div class="list-row">
        発行済みシリアルはありません。
      </div>
      `;

    return;

  }


  box.innerHTML =
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

        <div>
          ${
            item.status === "used"
              ? "使用済み"
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

      console.error(error);

      const box =
        document.querySelector(
          ".admin-content"
        );

      box.innerHTML += `
        <div class="page-error">
          <h2>シリアル管理を読み込めませんでした</h2>
          <p>${escapeHtml(error.message)}</p>
          <button onclick="location.reload()">
            再読み込み
          </button>
        </div>
      `;

    }
  );
