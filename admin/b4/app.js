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


document.getElementById(
  "logout"
).onclick =
  () => logout();


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
  createB4;


document.getElementById(
  "print"
).onclick =
  () => {

    const sheets =
      document.getElementById(
        "sheets"
      );


    if (
      !sheets.children.length
    ) {

      document.getElementById(
        "message"
      ).textContent =
        "先にB4資料を作成してください。";

      return;
    }


    window.print();

  };


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
      "title"
    );


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
    (data || [])
      .map(
        book => `

        <option value="${book.id}">
          ${escapeHtml(
            book.title
          )}
        </option>

        `
      )
      .join("");

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
    (data || [])
      .map(
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
      )
      .join("");

}


async function createB4() {

  const bookId =
    document.getElementById(
      "book"
    ).value;


  const ids =
    Array.from(
      document.querySelectorAll(
        ".student-check:checked"
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


  if (!ids.length) {

    message.textContent =
      "生徒を選択してください。";

    return;
  }


  try {

    const {
      data: book,
      error: bookError
    } =
    await supabase
      .from("books")
      .select(
        "title"
      )
      .eq(
        "id",
        bookId
      )
      .single();


    if (bookError) {
      throw bookError;
    }


    const {
      data: licenses,
      error: licenseError
    } =
    await supabase
      .from("licenses")
      .select(
        "student_id,code"
      )
      .eq(
        "book_id",
        bookId
      )
      .in(
        "student_id",
        ids
      );


    if (licenseError) {
      throw licenseError;
    }


    const codes =
      new Map(
        (licenses || []).map(
          row => [
            row.student_id,
            row.code
          ]
        )
      );


    const {
      data: students,
      error: studentError
    } =
    await supabase
      .from("users")
      .select(
        "id,display_name"
      )
      .in(
        "id",
        ids
      );


    if (studentError) {
      throw studentError;
    }


    const sheets =
      document.getElementById(
        "sheets"
      );


    sheets.innerHTML = "";


    let count = 0;


    for (
      const student of students || []
    ) {

      const code =
        codes.get(
          student.id
        );


      if (!code) {
        continue;
      }


      const sheet =
        document.createElement(
          "section"
        );


      sheet.className =
        "b4-sheet";


      sheet.innerHTML = `

        <h2>
          WEB-viewer
        </h2>

        <div class="b4-book">
          ${escapeHtml(
            book.title
          )}
        </div>

        <div class="b4-name">
          ${escapeHtml(
            student.display_name
          )}
        </div>

        <div class="b4-qr"></div>

        <div class="b4-code">
          ${escapeHtml(code)}
        </div>

        <p>
          WEB-viewerで教材を利用してください。
        </p>

      `;


      sheets.appendChild(
        sheet
      );


      if (
        window.QRCode
      ) {

        new QRCode(
          sheet.querySelector(
            ".b4-qr"
          ),
          {
            text:
              code,

            width:
              250,

            height:
              250
          }
        );

      }


      count++;

    }


    message.textContent =
      count
        ? `${count}人分のB4資料を作成しました。`
        : "発行済みシリアルがありません。";

  }
  catch (error) {

    message.textContent =
      "作成エラー: " +
      error.message;

  }

}


async function start() {

  const admin =
    await requireAdmin();

  if (!admin) {
    return;
  }


  await loadBooks();

  await loadStudents();

}


start()
.catch(
  error => {

    document.querySelector(
      ".admin-content"
    ).insertAdjacentHTML(
      "beforeend",
      `
      <div class="page-error">

        <h2>
          B4資料を読み込めませんでした
        </h2>

        <p>
          データの取得に失敗しました。
        </p>

      </div>
      `
    );

  }
);
