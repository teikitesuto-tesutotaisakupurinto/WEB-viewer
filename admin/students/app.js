import {
  requireAdmin,
  logout
}
from "../../assets/js/auth.js";

import {
  supabase,
  SUPABASE_KEY
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


  document.getElementById(
    "create"
  ).onclick =
    () => createStudent(
      message,
      formCard
    );


  await loadStudents();

}


async function loadStudents() {

  const container =
    document.getElementById(
      "students"
    );


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

    container.innerHTML =
      `
      <div class="list-row">
        Studentは登録されていません。
      </div>
      `;

    return;
  }


  container.innerHTML =
    data.map(
      student => `

      <div class="list-row">

        ${escapeHtml(
          student.display_name
        )}

      </div>

      `
    ).join("");

}


async function createStudent(
  message,
  formCard
) {

  const displayName =
    document.getElementById(
      "displayName"
    ).value.trim();


  const email =
    document.getElementById(
      "email"
    ).value.trim()
    .toLowerCase();


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


  if (
    password.length < 8
  ) {

    message.textContent =
      "パスワードは8文字以上にしてください。";

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
              SUPABASE_KEY,

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


    const text =
      await response.text();


    let result;


    try {

      result =
        JSON.parse(
          text
        );

    }
    catch {

      result = {
        error:
          text
      };

    }


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


    formCard.classList.add(
      "hidden"
    );


    await loadStudents();

  }
  catch (error) {

    console.error(
      "STUDENT CREATE ERROR:",
      error
    );


    message.textContent =
      "登録エラー: " +
      error.message;

  }

}


start()
  .catch(
    error => {

      console.error(
        "STUDENT PAGE ERROR:",
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
