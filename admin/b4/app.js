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


  const selectAll =
    document.getElementById(
      "selectAll"
    );


  selectAll.onchange =
    () => {

      document
        .querySelectorAll(
          ".student-check"
        )
        .forEach(
          checkbox => {

            checkbox.checked =
              selectAll.checked;

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


  await loadBooks();

  await loadStudents();


  /*
   * Book
   */

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


    const select =
      document.getElementById(
        "book"
      );


    select.innerHTML =
      `
      <option value="">
        Bookを選択してください
      </option>
      `;


    (data || []).forEach(
      book => {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          book.id;


        option.textContent =
          book.title;


        select.appendChild(
          option
        );

      }
    );

  }


  /*
   * Student
   */

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


    const box =
      document.getElementById(
        "students"
      );


    if (
      !data ||
      data.length === 0
    ) {

      box.innerHTML =
        `
        <div class="list-row">
          Studentが登録されていません。
        </div>
        `;

      return;

    }


    box.innerHTML =
      data.map(
        student => `

<label class="student-row">

<input
  class="student-check"
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


  /*
   * B4作成
   */

  async function createB4() {

    const message =
      document.getElementById(
        "message"
      );


    const bookId =
      document.getElementById(
        "book"
      ).value;


    const studentIds =
      Array.from(
        document.querySelectorAll(
          ".student-check:checked"
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


    message.textContent =
      "作成しています。";


    try {

      /*
       * Book
       */

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


      /*
       * License
       */

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
            studentIds
          );


      if (licenseError) {
        throw licenseError;
      }


      const licenseMap =
        new Map(
          (licenses || []).map(
            license => [
              license.student_id,
              license.code
            ]
          )
        );


      /*
       * Student
       */

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
            studentIds
          );


      if (studentError) {
        throw studentError;
      }


      /*
       * QR
       */

      if (
        !window.QRCode
      ) {

        await new Promise(
          (
            resolve,
            reject
          ) => {

            const script =
              document.createElement(
                "script"
              );


            script.src =
              "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";


            script.onload =
              resolve;


            script.onerror =
              reject;


            document.head.appendChild(
              script
            );

          }
        );

      }


      const sheets =
        document.getElementById(
          "sheets"
        );


      sheets.innerHTML =
        "";


      let created =
        0;


      for (
        const student
        of students || []
      ) {

        const code =
          licenseMap.get(
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

<div class="b4-qr">
</div>

<div class="b4-code">
${escapeHtml(
  code
)}
</div>

<p>
WEB-viewerで教材を利用してください。
</p>

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
            text:
              code,

            width:
              250,

            height:
              250
          }
        );


        created++;

      }


      if (
        created === 0
      ) {

        message.textContent =
          "選択したStudentには発行済みシリアルがありません。";

        return;

      }


      message.textContent =
        `${created}人分のB4資料を作成しました。`;


      /*
       * 作成後に一覧やダウンロード欄は
       * 追加しない。
       */

    }
    catch (error) {

      console.error(
        "B4 ERROR:",
        error
      );


      message.textContent =
        "作成エラー: " +
        error.message;

    }

  }

}


start()
  .catch(
    error => {

      console.error(
        "B4 PAGE ERROR:",
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
