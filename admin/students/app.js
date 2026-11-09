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


const FUNCTION_URL =
  "https://wcddlfjtkrbpperhrxkk.supabase.co/functions/v1/bright-worker";


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

  message.textContent =
    "";

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
        "display_name",
        {
          ascending: true
        }
      );


  if (error) {

    console.error(
      "STUDENT LIST ERROR:",
      error
    );


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

  message.style.color =
    "#222";

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

    message.style.color =
      "#b00020";

    message.textContent =
      "氏名、メールアドレス、パスワードを入力してください。";

    return;
  }


  if (
    password.length < 8
  ) {

    message.style.color =
      "#b00020";

    message.textContent =
      "パスワードは8文字以上にしてください。";

    return;
  }


  try {

    /*
     * 現在のログインセッション
     */

    const {
      data: sessionData,
      error: sessionError
    } =
      await supabase.auth
        .getSession();


    if (
      sessionError
    ) {

      throw new Error(
        "ログインセッションを取得できませんでした。"
      );

    }


    if (
      !sessionData.session
    ) {

      throw new Error(
        "ログインセッションがありません。"
      );

    }


    const accessToken =
      sessionData.session
        .access_token;


    /*
     * Edge Functionへ直接送信
     */

    const response =
      await fetch(
        FUNCTION_URL,
        {
          method:
            "POST",

          headers: {

            "Authorization":
              `Bearer ${accessToken}`,

            "apikey":
              "sb_publishable_GZA4t1Q-c51iM-9HndtZhA_xvnB-Icu",

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify({

              display_name:
                displayName,

              email:
                email,

              password:
                password,

              class_name:
                className,

              student_number:
                studentNumber

            })

        }
      );


    /*
     * Functionのレスポンス
     */

    const responseText =
      await response.text();


    let result;


    try {

      result =
        responseText
          ? JSON.parse(
              responseText
            )
          : {};

    }
    catch {

      result = {
        error:
          responseText
      };

    }


    console.log(
      "Function status:",
      response.status
    );


    console.log(
      "Function result:",
      result
    );


    if (
      !response.ok
    ) {

      throw new Error(
        result?.error ||
        `Edge Function error: ${response.status}`
      );

    }


    if (
      !result.success
    ) {

      throw new Error(
        result?.error ||
        "Student登録に失敗しました。"
      );

    }


    message.style.color =
      "#222";


    message.textContent =
      "Studentを登録しました。";


    document.getElementById(
      "displayName"
    ).value =
      "";

    document.getElementById(
      "email"
    ).value =
      "";

    document.getElementById(
      "password"
    ).value =
      "";

    document.getElementById(
      "className"
    ).value =
      "";

    document.getElementById(
      "studentNumber"
    ).value =
      "";


    await loadStudents();

  }
  catch (error) {

    console.error(
      "CREATE STUDENT ERROR:",
      error
    );


    message.style.color =
      "#b00020";


    message.textContent =
      "登録エラー: " +
      (
        error?.message ||
        "Student登録に失敗しました。"
      );

  }

};


loadStudents();
