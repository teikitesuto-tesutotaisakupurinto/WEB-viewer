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


const formCard =
  document.getElementById(
    "formCard"
  );


const message =
  document.getElementById(
    "message"
  );


document.getElementById(
  "showForm"
).onclick = () => {

  formCard.classList.remove(
    "hidden"
  );

};


document.getElementById(
  "cancel"
).onclick = () => {

  formCard.classList.add(
    "hidden"
  );

  message.textContent = "";

};


async function loadStudents() {

  const {
    data,
    error
  } =
    await supabase
      .from("users")
      .select(`
        id,
        display_name,
        class_name,
        student_number
      `)
      .eq(
        "role",
        "student"
      )
      .order(
        "display_name"
      );


  if (error) {

    console.error(error);

    document.getElementById(
      "students"
    ).textContent =
      "Student一覧を取得できませんでした。";

    return;
  }


  if (
    !data ||
    data.length === 0
  ) {

    document.getElementById(
      "students"
    ).innerHTML =
      "<p>登録されたStudentはいません。</p>";

    return;
  }


  document.getElementById(
    "students"
  ).innerHTML = `

<div class="table-wrap">

<table>

<thead>

<tr>

<th>
氏名
</th>

<th>
クラス
</th>

<th>
学籍番号
</th>

</tr>

</thead>

<tbody>

${data.map(
  student => `

<tr>

<td>
${escapeHtml(
  student.display_name
)}
</td>

<td>
${escapeHtml(
  student.class_name
)}
</td>

<td>
${escapeHtml(
  student.student_number
)}
</td>

</tr>

`
).join("")}

</tbody>

</table>

</div>

`;

}


document.getElementById(
  "create"
).onclick = async () => {

  message.textContent =
    "登録しています。";


  const displayName =
    document.getElementById(
      "displayName"
    ).value.trim();


  const email =
    document.getElementById(
      "email"
    ).value.trim();


  const password =
    document.getElementById(
      "password"
    ).value;


  const className =
    document.getElementById(
      "className"
    ).value.trim();


  const studentNumber =
    document.getElementById(
      "studentNumber"
    ).value.trim();


  if (
    !displayName ||
    !email ||
    !password
  ) {

    message.textContent =
      "氏名、メールアドレス、パスワードを入力してください。";

    return;
  }


  if (
    password.length < 8
  ) {

    message.textContent =
      "パスワードは8文字以上にしてください。";

    return;
  }


  const {
    data,
    error
  } =
    await supabase.functions
      .invoke(
        "create-student",
        {
          body: {
            display_name:
              displayName,

            email,

            password,

            class_name:
              className,

            student_number:
              studentNumber
          }
        }
      );


  if (error) {

    console.error(
      "Student function error:",
      error
    );


    message.textContent =
      "Student登録に失敗しました。";


    return;
  }


  if (
    !data ||
    !data.success
  ) {

    message.textContent =
      data?.error ||
      "Student登録に失敗しました。";


    return;
  }


  message.textContent =
    "Studentを登録しました。";


  document.getElementById(
    "displayName"
  ).value = "";

  document.getElementById(
    "email"
  ).value = "";

  document.getElementById(
    "password"
  ).value = "";

  document.getElementById(
    "className"
  ).value = "";

  document.getElementById(
    "studentNumber"
  ).value = "";


  await loadStudents();

};


loadStudents();
