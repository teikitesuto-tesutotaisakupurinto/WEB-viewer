
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

const REQUEST_TIMEOUT =
  10000;


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
   Utility
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


function withTimeout(
  promise,
  ms = REQUEST_TIMEOUT
) {

  return Promise.race([

    promise,

    new Promise(
      (_, reject) => {

        setTimeout(
          () => {

            reject(
              new Error(
                "通信がタイムアウトしました。ページを再読み込みしてください。"
              )
            );

          },
          ms
        );

      }
    )

  ]);

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
   Student list state
   ========================================================= */

function showStudentLoading(
  text = "生徒を読み込んでいます。"
) {

  if (!students) {
    return;
  }


  students.setAttribute(
    "aria-busy",
    "true"
  );


  students.innerHTML = `
    <div class="list-row">
      ${escapeHtml(text)}
    </div>
  `;

}


function showStudentError(
  error
) {

  if (!students) {
    return;
  }


  students.setAttribute(
    "aria-busy",
    "false"
  );


  students.innerHTML = `
    <div class="list-row">

      <strong>
        生徒一覧を読み込めませんでした。
      </strong>

      <br><br>

      <small>
        ${escapeHtml(
          error?.message ||
          "不明なエラーが発生しました。"
        )}
      </small>

      <br><br>

      <button
        id="retryStudents"
        type="button"
        class="secondary-button">

        再読み込み

      </button>

    </div>
  `;


  document
    .getElementById(
      "retryStudents"
    )
    ?.addEventListener(
      "click",
      () => {

        loadStudents();

      }
    );

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
    displayName.value = "";
  }


  if (email) {
    email.value = "";
  }


  if (password) {
    password.value = "";
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

    console.error(
      "students element is missing."
    );

    return;

  }


  showStudentLoading();


  try {

    console.log(
      "[ADMIN STUDENTS] loadStudents start"
    );


    /*
     * 現在のセッションを明示的に確認。
     */

    const {
      data:
        sessionData,
      error:
        sessionError
    } =
      await withTimeout(
        supabase.auth.getSession()
      );


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


    console.log(
      "[ADMIN STUDENTS] session exists"
    );


    /*
     * users取得。
     */

    const {
      data,
      error
    } =
      await withTimeout(

        supabase
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
          )

      );


    console.log(
      "[ADMIN STUDENTS] users result",
      {
        data,
        error
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


    students.setAttribute(
      "aria-busy",
      "false"
    );


    if (
      !Array.isArray(data) ||
      data.length === 0
    ) {

      students.innerHTML = `
        <div class="list-row">
          登録されている生徒はいません。
        </div>
      `;

      return;

    }


    /*
     * 一覧表示。
     */

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
  catch (error) {

    console.error(
      "[ADMIN STUDENTS] loadStudents error",
      error
    );


    showStudentError(
      error
    );

  }

}


/* =========================================================
   Input validation
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
      "パスワードは8文字以上で入力してください。"
    );

  }


  if (
    password.length >
    128
  ) {

    throw new Error(
      "パスワードは128文字以内で入力してください。"
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
      await withTimeout(
        supabase.auth.getSession()
      );


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
      await withTimeout(

        fetch(
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
        )

      );


    const text =
      await response.text();


    let result =
      {};


    try {

      result =
        text
          ? JSON.parse(
              text
            )
          : {};

    }
    catch {

      result = {
        error:
          text
      };

    }


    if (
      !response.ok
    ) {

      throw new Error(

        result.error ||
        result.message ||
        `生徒登録に失敗しました。HTTP ${response.status}`

      );

    }


    if (
      result.success !== true
    ) {

      throw new Error(

        result.error ||
        result.message ||
        "生徒登録に失敗しました。"

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
      "[ADMIN STUDENTS] createStudent error",
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
   Initialize DOM
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


  const missing =
    [];


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


  if (
    missing.length
  ) {

    throw new Error(
      `必要なHTML要素がありません: ${
        missing.join(", ")
      }`
    );

  }

}


/* =========================================================
   Initialize events
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

  console.log(
    "[ADMIN STUDENTS] start"
  );


  initializeDom();

  initializeEvents();


  /*
   * 管理者確認。
   */

  showStudentLoading(
    "管理者権限を確認しています。"
  );


  let admin;


  try {

    admin =
      await withTimeout(
        requireAdmin()
      );

  }
  catch (error) {

    console.error(
      "[ADMIN STUDENTS] requireAdmin error",
      error
    );


    showStudentError(
      error
    );


    return;

  }


  console.log(
    "[ADMIN STUDENTS] requireAdmin result",
    admin
  );


  if (!admin) {

    showStudentError(
      new Error(
        "管理者としてログインしてください。"
      )
    );


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
              "[ADMIN STUDENTS] fatal",
              error
            );


            showStudentError(
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
          "[ADMIN STUDENTS] fatal",
          error
        );


        showStudentError(
          error
        );

      }
    );

}
