
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

const BRIGHT_WORKER_URL =
  "https://wcddlfjtkrbpperhrxkk.supabase.co/functions/v1/bright-worker";

const REQUEST_TIMEOUT =
  10000;


/* =========================================================
   State
   ========================================================= */

let allStudents = [];

let filteredStudents = [];

let formCard = null;

let message = null;

let studentsElement = null;

let searchInput = null;

let studentCount = null;


/* =========================================================
   Utility
   ========================================================= */

function escapeHtml(
  value
) {

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

function clearCreateForm() {

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


function showCreateForm() {

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


function hideCreateForm() {

  if (!formCard) {
    return;
  }


  formCard.classList.add(
    "hidden"
  );


  clearCreateForm();


  setMessage(
    ""
  );

}


/* =========================================================
   Load students
   ========================================================= */

async function loadStudents() {

  studentsElement.innerHTML = `
    <div class="list-row">
      生徒を読み込んでいます。
    </div>
  `;


  studentsElement.setAttribute(
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
        error.message
      );

    }


    allStudents =
      Array.isArray(data)
        ? data
        : [];


    studentsElement.setAttribute(
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


    studentsElement.setAttribute(
      "aria-busy",
      "false"
    );


    studentsElement.innerHTML = `
      <div class="list-row">

        <strong>
          生徒一覧を読み込めませんでした。
        </strong>

        <br><br>

        <small>
          ${escapeHtml(
            error?.message ||
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
      searchInput?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  if (!keyword) {

    filteredStudents =
      [
        ...allStudents
      ];

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


/* =========================================================
   Render students
   ========================================================= */

function renderStudents() {

  if (studentCount) {

    studentCount.textContent =
      `${filteredStudents.length}人 / ${allStudents.length}人`;

  }


  if (
    filteredStudents.length ===
    0
  ) {

    studentsElement.innerHTML = `
      <div class="list-row">
        該当する生徒はいません。
      </div>
    `;

    return;

  }


  studentsElement.innerHTML =
    filteredStudents
      .map(
        student => {

          const active =
            student.status !==
            "suspended";


          return `

            <div
              class="list-row student-row">

              <div
                class="student-row-main">

                <div
                  class="student-row-name">

                  ${escapeHtml(
                    student.display_name ||
                    "名前未設定"
                  )}

                </div>


                <div
                  class="student-row-meta">

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


              <div
                class="student-row-status">

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
                data-student-detail="${escapeHtml(
                  student.id
                )}">

                詳細

              </button>

            </div>

          `;

        }
      )
      .join("");


  /*
   * 重要:
   * ボタンに直接イベントを付ける。
   * 親要素へのイベント委譲は使わない。
   */

  studentsElement
    .querySelectorAll(
      "[data-student-detail]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          event => {

            event.preventDefault();

            event.stopPropagation();


            const id =
              button.dataset
                .studentDetail;


            const student =
              allStudents.find(
                item =>
                  String(
                    item.id
                  ) ===
                  String(id)
              );


            if (!student) {

              console.error(
                "STUDENT NOT FOUND:",
                id
              );

              return;

            }


            openStudentDetail(
              student
            );

          }
        );

      }
    );

}


/* =========================================================
   Detail panel
   ========================================================= */

function openStudentDetail(
  student
) {

  closeStudentDetail();


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "studentDetailOverlay";


  overlay.className =
    "student-detail-overlay";


  overlay.innerHTML = `

    <aside
      class="student-detail-panel"
      role="dialog"
      aria-modal="true"
      aria-label="生徒詳細">


      <header
        class="student-detail-header">

        <div>

          <div
            class="student-detail-label">

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
          class="student-detail-close"
          aria-label="閉じる">

          ×

        </button>

      </header>


      <div
        class="student-detail-body">


        <section
          class="detail-section">

          <h3
            class="detail-section-title">

            基本情報

          </h3>


          <div
            class="student-detail-grid">

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
              "ユーザーID",
              student.id
            )}

          </div>

        </section>


        <section
          class="detail-section">

          <h3
            class="detail-section-title">

            アカウント

          </h3>


          <div
            class="student-detail-grid">

            ${detailItem(
              "状態",
              student.status ===
                "suspended"
                ? "停止"
                : "有効"
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

          </div>

        </section>


        <div
          id="studentDetailMessage"
          class="student-detail-message"
          hidden>
        </div>


      </div>


      <footer
        class="student-detail-footer">


        <button
          type="button"
          id="studentEditButton"
          class="secondary-button">

          編集

        </button>


        <button
          type="button"
          id="studentPasswordButton"
          class="secondary-button">

          パスワード再設定

        </button>


        ${
          student.status ===
          "suspended"

            ? `

              <button
                type="button"
                id="studentUnsuspendButton"
                class="primary-button">

                停止解除

              </button>

            `

            : `

              <button
                type="button"
                id="studentSuspendButton"
                class="danger-button">

                アカウント停止

              </button>

            `
        }


      </footer>


    </aside>

  `;


  document.body.appendChild(
    overlay
  );


  /*
   * 背景クリックで閉じる。
   */

  overlay.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        overlay
      ) {

        closeStudentDetail();

      }

    }
  );


  document
    .getElementById(
      "studentDetailClose"
    )
    ?.addEventListener(
      "click",
      closeStudentDetail
    );


  document
    .getElementById(
      "studentEditButton"
    )
    ?.addEventListener(
      "click",
      () =>
        openEditPanel(
          student
        )
    );


  document
    .getElementById(
      "studentPasswordButton"
    )
    ?.addEventListener(
      "click",
      () =>
        resetStudentPassword(
          student
        )
    );


  document
    .getElementById(
      "studentSuspendButton"
    )
    ?.addEventListener(
      "click",
      () =>
        changeStudentStatus(
          student,
          "suspended"
        )
    );


  document
    .getElementById(
      "studentUnsuspendButton"
    )
    ?.addEventListener(
      "click",
      () =>
        changeStudentStatus(
          student,
          "active"
        )
    );


  document.body.style.overflow =
    "hidden";

}


function detailItem(
  label,
  value
) {

  return `

    <div
      class="student-detail-item">

      <div
        class="student-detail-item-label">

        ${escapeHtml(
          label
        )}

      </div>


      <div
        class="student-detail-item-value">

        ${escapeHtml(
          value ||
          "未設定"
        )}

      </div>

    </div>

  `;

}


function closeStudentDetail() {

  document
    .getElementById(
      "studentDetailOverlay"
    )
    ?.remove();


  document.body.style.overflow =
    "";

}


/* =========================================================
   Detail message
   ========================================================= */

function showDetailMessage(
  text,
  isError = false
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
    isError
  );

}


/* =========================================================
   Edit panel
   ========================================================= */

function openEditPanel(
  student
) {

  const overlay =
    document.getElementById(
      "studentDetailOverlay"
    );


  const panel =
    overlay?.querySelector(
      ".student-detail-panel"
    );


  if (!panel) {
    return;
  }


  panel.innerHTML = `

    <header
      class="student-detail-header">

      <div>

        <div
          class="student-detail-label">

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

    </header>


    <div
      class="student-detail-body">


      <div
        class="student-edit-fields">


        ${editField(
          "氏名",
          "editDisplayName",
          student.display_name
        )}


        ${editField(
          "生徒番号",
          "editStudentNumber",
          student.student_number
        )}


        ${editField(
          "メールアドレス",
          "editEmail",
          student.email,
          "email"
        )}


        ${editField(
          "学年",
          "editGrade",
          student.grade
        )}


        ${editField(
          "クラス",
          "editClassName",
          student.class_name
        )}


      </div>


      <div
        id="studentEditMessage"
        class="student-detail-message"
        hidden>
      </div>


    </div>


    <footer
      class="student-detail-footer">


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


    </footer>

  `;


  document
    .getElementById(
      "studentEditClose"
    )
    ?.addEventListener(
      "click",
      () =>
        openStudentDetail(
          student
        )
    );


  document
    .getElementById(
      "studentEditCancel"
    )
    ?.addEventListener(
      "click",
      () =>
        openStudentDetail(
          student
        )
    );


  document
    .getElementById(
      "studentEditSave"
    )
    ?.addEventListener(
      "click",
      () =>
        saveStudentEdit(
          student
        )
    );

}


function editField(
  label,
  id,
  value,
  type = "text"
) {

  return `

    <label
      class="student-edit-field">

      <span>
        ${escapeHtml(
          label
        )}
      </span>


      <input
        id="${escapeHtml(
          id
        )}"
        type="${escapeHtml(
          type
        )}"
        value="${escapeHtml(
          value
        )}"
        maxlength="254">

    </label>

  `;

}


/* =========================================================
   Save edit
   ========================================================= */

async function saveStudentEdit(
  student
) {

  const saveButton =
    document.getElementById(
      "studentEditSave"
    );


  const errorElement =
    document.getElementById(
      "studentEditMessage"
    );


  const displayName =
    document
      .getElementById(
        "editDisplayName"
      )
      ?.value
      .trim();


  const studentNumber =
    document
      .getElementById(
        "editStudentNumber"
      )
      ?.value
      .trim();


  const email =
    document
      .getElementById(
        "editEmail"
      )
      ?.value
      .trim()
      .toLowerCase();


  const grade =
    document
      .getElementById(
        "editGrade"
      )
      ?.value
      .trim();


  const className =
    document
      .getElementById(
        "editClassName"
      )
      ?.value
      .trim();


  if (!displayName) {

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


  saveButton.disabled =
    true;


  saveButton.textContent =
    "保存中...";


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
      throw sessionError;
    }


    const token =
      sessionData?.session
        ?.access_token;


    if (!token) {

      throw new Error(
        "管理者のログインセッションがありません。"
      );

    }


    const response =
      await withTimeout(

        fetch(
          BRIGHT_WORKER_URL,
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
                  "update_student",

                student_id:
                  student.id,

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
                  null

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
        "生徒情報の更新に失敗しました。"

      );

    }


    closeStudentDetail();


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
      "更新に失敗しました。";


    errorElement.hidden =
      false;

  }
  finally {

    saveButton.disabled =
      false;

    saveButton.textContent =
      "保存";

  }

}


/* =========================================================
   Status
   ========================================================= */

async function changeStudentStatus(
  student,
  status
) {

  const suspend =
    status ===
    "suspended";


  const confirmed =
    window.confirm(

      suspend

        ? `${student.display_name || "この生徒"}のアカウントを停止しますか？`

        : `${student.display_name || "この生徒"}の停止を解除しますか？`

    );


  if (!confirmed) {
    return;
  }


  const button =
    document.getElementById(
      suspend
        ? "studentSuspendButton"
        : "studentUnsuspendButton"
    );


  if (button) {

    button.disabled =
      true;

    button.textContent =
      suspend
        ? "停止中..."
        : "解除中...";

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
      throw sessionError;
    }


    const token =
      sessionData?.session
        ?.access_token;


    if (!token) {

      throw new Error(
        "管理者のログインセッションがありません。"
      );

    }


    const response =
      await withTimeout(

        fetch(
          BRIGHT_WORKER_URL,
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
                  suspend
                    ? "suspend_student"
                    : "unsuspend_student",

                student_id:
                  student.id

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
        "アカウント状態の変更に失敗しました。"

      );

    }


    closeStudentDetail();


    setMessage(

      suspend
        ? "アカウントを停止しました。"
        : "アカウントの停止を解除しました。",

      "success"

    );


    await loadStudents();

  }
  catch (error) {

    console.error(
      "STATUS ERROR:",
      error
    );


    showDetailMessage(
      error.message ||
      "アカウント状態の変更に失敗しました。",
      true
    );

  }
  finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        suspend
          ? "アカウント停止"
          : "停止解除";

    }

  }

}


/* =========================================================
   Password reset
   ========================================================= */

async function resetStudentPassword(
  student
) {

  const password =
    window.prompt(
      "新しいパスワードを入力してください。\n8文字以上128文字以内。"
    );


  if (
    password ===
    null
  ) {

    return;

  }


  if (
    password.length <
    8 ||
    password.length >
    128
  ) {

    showDetailMessage(
      "パスワードは8文字以上128文字以内にしてください。",
      true
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
      throw sessionError;
    }


    const token =
      sessionData?.session
        ?.access_token;


    if (!token) {

      throw new Error(
        "管理者のログインセッションがありません。"
      );

    }


    const response =
      await withTimeout(

        fetch(
          BRIGHT_WORKER_URL,
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


    showDetailMessage(
      error.message ||
      "パスワード再設定に失敗しました。",
      true
    );

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

  studentsElement =
    document.getElementById(
      "students"
    );

  searchInput =
    document.getElementById(
      "studentSearch"
    );

  studentCount =
    document.getElementById(
      "studentCount"
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


  const clearSearchButton =
    document.getElementById(
      "clearSearch"
    );


  const exportCsvButton =
    document.getElementById(
      "exportCsv"
    );


  if (
    !formCard ||
    !message ||
    !studentsElement ||
    !searchInput ||
    !studentCount ||
    !showFormButton ||
    !cancelButton ||
    !createButton ||
    !logoutButton
  ) {

    throw new Error(
      "生徒管理画面のHTMLが正しく構成されていません。"
    );

  }


  showFormButton.addEventListener(
    "click",
    showCreateForm
  );


  cancelButton.addEventListener(
    "click",
    hideCreateForm
  );


  createButton.addEventListener(
    "click",
    createStudent
  );


  logoutButton.addEventListener(
    "click",
    logout
  );


  searchInput.addEventListener(
    "input",
    applySearch
  );


  clearSearchButton?.addEventListener(
    "click",
    () => {

      searchInput.value =
        "";

      applySearch();

      searchInput.focus();

    }
  );


  exportCsvButton?.addEventListener(
    "click",
    exportCsv
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
          .getElementById(
            id
          )
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
   Create student
   ========================================================= */

async function createStudent() {

  const button =
    document.getElementById(
      "create"
    );


  if (
    button.disabled
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


  if (!displayName) {

    setMessage(
      "氏名を入力してください。",
      "error"
    );

    return;

  }


  if (
    password.length <
    8 ||
    password.length >
    128
  ) {

    setMessage(
      "パスワードは8文字以上128文字以内にしてください。",
      "error"
    );

    return;

  }


  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email)
  ) {

    setMessage(
      "メールアドレスの形式が正しくありません。",
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
      throw sessionError;
    }


    const token =
      sessionData?.session
        ?.access_token;


    if (!token) {

      throw new Error(
        "管理者のログインセッションがありません。"
      );

    }


    button.disabled =
      true;


    button.textContent =
      "登録中...";


    setMessage(
      "生徒を登録しています。"
    );


    const response =
      await withTimeout(

        fetch(
          BRIGHT_WORKER_URL,
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


    clearCreateForm();


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

    button.disabled =
      false;

    button.textContent =
      "登録";

  }

}


/* =========================================================
   CSV
   ========================================================= */

function exportCsv() {

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
    "ユーザーID"

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


  const csv =
    [
      header,
      ...rows
    ]
      .map(
        row =>
          row
            .map(
              value =>
                `"${String(
                  value ?? ""
                )
                  .replace(
                    /"/g,
                    '""'
                  )}"`
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
    `students-${new Date()
      .toISOString()
      .slice(
        0,
        10
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


/* =========================================================
   Start
   ========================================================= */

async function start() {

  initializeDom();


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


    studentsElement.innerHTML = `
      <div class="list-row">

        生徒管理を読み込めませんでした。

        <br><br>

        <small>
          ${escapeHtml(
            error.message ||
            "管理者認証に失敗しました。"
          )}
        </small>

      </div>
    `;


    return;

  }


  if (!admin) {

    studentsElement.innerHTML = `
      <div class="list-row">
        管理者としてログインしてください。
      </div>
    `;


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
              "STUDENT ADMIN ERROR:",
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
          "STUDENT ADMIN ERROR:",
          error
        );

      }
    );

}
