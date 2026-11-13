
import {
  requireAdmin,
  logout
} from "../../assets/js/auth.js";

import {
  supabase,
  SUPABASE_KEY
} from "../../assets/js/supabase.js";

import {
  escapeHtml
} from "../../assets/js/common.js";


/* =========================================================
   DOM
   ========================================================= */

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


/* =========================================================
   Config
   ========================================================= */

const CREATE_STUDENT_URL =
  "https://wcddlfjtkrbpperhrxkk.supabase.co/functions/v1/bright-worker";


/* =========================================================
   Utility
   ========================================================= */

function setMessage(
  text,
  type = ""
) {

  if (!message) {
    return;
  }


  message.textContent =
    text;


  message.className =
    type
      ? `message ${type}`
      : "message";

}


function clearForm() {

  const displayName =
    document.getElementById(
      "displayName"
    );

  const email =
    document.getElementById(
      "email"
    );

  const password =
    document.getElementById(
      "password"
    );


  if (displayName) {
    displayName.value =
      "";
  }


  if (email) {
    email.value =
      "";
  }


  if (password) {
    password.value =
      "";
  }

}


/* =========================================================
   Form
   ========================================================= */

showFormButton?.addEventListener(
  "click",
  () => {

    formCard?.classList.remove(
      "hidden"
    );


    setMessage(
      ""
    );


    document
      .getElementById(
        "displayName"
      )
      ?.focus();

  }
);


cancelButton?.addEventListener(
  "click",
  () => {

    formCard?.classList.add(
      "hidden"
    );


    clearForm();


    setMessage(
      ""
    );

  }
);


logoutButton?.addEventListener(
  "click",
  () =>
    logout()
);


createButton?.addEventListener(
  "click",
  createStudent
);


/* =========================================================
   Enter key
   ========================================================= */

[
  "displayName",
  "email",
  "password"
]
.forEach(
  id => {

    document
      .getElementById(id)
      ?.addEventListener(
        "keydown",
        event => {

          if (
            event.key ===
            "Enter"
          ) {

            event.preventDefault();

            createStudent();

          }

        }
      );

  }
);


/* =========================================================
   Load students
   ========================================================= */

async function loadStudents() {

  if (!students) {
    return;
  }


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
        "display_name",
        {
          ascending:
            true
        }
      );


  if (error) {

    console.error(
      "STUDENT LIST ERROR:",
      error
    );

    throw error;

  }


  if (
    !data ||
    data.length === 0
  ) {

    students.innerHTML =
      `
        <div class="list-row">
          登録されている生徒はいません。
        </div>
      `;

    return;

  }


  students.innerHTML =
    data
      .map(
        student => `

          <div
            class="list-row"
            data-student-id="${escapeHtml(
              student.id
            )}">

            <div class="student-name">

              ${escapeHtml(
                student.display_name ||
                "名前未設定"
              )}

            </div>

          </div>

        `
      )
      .join("");

}


/* =========================================================
   Validate
   ========================================================= */

function validateStudentInput() {

  const displayName =
    document
      .getElementById(
        "displayName"
      )
      ?.value
      .trim();


  const email =
    document
      .getElementById(
        "email"
      )
      ?.value
      .trim()
      .toLowerCase();


  const password =
    document
      .getElementById(
        "password"
      )
      ?.value ||
      "";


  if (!displayName) {

    throw new Error(
      "氏名を入力してください。"
    );

  }


  if (
    displayName.length >
    100
  ) {

    throw new Error(
      "氏名は100文字以内で入力してください。"
    );

  }


  if (!email) {

    throw new Error(
      "メールアドレスを入力してください。"
    );

  }


  /*
   * 完全なRFC検証ではなく、
   * 通常の入力ミスを防ぐための確認。
   */

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email)
  ) {

    throw new Error(
      "メールアドレスの形式が正しくありません。"
    );

  }


  if (
    password.length <
    8
  ) {

    throw new Error(
      "パスワードは8文字以上にしてください。"
    );

  }


  return {

    displayName,
    email,
    password

  };

}


/* =========================================================
   Create student
   ========================================================= */

async function createStudent() {

  if (
    createButton?.disabled
  ) {

    return;

  }


  let input;


  try {

    input =
      validateStudentInput();

  }
  catch (error) {

    setMessage(
      error.message,
      "error"
    );

    return;

  }


  try {

    /*
     * 管理者セッションを確認。
     */

    const {
      data:
        sessionData,
      error:
        sessionError
    } =
      await supabase.auth
        .getSession();


    if (sessionError) {

      console.error(
        "SESSION ERROR:",
        sessionError
      );

      throw new Error(
        "管理者セッションを確認できませんでした。"
      );

    }


    const session =
      sessionData?.session;


    if (!session) {

      throw new Error(
        "管理者のログインセッションがありません。"
      );

    }


    /*
     * 登録中は二重送信を防止。
     */

    if (createButton) {

      createButton.disabled =
        true;

      createButton.textContent =
        "登録中...";

    }


    setMessage(
      "生徒を登録しています。"
    );


    /*
     * Edge Functionへ送信。
     *
     * Supabase Authの管理者APIを
     * ブラウザから直接実行しない。
     */

    const response =
      await fetch(
        CREATE_STUDENT_URL,
        {

          method:
            "POST",

          headers: {

            Authorization:
              `Bearer ${
                session.access_token
              }`,

            apikey:
              SUPABASE_KEY,

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify({

              display_name:
                input.displayName,

              email:
                input.email,

              password:
                input.password

            })

        }
      );


    const responseText =
      await response.text();


    let result =
      null;


    if (
      responseText
    ) {

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

    }


    if (
      !response.ok
    ) {

      throw new Error(

        result?.error ||

        result?.message ||

        `生徒登録に失敗しました。(${response.status})`

      );

    }


    if (
      result?.success !== true
    ) {

      throw new Error(

        result?.error ||

        result?.message ||

        "生徒登録に失敗しました。"

      );

    }


    /*
     * 成功。
     */

    setMessage(
      "生徒を登録しました。",
      "success"
    );


    clearForm();


    formCard?.classList.add(
      "hidden"
    );


    await loadStudents();

  }
  catch (error) {

    console.error(
      "CREATE STUDENT ERROR:",
      error
    );


    setMessage(
      `登録エラー: ${
        error?.message ||
        "生徒登録に失敗しました。"
      }`,
      "error"
    );

  }
  finally {

    if (createButton) {

      createButton.disabled =
        false;

      createButton.textContent =
        "登録";

    }

  }

}


/* =========================================================
   Start
   ========================================================= */

async function start() {

  /*
   * 管理者権限確認。
   */

  const admin =
    await requireAdmin();


  if (!admin) {

    return;

  }


  /*
   * 生徒一覧。
   */

  await loadStudents();

}


/* =========================================================
   Boot
   ========================================================= */

start()
  .catch(
    error => {

      console.error(
        "ADMIN STUDENTS ERROR:",
        error
      );


      if (!students) {
        return;
      }


      students.innerHTML =
        `
          <div class="page-error">

            <h2>
              生徒一覧を読み込めませんでした
            </h2>

            <p>
              ${
                escapeHtml(
                  error?.message ||
                  "データの取得に失敗しました。"
                )
              }
            </p>

            <button
              class="primary-button"
              type="button"
              onclick="location.reload()">

              再読み込み

            </button>

          </div>
        `;

    }
  );
