
import {
  requireAdmin,
  logout
} from "../../assets/js/auth.js";

import {
  supabase,
  SUPABASE_KEY
} from "../../assets/js/supabase.js";


/* =========================================================
   Config
   ========================================================= */

const CREATE_STUDENT_URL =
  "https://wcddlfjtkrbpperhrxkk.supabase.co/functions/v1/bright-worker";


/* =========================================================
   DOM
   ========================================================= */

let formCard = null;

let message = null;

let students = null;

let showFormButton = null;

let cancelButton = null;

let createButton = null;

let logoutButton = null;


/* =========================================================
   Escape
   ========================================================= */

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


/* =========================================================
   Message
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


/* =========================================================
   Student list message
   ========================================================= */

function setStudentListMessage(
  html
) {

  if (!students) {
    return;
  }


  students.innerHTML =
    html;

}


/* =========================================================
   Form
   ========================================================= */

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


function showStudentForm() {

  if (!formCard) {
    return;
  }


  formCard.classList.remove(
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


function hideStudentForm() {

  if (!formCard) {
    return;
  }


  formCard.classList.add(
    "hidden"
  );


  clearForm();


  setMessage(
    ""
  );

}


/* =========================================================
   Load students
   ========================================================= */

async function loadStudents() {

  if (!students) {

    throw new Error(
      "students要素が見つかりません。"
    );

  }


  setStudentListMessage(`
    <div class="list-row">
      生徒を読み込んでいます。
    </div>
  `);


  try {

    console.log(
      "[ADMIN STUDENTS] users SELECT start"
    );


    const {
      data,
      error,
      count
    } =
      await supabase
        .from("users")
        .select(
          "id,display_name",
          {
            count:
              "exact"
          }
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


    console.log(
      "[ADMIN STUDENTS] users SELECT result:",
      {
        data,
        error,
        count
      }
    );


    if (error) {

      throw new Error(
        `生徒一覧取得エラー: ${
          error.message ||
          error.code ||
          "Unknown error"
        }`
      );

    }


    if (
      !Array.isArray(data) ||
      data.length === 0
    ) {

      setStudentListMessage(`
        <div class="list-row">
          登録されている生徒はいません。
        </div>
      `);

      return;

    }


    setStudentListMessage(

      data
        .map(
          student => `

            <div
              class="list-row"
              data-student-id="${escapeHtml(
                student.id
              )}">

              ${escapeHtml(
                student.display_name ||
                "名前未設定"
              )}

            </div>

          `
        )
        .join("")

    );

  }
  catch (error) {

    console.error(
      "[ADMIN STUDENTS] LOAD ERROR:",
      error
    );


    setStudentListMessage(`
      <div class="list-row">

        <strong>
          生徒一覧を読み込めませんでした。
        </strong>

        <br>

        <small>
          ${escapeHtml(
            error?.message ||
            "データ取得に失敗しました。"
          )}
        </small>

        <br><br>

        <button
          type="button"
          id="retryStudents"
          class="secondary-button">

          再読み込み

        </button>

      </div>
    `);


    document
      .getElementById(
        "retryStudents"
      )
      ?.addEventListener(
        "click",
        () => {

          loadStudents()
            .catch(
              retryError => {

                console.error(
                  retryError
                );

              }
            );

        }
      );

  }

}


/* =========================================================
   Input
   ========================================================= */

function getStudentInput() {

  const displayName =
    document
      .getElementById(
        "displayName"
      )
      ?.value
      .trim() ||
    "";


  const email =
    document
      .getElementById(
        "email"
      )
      ?.value
      .trim()
      .toLowerCase() ||
    "";


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


  if (
    password.length >
    128
  ) {

    throw new Error(
      "パスワードは128文字以内にしてください。"
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
      getStudentInput();

  }
  catch (error) {

    setMessage(
      error.message,
      "error"
    );

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


    if (sessionError) {

      throw new Error(
        `セッション取得エラー: ${
          sessionError.message
        }`
      );

    }


    const session =
      sessionData?.session;


    if (!session) {

      throw new Error(
        "管理者のログインセッションがありません。"
      );

    }


    createButton.disabled =
      true;


    createButton.textContent =
      "登録中...";


    setMessage(
      "生徒を登録しています。"
    );


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


    let result = {};


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


    if (
      !response.ok ||
      result.success !== true
    ) {

      throw new Error(

        result.error ||
        result.message ||
        `生徒登録に失敗しました。HTTP ${response.status}`

      );

    }


    clearForm();


    formCard?.classList.add(
      "hidden"
    );


    setMessage(
      "生徒を登録しました。",
      "success"
    );


    await loadStudents();

  }
  catch (error) {

    console.error(
      "[ADMIN STUDENTS] CREATE ERROR:",
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
   DOM initialization
   ========================================================= */

function initializeDom() {

  formCard =
    document.getElementById(
      "formCard"
    );

  message =
    document.getElementById(
      "message"
    );

  students =
    document.getElementById(
      "students"
    );

  showFormButton =
    document.getElementById(
      "showForm"
    );

  cancelButton =
    document.getElementById(
      "cancel"
    );

  createButton =
    document.getElementById(
      "create"
    );

  logoutButton =
    document.getElementById(
      "logout"
    );


  const missing = [];


  if (!formCard) {
    missing.push(
      "formCard"
    );
  }


  if (!message) {
    missing.push(
      "message"
    );
  }


  if (!students) {
    missing.push(
      "students"
    );
  }


  if (!showFormButton) {
    missing.push(
      "showForm"
    );
  }


  if (!cancelButton) {
    missing.push(
      "cancel"
    );
  }


  if (!createButton) {
    missing.push(
      "create"
    );
  }


  if (!logoutButton) {
    missing.push(
      "logout"
    );
  }


  if (missing.length) {

    throw new Error(
      `HTML要素がありません: ${
        missing.join(", ")
      }`
    );

  }

}


/* =========================================================
   Events
   ========================================================= */

function initializeEvents() {

  showFormButton.addEventListener(
    "click",
    event => {

      event.preventDefault();

      showStudentForm();

    }
  );


  cancelButton.addEventListener(
    "click",
    event => {

      event.preventDefault();

      hideStudentForm();

    }
  );


  createButton.addEventListener(
    "click",
    event => {

      event.preventDefault();

      createStudent();

    }
  );


  logoutButton.addEventListener(
    "click",
    event => {

      event.preventDefault();

      logout();

    }
  );


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

}


/* =========================================================
   Start
   ========================================================= */

async function start() {

  initializeDom();

  initializeEvents();


  /*
   * 最初に一覧を読み込み状態にする。
   */

  setStudentListMessage(`
    <div class="list-row">
      管理者権限を確認しています。
    </div>
  `);


  /*
   * 管理者確認。
   */

  let admin;


  try {

    admin =
      await requireAdmin();

  }
  catch (error) {

    console.error(
      "[ADMIN STUDENTS] ADMIN AUTH ERROR:",
      error
    );


    setStudentListMessage(`
      <div class="list-row">

        管理者認証に失敗しました。

        <br>

        <small>
          ${escapeHtml(
            error?.message ||
            "認証エラー"
          )}
        </small>

      </div>
    `);

    return;

  }


  if (!admin) {

    setStudentListMessage(`
      <div class="list-row">
        管理者としてログインしてください。
      </div>
    `);

    return;

  }


  /*
   * 一覧取得。
   */

  await loadStudents();

}


/* =========================================================
   Boot
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      start()
        .catch(
          error => {

            console.error(
              "[ADMIN STUDENTS] FATAL ERROR:",
              error
            );

          }
        );

    },
    {
      once: true
    }
  );

}
else {

  start()
    .catch(
      error => {

        console.error(
          "[ADMIN STUDENTS] FATAL ERROR:",
          error
        );

      }
    );

}
