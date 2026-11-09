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


const bookSelect =
  document.getElementById(
    "book"
  );

const studentsBox =
  document.getElementById(
    "students"
  );


async function loadBooks() {

  const {
    data
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


  bookSelect.innerHTML =
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
    data
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


  studentsBox.innerHTML =
    `
    <div class="student-select">
    ${
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
      ).join("")
    }
    </div>
    `;
}


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
  async () => {

    const bookId =
      bookSelect.value;


    const studentIds =
      Array.from(
        document.querySelectorAll(
          ".student-check:checked"
        )
      ).map(
        checkbox =>
          checkbox.value
      );


    if (
      !bookId ||
      studentIds.length === 0
    ) {

      document.getElementById(
        "message"
      ).textContent =
        "BookとStudentを選択してください。";

      return;
    }


    const {
      data: book
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


    const {
      data: licenses
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
          studentIds
        );


    const licenseMap =
      new Map(
        (licenses || []).map(
          license => [
            license.student_id,
            license.code
          ]
        )
      );


    const {
      data: students
    } =
      await supabase
        .from("users")
        .select(
          "id,display_name"
        )
        .in(
          "id",
          studentIds
        );


    const qrScript =
      document.createElement(
        "script"
      );

    qrScript.src =
      "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";

    await new Promise(
      resolve => {

        qrScript.onload =
          resolve;

        document.head.appendChild(
          qrScript
        );

      }
    );


    const sheets =
      document.getElementById(
        "sheets"
      );

    sheets.innerHTML =
      "";


    (students || []).forEach(
      student => {

        const code =
          licenseMap.get(
            student.id
          );


        if (!code) {
          return;
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

<div>
${escapeHtml(
  book.title
)}
</div>

<div class="b4-name">
${escapeHtml(
  student.display_name
)}
</div>

<div
  class="b4-qr">
</div>

<div class="b4-code">
${escapeHtml(code)}
</div>

<div>
WEB-viewerで教材を利用してください。
</div>

<div class="b4-note">
※ 紛失の場合はこちらでは対応しかねますのでご注意ください。
</div>

`;


        sheets.appendChild(
          sheet
        );


        new QRCode(
          sheet.querySelector(
            ".b4-qr"
          ),
          {
            text: code,
            width: 250,
            height: 250
          }
        );

      }
    );


    document.getElementById(
      "message"
    ).textContent =
      "B4資料を作成しました。";

  };


await loadBooks();
await loadStudents();
