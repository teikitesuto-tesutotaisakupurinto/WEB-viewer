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


const bookSelect =
  document.getElementById(
    "book"
  );

const studentList =
  document.getElementById(
    "students"
  );

const selectAll =
  document.getElementById(
    "selectAll"
  );

const sheets =
  document.getElementById(
    "sheets"
  );

const message =
  document.getElementById(
    "message"
  );


let students = [];


/*
 * QRライブラリ
 */

function loadQRCode() {

  return new Promise(
    (resolve, reject) => {

      if (
        window.QRCode
      ) {

        resolve();

        return;
      }


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


/*
 * Book取得
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

    console.error(
      error
    );

    message.textContent =
      "Bookを取得できませんでした。";

    return;
  }


  bookSelect.innerHTML =
    (data || []).map(
      book => `

<option value="${book.id}">
${escapeHtml(book.title)}
</option>

`
    ).join("");


  await loadStudents();

}


/*
 * Student取得
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

    console.error(
      error
    );

    message.textContent =
      "Studentを取得できませんでした。";

    return;
  }


  students =
    data || [];


  renderStudents();

}


function renderStudents() {

  if (
    students.length === 0
  ) {

    studentList.innerHTML =
      "<p>登録されたStudentはいません。</p>";

    return;
  }


  studentList.innerHTML =
    students.map(
      student => `

<label class="student-item">

<input
  type="checkbox"
  class="student-checkbox"
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


selectAll.onchange = () => {

  document
    .querySelectorAll(
      ".student-checkbox"
    )
    .forEach(
      checkbox => {

        checkbox.checked =
          selectAll.checked;

      }
    );

};


/*
 * B4作成
 */

document.getElementById(
  "create"
).onclick = async () => {

  message.style.color =
    "#222";

  message.textContent =
    "作成しています。";


  const bookId =
    bookSelect.value;


  const selectedStudents =
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
    selectedStudents.length === 0
  ) {

    message.textContent =
      "Studentを選択してください。";

    return;
  }


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
        "id,title"
      )
      .eq(
        "id",
        bookId
      )
      .single();


  if (
    bookError ||
    !book
  ) {

    message.textContent =
      "Bookを取得できませんでした。";

    return;
  }


  /*
   * Studentごとの固有シリアル
   */

  const {
    data: licenses,
    error: licenseError
  } =
    await supabase
      .from("licenses")
      .select(
        "id,code,student_id,status"
      )
      .eq(
        "book_id",
        bookId
      )
      .in(
        "student_id",
        selectedStudents
      );


  if (licenseError) {

    console.error(
      licenseError
    );

    message.textContent =
      "シリアルを取得できませんでした。";

    return;
  }


  const licenseMap =
    new Map(
      (licenses || []).map(
        license => [
          license.student_id,
          license
        ]
      )
    );


  /*
   * シリアルがないStudentがいる場合
   */

  const missingStudents =
    selectedStudents.filter(
      studentId =>
        !licenseMap.has(
          studentId
        )
    );


  if (
    missingStudents.length > 0
  ) {

    message.textContent =
      "シリアルが発行されていないStudentが含まれています。";

    return;
  }


  /*
   * QRライブラリ
   */

  try {

    await loadQRCode();

  }
  catch {

    message.textContent =
      "QRコード機能を読み込めませんでした。";

    return;
  }


  sheets.innerHTML =
    "";


  /*
   * B4生成
   */

  for (
    const studentId
    of selectedStudents
  ) {

    const student =
      students.find(
        item =>
          item.id ===
          studentId
      );


    const license =
      licenseMap.get(
        studentId
      );


    if (
      !student ||
      !license
    ) {
      continue;
    }


    const sheet =
      document.createElement(
        "div"
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

<div class="b4-student">
${escapeHtml(
  student.display_name
)}
</div>

<div
  class="b4-qr"
  id="qr-${student.id}">
</div>

<div class="b4-code">
${escapeHtml(
  license.code
)}
</div>

<div>
QRコードを読み取って利用してください。
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
        "#qr-" +
        student.id
      ),
      {
        text:
          license.code,

        width:
          250,

        height:
          250
      }
    );

  }


  message.style.color =
    "#222";

  message.textContent =
    `${selectedStudents.length}人分のB4資料を作成しました。`;

};


document.getElementById(
  "printAll"
).onclick = () => {

  if (
    !sheets.children.length
  ) {

    alert(
      "先にB4資料を作成してください。"
    );

    return;
  }


  window.print();

};


await loadBooks();
