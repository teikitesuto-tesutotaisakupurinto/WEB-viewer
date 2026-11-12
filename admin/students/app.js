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
  escapeHtml
}
from "../../assets/js/common.js";


const formCard =
  document.getElementById(
    "formCard"
  );

const message =
  document.getElementById(
    "message"
  );

const students =
  document.getElementById(
    "students"
  );


document.getElementById(
  "showForm"
).onclick =
  () => {

    formCard.classList.remove(
      "hidden"
    );

  };


document.getElementById(
  "cancel"
).onclick =
  () => {

    formCard.classList.add(
      "hidden"
    );

    message.textContent = "";

  };


document.getElementById(
  "logout"
).onclick =
  () => logout();


document.getElementById(
  "create"
).onclick =
  createStudent;


async function loadStudents() {

  students.innerHTML =
    `
    <div class="list-row">
      生徒を読み込んでいます。
    </div>
    `;


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


  if (!data?.length) {

    students.innerHTML =
      `
      <div class="list-row">
        登録されている生徒はいません。
      </div>
      `;

    return;
  }


  students.innerHTML =
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


async function createStudent() {

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


  if (!displayName) {

    message.textContent =
      "氏名を入力してください。";

    return;
  }


  if (!email) {

    message.textContent =
      "メールアドレスを入力してください。";

    return;
  }


  if (
    password.length < 8
  ) {

    message.textContent =
      "パスワードは8文字以上にしてください。";

    return;
  }


  try {

    const {
      data:
        sessionData,
      error:
        sessionError
    } =
    await supabase.auth
      .getSession();


    if (
      sessionError ||
      !sessionData?.session
    ) {

      throw new Error(
        "管理者のログインセッションがありません。"
      );

    }


    message.textContent =
      "登録しています。";


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
        JSON.parse(text);
    }
    catch {
      result = {
        error: text
      };
    }


    if (
      !response.ok ||
      !result.success
    ) {

      throw new Error(
        result.error ||
        "生徒登録に失敗しました。"
      );

    }


    message.textContent =
      "生徒を登録しました。";


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

    message.textContent =
      "登録エラー: " +
      error.message;

  }

}


async function start() {

  const admin =
    await requireAdmin();

  if (!admin) {
    return;
  }


  await loadStudents();

}


start()
.catch(
  error => {

    students.innerHTML =
      `
      <div class="page-error">

        <h2>
          生徒一覧を読み込めませんでした
        </h2>

        <p>
          データの取得に失敗しました。
        </p>

        <button
          class="primary-button"
          onclick="location.reload()">

          再読み込み

        </button>

      </div>
      `;

  }
);
