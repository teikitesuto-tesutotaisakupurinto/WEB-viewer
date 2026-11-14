
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

const FUNCTION_NAME =
  "bright-worker";

const FUNCTION_URL =
  "https://wcddlfjtkrbpperhrxkk.supabase.co/functions/v1/bright-worker";


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

const studentsElement =
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
   State
   ========================================================= */

let studentsData = [];


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

    return "未記録";

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
   Function call
   ========================================================= */

async function callBrightWorker(
  payload
) {

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


  const response =
    await fetch(
      FUNCTION_URL,
      {
        method:
          "POST",

        headers: {

          Authorization:
            `Bearer ${sessionData.session.access_token}`,

          "Content-Type":
            "application/json"

        },

        body:
          JSON.stringify(
            payload
          )

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
        text ||
        "サーバーから正しい応答がありません。"

    };

  }


  if (
    !response.ok ||
    !result.success
  ) {

    throw new Error(

      result.error ||
      `サーバーエラー (${response.status})`

    );

  }


  return result;

}


/* =========================================================
   Create form
   ========================================================= */

function showCreateForm() {

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


function hideCreateForm() {

  formCard?.classList.add(
    "hidden"
  );


  setMessage(
    ""
  );


  [
    "displayName",
    "email",
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


/* =========================================================
   Load students
   ========================================================= */

async function loadStudents() {

  if (!studentsElement) {

    return;

  }


  studentsElement.innerHTML = `

    <div class="list-row">

      生徒を読み込んでいます。

    </div>

  `;


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
        "ログインセッションがありません。"
      );

    }


    const {
      data,
      error
    } =
    await supabase
      .from("users")
      .select(`
        id,
        display_name,
        role,
        email,
        status,
        must_change_password,
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
      );


    if (error) {

      throw error;

    }


    studentsData =
      Array.isArray(
        data
      )
        ? data
        : [];


    renderStudents();

  }
  catch (error) {

    console.error(
      "LOAD STUDENTS ERROR:",
      error
    );


    studentsElement.innerHTML = `

      <div class="list-row">

        <strong>
          生徒管理を読み込めませんでした。
        </strong>

        <p>
          ${escapeHtml(
            error?.message ||
            "データの取得に失敗しました。"
          )}
        </p>


        <button
          id="retryStudents"
          type="button"
          class="primary-button">

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
   Render students
   ========================================================= */

function renderStudents() {

  if (
    !studentsData.length
  ) {

    studentsElement.innerHTML = `

      <div class="list-row">

        登録されている生徒はいません。

      </div>

    `;

    return;

  }


  studentsElement.innerHTML =
    studentsData
      .map(
        student => {

          const suspended =
            student.status ===
            "suspended";


          return `

            <div
              class="list-row student-row"
              data-student-id="${escapeHtml(
                student.id
              )}">


              <div
                class="student-row-info">

                <div
                  class="student-row-name">

                  ${escapeHtml(
                    student.display_name ||
                    "名前未設定"
                  )}

                </div>


                <div
                  class="student-row-email">

                  ${escapeHtml(
                    student.email ||
                    "メールアドレス未設定"
                  )}

                </div>

              </div>


              <div
                class="student-row-status">

                <span
                  class="
                    student-status
                    ${
                      suspended
                        ? "suspended"
                        : "active"
                    }
                  ">

                  ${
                    suspended
                      ? "停止中"
                      : "有効"
                  }

                </span>

              </div>


              <button
                type="button"
                class="secondary-button student-detail-button"
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
   * 詳細ボタン。
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
              button.getAttribute(
                "data-student-detail"
              );


            const student =
              studentsData.find(
                item =>
                  String(
                    item.id
                  ) ===
                  String(id)
              );


            if (!student) {

              return;

            }


            showStudentDetail(
              student
            );

          }
        );

      }
    );

}


/* =========================================================
   Student detail modal
   ========================================================= */

function showStudentDetail(
  student
) {

  closeStudentDetail();


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "studentDetailModal";


  overlay.className =
    "student-detail-overlay";


  overlay.innerHTML = `

    <div
      class="student-detail-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="studentDetailTitle">


      <header
        class="student-detail-header">

        <div>

          <div
            class="student-detail-label">

            生徒詳細

          </div>


          <h2
            id="studentDetailTitle">

            ${escapeHtml(
              student.display_name ||
              "名前未設定"
            )}

          </h2>

        </div>


        <button
          id="studentDetailClose"
          type="button"
          class="student-detail-close"
          aria-label="閉じる">

          ×

        </button>

      </header>


      <div
        class="student-detail-body">


        <section
          class="student-detail-section">

          <h3>
            基本情報
          </h3>


          <div
            class="student-detail-table">

            ${detailRow(
              "氏名",
              student.display_name
            )}

            ${detailRow(
              "メールアドレス",
              student.email
            )}

            ${detailRow(
              "ユーザーID",
              student.id
            )}

            ${detailRow(
              "登録日時",
              formatDate(
                student.created_at
              )
            )}

            ${detailRow(
              "更新日時",
              formatDate(
                student.updated_at
              )
            )}

          </div>

        </section>


        <section
          class="student-detail-section">

          <h3>
            アカウント
          </h3>


          <div
            class="student-detail-table">

            ${detailRow(
              "状態",
              student.status ===
                "suspended"
                ? "停止中"
                : "有効"
            )}

            ${detailRow(
              "パスワード",
              student.must_change_password
                ? "次回ログイン時に変更"
                : "通常"
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
          id="studentPasswordReset"
          type="button"
          class="secondary-button">

          パスワード再設定

        </button>


        ${
          student.status ===
          "suspended"

            ? `

              <button
                id="studentUnsuspend"
                type="button"
                class="primary-button">

                停止解除

              </button>

            `

            : `

              <button
                id="studentSuspend"
                type="button"
                class="danger-button">

                アカウント停止

              </button>

            `
        }


        <button
          id="studentDetailCloseBottom"
          type="button"
          class="secondary-button">

          閉じる

        </button>


      </footer>

    </div>

  `;


  document.body.appendChild(
    overlay
  );


  document.body.style.overflow =
    "hidden";


  /*
   * 閉じる。
   */

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
      "studentDetailCloseBottom"
    )
    ?.addEventListener(
      "click",
      closeStudentDetail
    );


  /*
   * パスワード再設定。
   */

  document
    .getElementById(
      "studentPasswordReset"
    )
    ?.addEventListener(
      "click",
      () =>
        resetStudentPassword(
          student
        )
    );


  /*
   * 停止。
   */

  document
    .getElementById(
      "studentSuspend"
    )
    ?.addEventListener(
      "click",
      () =>
        suspendStudent(
          student
        )
    );


  /*
   * 停止解除。
   */

  document
    .getElementById(
      "studentUnsuspend"
    )
    ?.addEventListener(
      "click",
      () =>
        unsuspendStudent(
          student
        )
    );


  /*
   * 背景クリック。
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


  /*
   * ESC。
   */

  document.addEventListener(
    "keydown",
    handleDetailEscape
  );

}


function detailRow(
  label,
  value
) {

  return `

    <div
      class="student-detail-row">

      <div
        class="student-detail-key">

        ${escapeHtml(
          label
        )}

      </div>


      <div
        class="student-detail-value">

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
      "studentDetailModal"
    )
    ?.remove();


  document.body.style.overflow =
    "";


  document.removeEventListener(
    "keydown",
    handleDetailEscape
  );

}


function handleDetailEscape(
  event
) {

  if (
    event.key ===
    "Escape"
  ) {

    closeStudentDetail();

  }

}


/* =========================================================
   Detail message
   ========================================================= */

function setDetailMessage(
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


  element.hidden =
    false;


  element.textContent =
    text;


  element.classList.toggle(
    "error",
    error
  );

}


/* =========================================================
   Password reset
   ========================================================= */

async function resetStudentPassword(
  student
) {

  const confirmed =
    window.confirm(

      `${student.display_name || "この生徒"}のパスワードを再発行しますか？\n\n新しいパスワードは自動生成され、今回だけ表示されます。`

    );


  if (!confirmed) {

    return;

  }


  const button =
    document.getElementById(
      "studentPasswordReset"
    );


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "発行中...";

  }


  setDetailMessage(
    "一時パスワードを発行しています。"
  );


  try {

    const result =
      await callBrightWorker({

        action:
          "reset_student_password",

        student_id:
          student.id

      });


    if (
      !result.temporary_password
    ) {

      throw new Error(
        "一時パスワードを取得できませんでした。"
      );

    }


    showTemporaryPassword(
      result.temporary_password
    );

  }
  catch (error) {

    console.error(
      "PASSWORD RESET ERROR:",
      error
    );


    setDetailMessage(
      error.message ||
      "パスワード再発行に失敗しました。",
      true
    );

  }
  finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "パスワード再設定";

    }

  }

}


/* =========================================================
   Temporary password
   ========================================================= */

function showTemporaryPassword(
  password
) {

  document
    .getElementById(
      "temporaryPasswordModal"
    )
    ?.remove();


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "temporaryPasswordModal";


  overlay.className =
    "student-detail-overlay";


  overlay.style.zIndex =
    "100001";


  overlay.innerHTML = `

    <div
      class="student-detail-modal password-modal"
      role="dialog"
      aria-modal="true">


      <header
        class="student-detail-header">

        <div>

          <div
            class="student-detail-label">

            パスワード再発行

          </div>


          <h2>
            一時パスワード
          </h2>

        </div>

      </header>


      <div
        class="student-detail-body">

        <p>
          一時パスワードを発行しました。
        </p>

        <p>
          このパスワードは今回だけ表示されます。
          必要ならコピーして本人へ伝えてください。
        </p>


        <div
          class="temporary-password-box">

          <input
            id="temporaryPasswordInput"
            type="text"
            readonly
            value="${escapeHtml(
              password
            )}">


          <button
            id="temporaryPasswordCopy"
            type="button"
            class="primary-button">

            コピー

          </button>

        </div>


        <p
          id="temporaryPasswordCopyMessage"
          class="temporary-password-message">
        </p>

      </div>


      <footer
        class="student-detail-footer">

        <button
          id="temporaryPasswordClose"
          type="button"
          class="secondary-button">

          閉じる

        </button>

      </footer>

    </div>

  `;


  document.body.appendChild(
    overlay
  );


  const input =
    document.getElementById(
      "temporaryPasswordInput"
    );


  const copyButton =
    document.getElementById(
      "temporaryPasswordCopy"
    );


  const copyMessage =
    document.getElementById(
      "temporaryPasswordCopyMessage"
    );


  input?.focus();

  input?.select();


  copyButton?.addEventListener(
    "click",
    async () => {

      try {

        await navigator.clipboard.writeText(
          password
        );


        copyButton.textContent =
          "コピーしました";


        copyMessage.textContent =
          "クリップボードにコピーしました。";

      }
      catch {

        input?.focus();

        input?.select();


        copyMessage.textContent =
          "選択しました。コピーしてください。";

      }

    }
  );


  document
    .getElementById(
      "temporaryPasswordClose"
    )
    ?.addEventListener(
      "click",
      () => {

        overlay.remove();

      }
    );

}


/* =========================================================
   Suspend
   ========================================================= */

async function suspendStudent(
  student
) {

  if (
    !window.confirm(
      `${student.display_name || "この生徒"}のアカウントを停止しますか？`
    )
  ) {

    return;

  }


  try {

    await callBrightWorker({

      action:
        "suspend_student",

      student_id:
        student.id

    });


    closeStudentDetail();


    setMessage(
      "アカウントを停止しました。",
      "success"
    );


    await loadStudents();

  }
  catch (error) {

    console.error(
      "SUSPEND ERROR:",
      error
    );


    setDetailMessage(
      error.message ||
      "アカウントを停止できませんでした。",
      true
    );

  }

}


/* =========================================================
   Unsuspend
   ========================================================= */

async function unsuspendStudent(
  student
) {

  if (
    !window.confirm(
      `${student.display_name || "この生徒"}の停止を解除しますか？`
    )
  ) {

    return;

  }


  try {

    await callBrightWorker({

      action:
        "unsuspend_student",

      student_id:
        student.id

    });


    closeStudentDetail();


    setMessage(
      "アカウントの停止を解除しました。",
      "success"
    );


    await loadStudents();

  }
  catch (error) {

    console.error(
      "UNSUSPEND ERROR:",
      error
    );


    setDetailMessage(
      error.message ||
      "停止を解除できませんでした。",
      true
    );

  }

}


/* =========================================================
   Create student
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

    setMessage(
      "氏名を入力してください。",
      "error"
    );

    return;

  }


  if (!email) {

    setMessage(
      "メールアドレスを入力してください。",
      "error"
    );

    return;

  }


  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(
        email
      )
  ) {

    setMessage(
      "メールアドレスの形式が正しくありません。",
      "error"
    );

    return;

  }


  if (
    password.length <
      8
  ) {

    setMessage(
      "パスワードは8文字以上にしてください。",
      "error"
    );

    return;

  }


  createButton.disabled =
    true;


  createButton.textContent =
    "登録中...";


  setMessage(
    "生徒を登録しています。"
  );


  try {

    await callBrightWorker({

      action:
        "create_student",

      display_name:
        displayName,

      email,

      password

    });


    hideCreateForm();


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
        "登録に失敗しました。"
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
   Events
   ========================================================= */

showFormButton?.addEventListener(
  "click",
  showCreateForm
);


cancelButton?.addEventListener(
  "click",
  hideCreateForm
);


createButton?.addEventListener(
  "click",
  createStudent
);


logoutButton?.addEventListener(
  "click",
  logout
);


/* =========================================================
   Start
   ========================================================= */

async function start() {

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
      "STUDENT ADMIN START ERROR:",
      error
    );


    if (studentsElement) {

      studentsElement.innerHTML = `

        <div class="list-row">

          <strong>
            生徒管理を読み込めませんでした。
          </strong>

          <p>
            ${escapeHtml(
              error?.message ||
              "データの取得に失敗しました。"
            )}
          </p>

        </div>

      `;

    }

  }

}


start();
