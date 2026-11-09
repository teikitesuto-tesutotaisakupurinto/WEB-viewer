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

const message =
  document.getElementById(
    "message"
  );


let students = [];


/*
 * Book一覧
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
      "BOOK ERROR:",
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
 * Student一覧
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
      "STUDENT ERROR:",
      error
    );

    studentList.textContent =
      "Studentを取得できませんでした。";

    return;
  }


  students =
    data || [];


  renderStudents();

}


/*
 * Student表示
 */

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

<label
  class="student-select-item">

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


/*
 * 全選択
 */

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
 * 一括発行
 */

document.getElementById(
  "issue"
).onclick = async () => {

  message.style.color =
    "#222";

  message.textContent =
    "発行しています。";


  const bookId =
    bookSelect.value;


  const selected =
    Array.from(
      document.querySelectorAll(
        ".student-checkbox:checked"
      )
    )
    .map(
      checkbox =>
        checkbox.value
    );


  if (!bookId) {

    message.textContent =
      "Bookを選択してください。";

    return;
  }


  if (
    selected.length === 0
  ) {

    message.textContent =
      "Studentを選択してください。";

    return;
  }


  /*
   * 既存の利用権を確認
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
        selected
      );


  if (existingError) {

    console.error(
      existingError
    );

    message.textContent =
      "既存シリアルの確認に失敗しました。";

    return;
  }


  const existingIds =
    new Set(
      (existing || [])
        .map(
          row =>
            row.student_id
        )
    );


  const newStudents =
    selected.filter(
      id =>
        !existingIds.has(id)
    );


  if (
    newStudents.length === 0
  ) {

    message.textContent =
      "選択したStudentにはすでにシリアルが発行されています。";

    return;
  }


  /*
   * コードはDB側で自動生成
   */

  const rows =
    newStudents.map(
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
      .insert(rows);


  if (error) {

    console.error(
      "LICENSE INSERT ERROR:",
      error
    );

    message.textContent =
      "シリアル発行に失敗しました: " +
      error.message;

    return;
  }


  message.style.color =
    "#222";

  message.textContent =
    `${newStudents.length}人分のシリアルを発行しました。`;


  selectAll.checked =
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

};


/*
 * 発行済み一覧
 */

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

    console.error(
      "SERIAL LIST ERROR:",
      error
    );

    return;
  }


  document.getElementById(
    "serials"
  ).innerHTML = `

<div class="table-wrap">

<table>

<thead>

<tr>

<th>
Book
</th>

<th>
Student
</th>

<th>
シリアル
</th>

<th>
状態
</th>

</tr>

</thead>

<tbody>

${(data || []).map(
  item => `

<tr>

<td>
${escapeHtml(
  item.books?.title || ""
)}
</td>

<td>
${escapeHtml(
  item.users?.display_name || ""
)}
</td>

<td>
${escapeHtml(
  item.code
)}
</td>

<td>
${item.status === "used"
  ? "使用済み"
  : item.status === "disabled"
    ? "停止"
    : "未使用"}
</td>

</tr>

`
).join("")}

</tbody>

</table>

</div>

`;

}


await loadBooks();
await loadSerials();
