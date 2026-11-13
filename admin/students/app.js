
import {
  requireAdmin,
  logout
} from "../../assets/js/auth.js";

import {
  supabase,
  SUPABASE_KEY
} from "../../assets/js/supabase.js";


const CREATE_STUDENT_URL =
  "https://wcddlfjtkrbpperhrxkk.supabase.co/functions/v1/bright-worker";


let formCard;
let message;
let students;
let showFormButton;
let cancelButton;
let createButton;
let logoutButton;


/* =========================================================
   Escape
   ========================================================= */

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* =========================================================
   Message
   ========================================================= */

function setMessage(text, type = "") {

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
   Form
   ========================================================= */

function clearForm() {

  document.getElementById(
    "displayName"
  ).value = "";

  document.getElementById(
    "email"
  ).value = "";

  document.getElementById(
    "password"
  ).value = "";

}


function showStudentForm() {

  formCard.classList.remove(
    "hidden"
  );

  setMessage("");

  document.getElementById(
    "displayName"
  )?.focus();

}


function hideStudentForm() {

  formCard.classList.add(
    "hidden"
  );

  clearForm();

  setMessage("");

}


/* =========================================================
   Students
   ========================================================= */

async function loadStudents() {

  students.innerHTML = `
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
          ascending: true
        }
      );


  if (error) {

    console.error(
      "STUDENT LOAD ERROR:",
      error
    );

    students.innerHTML = `
      <div class="list-row">
        生徒一覧を取得できませんでした。
        <br>
        <small>
          ${escapeHtml(
            error.message
          )}
        </small>
      </div>
    `;

    return;

  }


  if (
    !data ||
    data.length === 0
  ) {

    students.innerHTML = `
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

            ${escapeHtml(
              student.display_name ||
              "名前未設定"
            )}

          </div>
        `
      )
      .join("");

}


/* =========================================================
   Validation
   ========================================================= */

function getStudentInput() {

  const displayName =
    document.getElementById(
      "displayName"
    )
      ?.value
      .trim() || "";


  const email =
    document.getElementById(
      "email"
    )
      ?.value
      .trim()
      .toLowerCase() || "";


  const password =
    document.getElementById(
      "password"
    )
      ?.value || "";


  if (!displayName) {

    throw new Error(
      "氏名を入力してください。"
    );

  }


  if (
    displayName.length > 100
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
    password.length < 8
  ) {

    throw new Error(
      "パスワードは8文字以上にしてください。"
    );

  }


  if (
    password.length > 128
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
   Create
   ========================================================= */

async function createStudent() {

  if (
    createButton.disabled
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
      data,
      error
    } =
      await supabase.auth
        .getSession();


    if (error) {
      throw error;
    }


    const session =
      data?.session;


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


    const text =
      await response.text();


    let result = {};


    try {

      result =
        text
          ? JSON.parse(text)
          : {};

    }
    catch {

      result = {
        error:
          text
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

    formCard.classList.add(
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
      "CREATE STUDENT ERROR:",
      error
    );


    setMessage(
      `登録エラー: ${
        error.message ||
        "生徒登録に失敗しました。"
      }`,
      "error"
    );

  }
  finally {

    createButton.disabled =
      false;

    createButton.textContent =
      "登録";

  }

}


/* =========================================================
   Start
   ========================================================= */

async function start() {

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


  if (
    !formCard ||
    !message ||
    !students ||
    !showFormButton ||
    !cancelButton ||
    !createButton ||
    !logoutButton
  ) {

    throw new Error(
      "生徒管理画面のHTMLが正しく構成されていません。"
    );

  }


  /*
   * イベントを先に設定。
   */

  showFormButton.addEventListener(
    "click",
    showStudentForm
  );


  cancelButton.addEventListener(
    "click",
    hideStudentForm
  );


  createButton.addEventListener(
    "click",
    createStudent
  );


  logoutButton.addEventListener(
    "click",
    () =>
      logout()
  );


  /*
   * Enter登録。
   */

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


  /*
   * 管理者確認。
   */

  const admin =
    await requireAdmin();


  if (!admin) {
    return;
  }


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
              "ADMIN STUDENTS ERROR:",
              error
            );

            if (students) {

              students.innerHTML = `
                <div class="list-row">
                  生徒管理を読み込めませんでした。
                  <br>
                  <small>
                    ${escapeHtml(
                      error.message ||
                      "エラーが発生しました。"
                    )}
                  </small>
                </div>
              `;

            }

          }
        );

    }
  );

}
else {

  start()
    .catch(
      error => {

        console.error(
          "ADMIN STUDENTS ERROR:",
          error
        );

      }
    );

}
