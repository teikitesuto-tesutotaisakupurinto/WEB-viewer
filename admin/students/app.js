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

    console.error(error);

    return;
  }


  document.getElementById(
    "students"
  ).innerHTML =
    (data || []).map(
      student => `

<div class="list-row">

<div>
${escapeHtml(
  student.display_name
)}
</div>

</div>

`
    ).join("") ||
    "<p>Studentは登録されていません。</p>";
}


document.getElementById(
  "create"
).onclick = async () => {

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


  if (
    !displayName ||
    !email ||
    !password
  ) {

    message.textContent =
      "氏名、メールアドレス、パスワードを入力してください。";

    return;
  }


  message.textContent =
    "登録しています。";


  try {

    const {
      data: sessionData,
      error: sessionError
    } =
      await supabase.auth
        .getSession();


    if (
      sessionError ||
      !sessionData.session
    ) {
      throw new Error(
        "ログインセッションがありません。"
      );
    }


    const response =
      await fetch(
        "https://wcddlfjtkrbpperhrxkk.supabase.co/functions/v1/bright-worker",
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${sessionData.session.access_token}`,

            apikey:
              "sb_publishable_GZA4t1Q-c51iM-9HndtZhA_xvnB-Icu",

            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              display_name:
                displayName,

              email,

              password
            })
        }
      );


    const result =
      await response.json();


    if (
      !response.ok ||
      !result.success
    ) {

      throw new Error(
        result.error ||
        "Student登録に失敗しました。"
      );
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


    formCard.classList.add(
      "hidden"
    );


    await loadStudents();

  }
  catch (error) {

    console.error(
      error
    );

    message.textContent =
      "登録エラー: " +
      error.message;

  }

};


loadStudents();
