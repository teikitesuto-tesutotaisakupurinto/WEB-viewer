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

const showFormButton =
  document.getElementById(
    "showForm"
  );

const cancelButton =
  document.getElementById(
    "cancel"
  );

const createButton =
  document.getElementById(
    "create"
  );

const logoutButton =
  document.getElementById(
    "logout"
  );

const message =
  document.getElementById(
    "message"
  );

const studentsContainer =
  document.getElementById(
    "students"
  );


/*
 * ========================================
 * 最初にボタンを動かす
 * ========================================
 */


/*
 * 生徒追加を開く
 */

showFormButton.onclick = () => {

  formCard.classList.remove(
    "hidden"
  );

  message.textContent =
    "";

};


/*
 * 生徒追加を閉じる
 */

cancelButton.onclick = () => {

  formCard.classList.add(
    "hidden"
  );

  message.textContent =
    "";

};


/*
 * ログアウト
 */

logoutButton.onclick = async () => {

  await logout();

};


/*
 * 生徒登録
 */

createButton.onclick = async () => {

  await createStudent();

};


/*
 * ========================================
 * 生徒一覧
 * ========================================
 */

async function loadStudents() {

  studentsContainer.innerHTML =
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
        "id,display_name,role"
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

    throw new Error(
      "生徒取得エラー: " +
      error.message
    );

  }


  if (
    !data ||
    data.length === 0
  ) {

    studentsContainer.innerHTML =
      `
      <div class="list-row">
        登録されている生徒はいません。
      </div>
      `;

    return;

  }


  studentsContainer.innerHTML =
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


/*
 * ========================================
 * 生徒登録
 * ========================================
 */

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


  createButton.disabled =
    true;


  message.textContent =
    "登録しています。";


  try {

    /*
     * 現在のAdminセッション
     */

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


    /*
     * Edge Function
     */

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


    const responseText =
      await response.text();


    let result;


    try {

      result =
        JSON.parse(
          responseText
        );

    }
    catch {

      result = {
        error:
          responseText
      };

    }


    if (
      !response.ok
    ) {

      throw new Error(
        result.error ||
        `Edge Function Error: ${response.status}`
      );

    }


    if (
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
      (
        error.message ||
        "生徒登録に失敗しました。"
      );

  }
  finally {

    createButton.disabled =
      false;

  }

}


/*
 * ========================================
 * 起動
 * ========================================
 */

(async () => {

  try {

    const admin =
      await requireAdmin();


    if (!admin) {
      return;
    }


    await loadStudents();

  }
  catch (error) {

    console.error(
      "STUDENT PAGE ERROR:",
      error
    );


    studentsContainer.innerHTML =
      `
      <div class="page-error">

        <h2>
          生徒一覧を読み込めませんでした
        </h2>

        <p>
          ${escapeHtml(
            error.message ||
            "予期しないエラーが発生しました。"
          )}
        </p>

        <button
          class="primary-button"
          onclick="location.reload()">
          再読み込み
        </button>

      </div>
      `;

  }

})();
