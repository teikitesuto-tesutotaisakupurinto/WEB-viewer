
import {
  requireAdmin,
  logout
} from "../../assets/js/auth.js";

import {
  supabase
} from "../../assets/js/supabase.js";


/* =========================================================
   Config
   ========================================================= */

const CREATE_STUDENT_URL =
  "https://wcddlfjtkrbpperhrxkk.supabase.co/functions/v1/bright-worker";

const REQUEST_TIMEOUT =
  10000;


/* =========================================================
   State
   ========================================================= */

let allStudents = [];

let filteredStudents = [];

let selectedStudent = null;


/* =========================================================
   DOM
   ========================================================= */

let formCard;
let message;
let students;

let showFormButton;
let cancelButton;
let createButton;
let logoutButton;

let studentSearch;
let clearSearch;
let studentCount;
let exportCsv;


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

  let timer;


  const timeout =
    new Promise(
      (_, reject) => {

        timer =
          setTimeout(
            () => {

              reject(
                new Error(
                  "通信がタイムアウトしました。"
                )
              );

            },
            ms
          );

      }
    );


  return Promise.race([
    promise,
    timeout
  ])
    .finally(
      () => {

        clearTimeout(
          timer
        );

      }
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
   Form
   ========================================================= */

function clearForm() {

  [
    "displayName",
    "studentNumber",
    "email",
    "grade",
    "className",
    "password"
  ]
    .forEach(
      id => {

        const element =
          document.getElementById(
            id
          );


        if (element) {

          element.value =
            "";

        }

      }
    );

}


function showStudentForm() {

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

  formCard.classList.add(
    "hidden"
  );


  clearForm();


  setMessage(
    ""
  );

}


/* =========================================================
   Load
   ========================================================= */

async function loadStudents() {

  students.innerHTML = `
    <div class="list-row">
      生徒を読み込んでいます。
    </div>
  `;


  students.setAttribute(
    "aria-busy",
    "true"
  );


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
        sessionError.message
      );

    }


    if (
      !sessionData?.session
    ) {

      throw new Error(
        "管理者のログインセッションがありません。"
      );

    }


    const {
      data,
      error
    } =
      await withTimeout(

        supabase
          .from("users")
          .select(`
            id,
            display_name,
            role,
            email,
            grade,
            class_name,
            student_number,
            status,
            last_login_at,
            suspended_at,
            suspended_by,
            created_at,
            updated_at
          `)
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


    if (error) {

      throw new Error(
        `生徒一覧取得エラー: ${
          error.message
        }`
      );

    }


    allStudents =
      Array.isArray(data)
        ? data
        : [];


    students.setAttribute(
      "aria-busy",
      "false"
    );


    applySearch();

  }
  catch (error) {

    console.error(
      "LOAD STUDENTS ERROR:",
      error
    );


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
            error.message ||
            "不明なエラー"
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
        loadStudents
      );

  }

}


/* =========================================================
   Search
   ========================================================= */

function applySearch() {

  const keyword =
    (
      studentSearch?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  if (!keyword) {

    filteredStudents =
      [...allStudents];

  }
  else {

    filteredStudents =
      allStudents.filter(
        student => {

          const values = [

            student.display_name,

            student.student_number,

            student.email,

            student.grade,

            student.class_name,

            student.id

          ];


          return values.some(
            value =>
              String(
                value ?? ""
              )
                .toLowerCase()
                .includes(
                  keyword
                )
          );

        }
      );

  }


  renderStudents();

}


function renderStudents() {

  studentCount.textContent =
    `${filteredStudents.length}人 / ${allStudents.length}人`;


  if (
    filteredStudents.length ===
    0
  ) {

    students.setAttribute(
      "aria-busy",
      "false"
    );


    students.innerHTML = `
      <div class="list-row">
        該当する生徒はいません。
      </div>
    `;


    return;

  }


  students.innerHTML =
    filteredStudents
      .map(
        student => {

          const active =
            student.status !==
            "suspended";


          return `

            <div
              class="list-row student-row"
              data-student-id="${escapeHtml(
                student.id
              )}">

              <div class="student-row-main">

                <div class="student-row-name">

                  ${escapeHtml(
                    student.display_name ||
                    "名前未設定"
                  )}

                </div>


                <div class="student-row-meta">

                  ${
                    student.student_number
                      ? escapeHtml(
                          student.student_number
                        )
                      : "生徒番号未設定"
                  }

                  ${

                    student.grade
                      ? ` / ${escapeHtml(
                          student.grade
                        )}`
                      : ""

                  }

                  ${

                    student.class_name
                      ? ` / ${escapeHtml(
                          student.class_name
                        )}`
                      : ""

                  }

                </div>

              </div>


              <div class="student-row-status">

                <span
                  class="student-status ${
                    active
                      ? "active"
                      : "suspended"
                  }">

                  ${
                    active
                      ? "有効"
                      : "停止"
                  }

                </span>

              </div>


              <button
                type="button"
                class="secondary-button"
                data-detail-id="${escapeHtml(
                  student.id
                )}">

                詳細

              </button>

            </div>

          `;

        }
      )
      .join("");


  students
    .querySelectorAll(
      "[data-detail-id]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const id =
              button.dataset.detailId;


            const student =
              allStudents.find(
                item =>
                  String(
                    item.id
                  ) ===
                  String(id)
              );


            if (student) {

              openDetail(
                student
              );

            }

          }
        );

      }
    );

}


/* =========================================================
   Detail
   ========================================================= */

function openDetail(
  student
) {

  selectedStudent =
    student;


  document
    .getElementById(
      "studentDetailDialog"
    )
    ?.remove();


  const active =
    student.status !==
    "suspended";


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "studentDetailDialog";


  overlay.className =
    "student-detail-overlay";


  overlay.innerHTML = `

    <div
      class="student-detail-dialog"
      role="dialog"
      aria-modal="true">

      <div class="student-detail-header">

        <div>

          <div class="student-detail-label">
            生徒詳細
          </div>

          <h2>
            ${escapeHtml(
              student.display_name ||
              "名前未設定"
            )}
          </h2>

        </div>


        <button
          type="button"
          id="studentDetailClose"
          class="student-detail-close">

          ×

        </button>

      </div>


      <div class="student-detail-body">


        ${detailItem(
          "氏名",
          student.display_name
        )}


        ${detailItem(
          "生徒番号",
          student.student_number
        )}


        ${detailItem(
          "メールアドレス",
          student.email
        )}


        ${detailItem(
          "学年",
          student.grade
        )}


        ${detailItem(
          "クラス",
          student.class_name
        )}


        ${detailItem(
          "状態",
          active
            ? "有効"
            : "停止"
        )}


        ${detailItem(
          "最終ログイン",
          formatDate(
            student.last_login_at
          )
        )}


        ${detailItem(
          "登録日時",
          formatDate(
            student.created_at
          )
        )}


        ${detailItem(
          "更新日時",
          formatDate(
            student.updated_at
          )
        )}


        <div
          id="studentDetailMessage"
          class="student-detail-message"
          hidden>
        </div>


      </div>


      <div class="student-detail-footer">

        <button
          type="button"
          id="studentEdit"
          class="secondary-button">

          編集

        </button>


        <button
          type="button"
          id="studentPassword"
          class="secondary-button">

          パスワード再設定

        </button>


        ${
          active

            ? `

              <button
                type="button"
                id="studentSuspend"
                class="danger-button">

                アカウント停止

              </button>

            `

            : `

              <button
                type="button"
                id="studentUnsuspend"
                class="primary-button">

                停止解除

              </button>

            `
        }


        <button
          type="button"
          id="studentDetailCloseButton"
          class="secondary-button">

          閉じる

        </button>

      </div>

    </div>

  `;


  document.body.appendChild(
    overlay
  );


  document
    .getElementById(
      "studentDetailClose"
    )
    ?.addEventListener(
      "click",
      closeDetail
    );


  document
    .getElementById(
      "studentDetailCloseButton"
    )
    ?.addEventListener(
      "click",
      closeDetail
    );


  document
    .getElementById(
      "studentEdit"
    )
    ?.addEventListener(
      "click",
      () =>
        editStudent(
          student
        )
    );


  document
    .getElementById(
      "studentPassword"
    )
    ?.addEventListener(
      "click",
      () =>
        resetPassword(
          student
        )
    );


  document
    .getElementById(
      "studentSuspend"
    )
    ?.addEventListener(
      "click",
      () =>
        setStudentStatus(
          student,
          "suspended"
        )
    );


  document
    .getElementById(
      "studentUnsuspend"
    )
    ?.addEventListener(
      "click",
      () =>
        setStudentStatus(
          student,
          "active"
        )
    );

}


function detailItem(
  label,
  value
) {

  return `

    <div class="student-detail-item">

      <div class="student-detail-item-label">
        ${escapeHtml(label)}
      </div>

      <div class="student-detail-item-value">

        ${escapeHtml(
          value ||
          "未設定"
        )}

      </div>

    </div>

  `;

}


function formatDate(
  value
) {

  if (!value) {
    return "未記録";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(
      value
    );

  }


  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      dateStyle:
        "medium",
      timeStyle:
        "short"
    }
  )
    .format(
      date
    );

}


function closeDetail() {

  document
    .getElementById(
      "studentDetailDialog"
    )
    ?.remove();


  selectedStudent =
    null;

}


/* =========================================================
   Edit
   ========================================================= */

function editStudent(
  student
) {

  closeDetail();


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "studentEditDialog";


  overlay.className =
    "student-detail-overlay";


  overlay.innerHTML = `

    <div
      class="student-detail-dialog"
      role="dialog"
      aria-modal="true">

      <div class="student-detail-header">

        <div>

          <div class="student-detail-label">
            生徒情報編集
          </div>

          <h2>
            ${escapeHtml(
              student.display_name ||
              "名前未設定"
            )}
          </h2>

        </div>


        <button
          type="button"
          id="studentEditClose"
          class="student-detail-close">

          ×

        </button>

      </div>


      <div class="student-detail-body">

        <label class="student-edit-field">

          <span>
            氏名
          </span>

          <input
            id="editDisplayName"
            type="text"
            maxlength="100"
            value="${escapeHtml(
              student.display_name
            )}">

        </label>


        <label class="student-edit-field">

          <span>
            生徒番号
          </span>

          <input
            id="editStudentNumber"
            type="text"
            maxlength="50"
            value="${escapeHtml(
              student.student_number
            )}">

        </label>


        <label class="student-edit-field">

          <span>
            メールアドレス
          </span>

          <input
            id="editEmail"
            type="email"
            maxlength="254"
            value="${escapeHtml(
              student.email
            )}">

        </label>


        <label class="student-edit-field">

          <span>
            学年
          </span>

          <input
            id="editGrade"
            type="text"
            maxlength="30"
            value="${escapeHtml(
              student.grade
            )}">

        </label>


        <label class="student-edit-field">

          <span>
            クラス
          </span>

          <input
            id="editClassName"
            type="text"
            maxlength="50"
            value="${escapeHtml(
              student.class_name
            )}">

        </label>


        <div
          id="studentEditMessage"
          class="student-detail-message"
          hidden>
        </div>

      </div>


      <div class="student-detail-footer">

        <button
          type="button"
          id="studentEditCancel"
          class="secondary-button">

          キャンセル

        </button>


        <button
          type="button"
          id="studentEditSave"
          class="primary-button">

          保存

        </button>

      </div>

    </div>

  `;


  document.body.appendChild(
    overlay
  );


  document
    .getElementById(
      "studentEditClose"
    )
    ?.addEventListener(
      "click",
      () =>
        overlay.remove()
    );


  document
    .getElementById(
      "studentEditCancel"
    )
    ?.addEventListener(
      "click",
      () =>
        overlay.remove()
    );


  document
    .getElementById(
      "studentEditSave"
    )
    ?.addEventListener(
      "click",
      () =>
        saveStudentEdit(
          student,
          overlay
        )
    );

}


/* =========================================================
   Save edit
   ========================================================= */

async function saveStudentEdit(
  student,
  overlay
) {

  const button =
    document.getElementById(
      "studentEditSave"
    );


  const name =
    document.getElementById(
      "editDisplayName"
    )
      ?.value
      .trim();


  const studentNumber =
    document.getElementById(
      "editStudentNumber"
    )
      ?.value
      .trim();


  const email =
    document.getElementById(
      "editEmail"
    )
      ?.value
      .trim()
      .toLowerCase();


  const grade =
    document.getElementById(
      "editGrade"
    )
      ?.value
      .trim();


  const className =
    document.getElementById(
      "editClassName"
    )
      ?.value
      .trim();


  const errorElement =
    document.getElementById(
      "studentEditMessage"
    );


  if (!name) {

    errorElement.textContent =
      "氏名を入力してください。";

    errorElement.hidden =
      false;

    return;

  }


  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email)
  ) {

    errorElement.textContent =
      "メールアドレスの形式が正しくありません。";

    errorElement.hidden =
      false;

    return;

  }


  button.disabled =
    true;


  button.textContent =
    "保存中...";


  try {

    const {
      error
    } =
      await withTimeout(

        supabase
          .from("users")
          .update({

            display_name:
              name,

            student_number:
              studentNumber ||
              null,

            email:
              email ||
              null,

            grade:
              grade ||
              null,

            class_name:
              className ||
              null

          })
          .eq(
            "id",
            student.id
          )

      );


    if (error) {

      throw new Error(
        error.message
      );

    }


    overlay.remove();


    setMessage(
      "生徒情報を更新しました。",
      "success"
    );


    await loadStudents();

  }
  catch (error) {

    console.error(
      "UPDATE STUDENT ERROR:",
      error
    );


    errorElement.textContent =
      error.message ||
      "保存に失敗しました。";


    errorElement.hidden =
      false;

  }
  finally {

    button.disabled =
      false;

    button.textContent =
      "保存";

  }

}


/* =========================================================
   Suspend / Unsuspend
   ========================================================= */

async function setStudentStatus(
  student,
  status
) {

  const isSuspending =
    status ===
    "suspended";


  const question =
    isSuspending

      ? `${student.display_name || "この生徒"}のアカウントを停止しますか？`

      : `${student.display_name || "この生徒"}の停止を解除しますか？`;


  if (
    !window.confirm(
      question
    )
  ) {

    return;

  }


  const button =
    document.getElementById(
      isSuspending
        ? "studentSuspend"
        : "studentUnsuspend"
    );


  if (button) {

    button.disabled =
      true;

    button.textContent =
      isSuspending
        ? "停止中..."
        : "解除中...";

  }


  try {

    const {
      data,
      error:
        sessionError
    } =
      await withTimeout(
        supabase.auth.getSession()
      );


    if (sessionError) {
      throw sessionError;
    }


    const adminId =
      data?.session?.user?.id;


    if (!adminId) {

      throw new Error(
        "管理者のログインセッションがありません。"
      );

    }


    const updateData =
      isSuspending

        ? {

            status:
              "suspended",

            suspended_at:
              new Date()
                .toISOString(),

            suspended_by:
              adminId

          }

        : {

            status:
              "active",

            suspended_at:
              null,

            suspended_by:
              null

          };


    const {
      error
    } =
      await withTimeout(

        supabase
          .from("users")
          .update(
            updateData
          )
          .eq(
            "id",
            student.id
          )
          .eq(
            "role",
            "student"
          )

      );


    if (error) {

      throw new Error(
        error.message
      );

    }


    closeDetail();


    setMessage(

      isSuspending
        ? "アカウントを停止しました。"
        : "アカウントの停止を解除しました。",

      "success"

    );


    await loadStudents();

  }
  catch (error) {

    console.error(
      "STATUS UPDATE ERROR:",
      error
    );


    const element =
      document.getElementById(
        "studentDetailMessage"
      );


    if (element) {

      element.textContent =
        error.message ||
        "状態の変更に失敗しました。";

      element.hidden =
        false;

    }

  }
  finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        isSuspending
          ? "アカウント停止"
          : "停止解除";

    }

  }

}


/* =========================================================
   Password reset
   ========================================================= */

async function resetPassword(
  student
) {

  if (
    !window.confirm(
      `${student.display_name || "この生徒"}のパスワードを再設定しますか？`
    )
  ) {

    return;

  }


  const newPassword =
    window.prompt(
      "新しいパスワードを入力してください。8文字以上で指定してください。"
    );


  if (
    newPassword ===
    null
  ) {

    return;

  }


  if (
    newPassword.length <
    8
  ) {

    showDetailError(
      "パスワードは8文字以上にしてください。"
    );

    return;

  }


  if (
    newPassword.length >
    128
  ) {

    showDetailError(
      "パスワードは128文字以内にしてください。"
    );

    return;

  }


  try {

    const {
      data,
      error
    } =
      await withTimeout(
        supabase.auth.getSession()
      );


    if (error) {
      throw error;
    }


    const token =
      data?.session?.access_token;


    if (!token) {

      throw new Error(
        "管理者のログインセッションがありません。"
      );

    }


    const response =
      await withTimeout(

        fetch(
          CREATE_STUDENT_URL,
          {

            method:
              "POST",

            headers: {

              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json"

            },

            body:
              JSON.stringify({

                action:
                  "reset_student_password",

                student_id:
                  student.id,

                password:
                  newPassword

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
      !response.ok ||
      result.success !== true
    ) {

      throw new Error(

        result.error ||
        result.message ||
        "パスワード再設定に失敗しました。"

      );

    }


    showDetailMessage(
      "パスワードを再設定しました。",
      false
    );

  }
  catch (error) {

    console.error(
      "PASSWORD RESET ERROR:",
      error
    );


    showDetailError(
      error.message ||
      "パスワード再設定に失敗しました。"
    );

  }

}


/* =========================================================
   Detail message
   ========================================================= */

function showDetailMessage(
  text,
  error = false
) {

  const element =
    document.getElementById(
      "studentDetailMessage"
    );


  if (!element) {
    return;
  }


  element.textContent =
    text;


  element.hidden =
    false;


  element.classList.toggle(
    "error",
    error
  );

}


function showDetailError(
  text
) {

  showDetailMessage(
    text,
    true
  );

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


  const displayName =
    document
      .getElementById(
        "displayName"
      )
      ?.value
      .trim();


  const studentNumber =
    document
      .getElementById(
        "studentNumber"
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


  const grade =
    document
      .getElementById(
        "grade"
      )
      ?.value
      .trim();


  const className =
    document
      .getElementById(
        "className"
      )
      ?.value
      .trim();


  const password =
    document
      .getElementById(
        "password"
      )
      ?.value ||
    "";


  try {

    if (!displayName) {

      throw new Error(
        "氏名を入力してください。"
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
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email)
    ) {

      throw new Error(
        "メールアドレスの形式が正しくありません。"
      );

    }


    const {
      data,
      error
    } =
      await withTimeout(
        supabase.auth.getSession()
      );


    if (error) {
      throw error;
    }


    const token =
      data?.session?.access_token;


    if (!token) {

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
                `Bearer ${token}`,

              "Content-Type":
                "application/json"

            },

            body:
              JSON.stringify({

                action:
                  "create_student",

                display_name:
                  displayName,

                student_number:
                  studentNumber ||
                  null,

                email:
                  email ||
                  null,

                grade:
                  grade ||
                  null,

                class_name:
                  className ||
                  null,

                password

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
      !response.ok ||
      result.success !== true
    ) {

      throw new Error(

        result.error ||
        result.message ||
        "生徒登録に失敗しました。"

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
   CSV
   ========================================================= */

function exportStudentsCsv() {

  if (
    allStudents.length ===
    0
  ) {

    setMessage(
      "出力できる生徒がいません。",
      "error"
    );

    return;

  }


  const header = [

    "氏名",
    "生徒番号",
    "メールアドレス",
    "学年",
    "クラス",
    "状態",
    "最終ログイン",
    "登録日時",
    "更新日時",
    "生徒ID"

  ];


  const rows =
    allStudents.map(
      student => [

        student.display_name,

        student.student_number,

        student.email,

        student.grade,

        student.class_name,

        student.status ===
          "suspended"
          ? "停止"
          : "有効",

        student.last_login_at,

        student.created_at,

        student.updated_at,

        student.id

      ]
    );


  const csv = [

    header,

    ...rows

  ]
    .map(
      row =>
        row
          .map(
            value =>
              csvCell(
                value
              )
          )
          .join(",")
    )
    .join("\r\n");


  const blob =
    new Blob(
      [
        "\uFEFF" +
        csv
      ],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    `students-${formatFileDate(
      new Date()
    )}.csv`;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  URL.revokeObjectURL(
    url
  );

}


function csvCell(value) {

  return `"${String(
    value ?? ""
  )
    .replace(
      /"/g,
      '""'
    )}"`;

}


function formatFileDate(
  date
) {

  const pad =
    value =>
      String(
        value
      ).padStart(
        2,
        "0"
      );


  return [

    date.getFullYear(),

    pad(
      date.getMonth() + 1
    ),

    pad(
      date.getDate()
    ),

    "-",

    pad(
      date.getHours()
    ),

    pad(
      date.getMinutes()
    )

  ]
    .join("");

}


/* =========================================================
   DOM
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

  studentSearch =
    document.getElementById(
      "studentSearch"
    );

  clearSearch =
    document.getElementById(
      "clearSearch"
    );

  studentCount =
    document.getElementById(
      "studentCount"
    );

  exportCsv =
    document.getElementById(
      "exportCsv"
    );


  const missing =
    [];


  [
    [
      formCard,
      "formCard"
    ],
    [
      message,
      "message"
    ],
    [
      students,
      "students"
    ],
    [
      showFormButton,
      "showForm"
    ],
    [
      cancelButton,
      "cancel"
    ],
    [
      createButton,
      "create"
    ],
    [
      logoutButton,
      "logout"
    ],
    [
      studentSearch,
      "studentSearch"
    ],
    [
      clearSearch,
      "clearSearch"
    ],
    [
      studentCount,
      "studentCount"
    ],
    [
      exportCsv,
      "exportCsv"
    ]
  ]
    .forEach(
      item => {

        if (!item[0]) {

          missing.push(
            item[1]
          );

        }

      }
    );


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


  studentSearch.addEventListener(
    "input",
    () =>
      applySearch()
  );


  clearSearch.addEventListener(
    "click",
    () => {

      studentSearch.value =
        "";

      applySearch();

      studentSearch.focus();

    }
  );


  exportCsv.addEventListener(
    "click",
    exportStudentsCsv
  );


  [
    "displayName",
    "studentNumber",
    "email",
    "grade",
    "className",
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


  let admin;


  try {

    admin =
      await withTimeout(
        requireAdmin()
      );

  }
  catch (error) {

    console.error(
      "ADMIN AUTH ERROR:",
      error
    );


    showStudentError(
      error
    );


    return;

  }


  if (!admin) {

    showStudentError(
      new Error(
        "管理者としてログインしてください。"
      )
    );


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
              "STUDENT ADMIN FATAL:",
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
          "STUDENT ADMIN FATAL:",
          error
        );


        showStudentError(
          error
        );

      }
    );

}
