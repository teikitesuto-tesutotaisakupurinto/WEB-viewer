
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
  "create-student";

const REQUEST_TIMEOUT =
  15000;


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

let createButton = null;


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

  let timer = null;


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

        if (timer) {

          clearTimeout(
            timer
          );

        }

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
   Session
   ========================================================= */

async function getSession() {

  const {
    data,
    error
  } =
    await withTimeout(
      supabase.auth.getSession()
    );


  if (error) {

    throw new Error(
      `ログイン状態を確認できませんでした。${
        error.message
          ? ` ${error.message}`
          : ""
      }`
    );

  }


  const session =
    data?.session;


  if (!session?.access_token) {

    throw new Error(
      "管理者のログインセッションがありません。"
    );

  }


  return session;

}


/* =========================================================
   Edge Function
   ========================================================= */

async function callStudentFunction(
  payload
) {

  /*
   * 先にセッションを確認。
   */

  await getSession();


  let result;


  try {

    result =
      await withTimeout(

        supabase.functions.invoke(
          FUNCTION_NAME,
          {
            body:
              payload
          }
        )

      );

  }
  catch (error) {

    console.error(
      "EDGE FUNCTION INVOKE ERROR:",
      error
    );


    /*
     * Supabase Functionsの通信エラー。
     */

    let detail =
      "";


    try {

      const context =
        error?.context;


      if (
        context &&
        typeof context.text ===
          "function"
      ) {

        detail =
          await context.text();

      }

    }
    catch {}


    if (detail) {

      try {

        const parsed =
          JSON.parse(
            detail
          );


        detail =
          parsed?.error ||
          parsed?.message ||
          detail;

      }
      catch {}

    }


    throw new Error(

      detail ||
      error?.message ||
      "Edge Functionに接続できませんでした。"

    );

  }


  const {
    data,
    error
  } =
    result;


  if (error) {

    console.error(
      "EDGE FUNCTION ERROR:",
      error
    );


    let detail =
      "";


    try {

      const context =
        error?.context;


      if (
        context &&
        typeof context.text ===
          "function"
      ) {

        detail =
          await context.text();

      }

    }
    catch {}


    if (detail) {

      try {

        const parsed =
          JSON.parse(
            detail
          );


        detail =
          parsed?.error ||
          parsed?.message ||
          detail;

      }
      catch {}

    }


    throw new Error(

      detail ||
      error?.message ||
      "Edge Functionでエラーが発生しました。"

    );

  }


  if (!data) {

    throw new Error(
      "Edge Functionから応答がありません。"
    );

  }


  if (
    data.success !==
    true
  ) {

    throw new Error(

      data.error ||
      data.message ||
      "処理に失敗しました。"

    );

  }


  return data;

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
   Create form
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


  try {

    await getSession();


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


    applySearch();

  }
  catch (error) {

    console.error(
      "LOAD STUDENTS ERROR:",
      error
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
    String(
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

          return [

            student.display_name,

            student.student_number,

            student.email,

            student.grade,

            student.class_name,

            student.id

          ]
            .some(
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
   Render
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

        登録されている生徒はいません。

      </div>

    `;


    return;

  }


  studentsElement.innerHTML =
    filteredStudents
      .map(
        student => {

          const suspended =
            student.status ===
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


              <span
                class="student-status ${
                  suspended
                    ? "suspended"
                    : "active"
                }">

                ${
                  suspended
                    ? "停止"
                    : "有効"
                }

              </span>


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
   * 詳細ボタン。
   */

  studentsElement.onclick =
    event => {

      const target =
        event.target;


      if (
        !(target instanceof Element)
      ) {

        return;

      }


      const button =
        target.closest(
          "[data-student-detail]"
        );


      if (!button) {

        return;

      }


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

        return;

      }


      openStudentDetail(
        student
      );

    };

}


/* =========================================================
   Detail
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


  Object.assign(
    overlay.style,
    {

      position:
        "fixed",

      inset:
        "0",

      zIndex:
        "99990",

      background:
        "rgba(0,0,0,.28)"

    }
  );


  const panel =
    document.createElement(
      "aside"
    );


  Object.assign(
    panel.style,
    {

      position:
        "absolute",

      top:
        "0",

      right:
        "0",

      bottom:
        "0",

      width:
        "min(540px,100vw)",

      overflowY:
        "auto",

      background:
        "#fff",

      color:
        "#222",

      boxShadow:
        "-12px 0 35px rgba(0,0,0,.15)"

    }
  );


  panel.innerHTML = `

    <header
      style="
        display:flex;
        justify-content:space-between;
        gap:20px;
        padding:28px;
        border-bottom:1px solid #e5e7eb;
      ">

      <div>

        <div
          style="
            color:#888;
            font-size:11px;
            margin-bottom:7px;
          ">

          生徒詳細

        </div>


        <h2
          style="
            margin:0;
            font-size:21px;
          ">

          ${escapeHtml(
            student.display_name ||
            "名前未設定"
          )}

        </h2>

      </div>


      <button
        id="studentDetailClose"
        type="button"
        style="
          width:36px;
          height:36px;
          border:1px solid #ddd;
          border-radius:7px;
          background:#fff;
          font-size:20px;
          cursor:pointer;
        ">

        ×

      </button>

    </header>


    <div
      style="
        padding:28px;
      ">


      <h3
        style="
          margin:0 0 14px;
          font-size:13px;
          color:#555;
        ">

        基本情報

      </h3>


      <div
        style="
          border:1px solid #e5e7eb;
          border-radius:8px;
          overflow:hidden;
        ">

        ${detailRow(
          "氏名",
          student.display_name
        )}

        ${detailRow(
          "生徒番号",
          student.student_number
        )}

        ${detailRow(
          "メールアドレス",
          student.email
        )}

        ${detailRow(
          "学年",
          student.grade
        )}

        ${detailRow(
          "クラス",
          student.class_name
        )}

        ${detailRow(
          "ユーザーID",
          student.id
        )}

      </div>


      <h3
        style="
          margin:30px 0 14px;
          font-size:13px;
          color:#555;
        ">

        アカウント

      </h3>


      <div
        style="
          border:1px solid #e5e7eb;
          border-radius:8px;
          overflow:hidden;
        ">

        ${detailRow(
          "状態",
          student.status ===
            "suspended"
            ? "停止"
            : "有効"
        )}

        ${detailRow(
          "パスワード変更",
          student.must_change_password
            ? "次回ログイン時に必要"
            : "不要"
        )}

        ${detailRow(
          "最終ログイン",
          formatDate(
            student.last_login_at
          )
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


      <div
        id="studentDetailMessage"
        style="
          display:none;
          margin-top:20px;
          padding:12px;
          border-radius:7px;
          font-size:12px;
          line-height:1.7;
        ">
      </div>

    </div>


    <footer
      style="
        display:flex;
        flex-wrap:wrap;
        gap:9px;
        padding:20px 28px;
        border-top:1px solid #e5e7eb;
      ">

      <button
        id="studentEditButton"
        type="button"
        class="secondary-button">

        編集

      </button>


      <button
        id="studentPasswordButton"
        type="button"
        class="secondary-button">

        パスワード再設定

      </button>


      <button
        id="studentStatusButton"
        type="button"
        class="${
          student.status ===
          "suspended"
            ? "primary-button"
            : "danger-button"
        }">

        ${
          student.status ===
          "suspended"
            ? "停止解除"
            : "アカウント停止"
        }

      </button>

    </footer>

  `;


  document.body.appendChild(
    overlay
  );


  document.body.style.overflow =
    "hidden";


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
        openStudentEdit(
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
      "studentStatusButton"
    )
    ?.addEventListener(
      "click",
      () =>
        changeStudentStatus(
          student
        )
    );


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

}


function detailRow(
  label,
  value
) {

  return `

    <div
      style="
        display:grid;
        grid-template-columns:130px minmax(0,1fr);
        gap:15px;
        padding:14px 15px;
        border-bottom:1px solid #edf0f2;
      ">

      <div
        style="
          color:#888;
          font-size:11px;
        ">

        ${escapeHtml(
          label
        )}

      </div>


      <div
        style="
          color:#222;
          font-size:13px;
          word-break:break-word;
        ">

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


  element.style.display =
    "block";


  element.style.background =
    isError
      ? "#f9eded"
      : "#eef5ff";


  element.style.color =
    isError
      ? "#9d3030"
      : "#315d87";

}


/* =========================================================
   Edit
   ========================================================= */

function openStudentEdit(
  student
) {

  const panel =
    document.querySelector(
      "#studentDetailOverlay aside"
    );


  if (!panel) {

    return;

  }


  panel.innerHTML = `

    <header
      style="
        display:flex;
        justify-content:space-between;
        padding:28px;
        border-bottom:1px solid #e5e7eb;
      ">

      <h2
        style="
          margin:0;
          font-size:20px;
        ">

        生徒情報を編集

      </h2>


      <button
        id="studentEditClose"
        type="button"
        style="
          width:36px;
          height:36px;
          border:1px solid #ddd;
          border-radius:7px;
          background:#fff;
          font-size:20px;
          cursor:pointer;
        ">

        ×

      </button>

    </header>


    <div
      style="
        padding:28px;
      ">

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


      <div
        id="studentEditMessage"
        style="
          display:none;
          margin-top:15px;
          color:#a12929;
          font-size:12px;
        ">
      </div>

    </div>


    <footer
      style="
        display:flex;
        gap:9px;
        padding:20px 28px;
        border-top:1px solid #e5e7eb;
      ">

      <button
        id="studentEditCancel"
        type="button"
        class="secondary-button">

        キャンセル

      </button>


      <button
        id="studentEditSave"
        type="button"
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
      style="
        display:block;
        margin-bottom:18px;
      ">

      <span
        style="
          display:block;
          margin-bottom:7px;
          color:#555;
          font-size:12px;
          font-weight:600;
        ">

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
        maxlength="254"
        style="
          width:100%;
          height:42px;
          padding:0 12px;
          border:1px solid #d7dbe0;
          border-radius:7px;
          outline:none;
          background:#fff;
          font:inherit;
        ">

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

    errorElement.style.display =
      "block";

    return;

  }


  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(
        email
      )
  ) {

    errorElement.textContent =
      "メールアドレスの形式が正しくありません。";

    errorElement.style.display =
      "block";

    return;

  }


  saveButton.disabled =
    true;


  saveButton.textContent =
    "保存中...";


  try {

    await callStudentFunction({

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

    });


    closeStudentDetail();


    setMessage(
      "生徒情報を更新しました。",
      "success"
    );


    await loadStudents();

  }
  catch (error) {

    console.error(
      "UPDATE ERROR:",
      error
    );


    errorElement.textContent =
      error.message ||
      "更新に失敗しました。";


    errorElement.style.display =
      "block";

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
  student
) {

  const suspended =
    student.status ===
    "suspended";


  const confirmed =
    window.confirm(

      suspended

        ? `${student.display_name || "この生徒"}の停止を解除しますか？`

        : `${student.display_name || "この生徒"}のアカウントを停止しますか？`

    );


  if (!confirmed) {

    return;

  }


  try {

    await callStudentFunction({

      action:
        suspended
          ? "unsuspend_student"
          : "suspend_student",

      student_id:
        student.id

    });


    closeStudentDetail();


    setMessage(

      suspended
        ? "アカウントの停止を解除しました。"
        : "アカウントを停止しました。",

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

}


/* =========================================================
   Password reset
   ========================================================= */

async function resetStudentPassword(
  student
) {

  const confirmed =
    window.confirm(

      `${student.display_name || "この生徒"}のパスワードを再発行しますか？\n\n新しいパスワードはシステムが自動生成します。`

    );


  if (!confirmed) {

    return;

  }


  try {

    const result =
      await callStudentFunction({

        action:
          "reset_student_password",

        student_id:
          student.id

      });


    if (
      !result.temporary_password
    ) {

      throw new Error(
        "一時パスワードが取得できませんでした。"
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


    showDetailMessage(
      error.message ||
      "パスワード再発行に失敗しました。",
      true
    );

  }

}


/* =========================================================
   Temporary password dialog
   ========================================================= */

function showTemporaryPassword(
  password
) {

  document
    .getElementById(
      "temporaryPasswordDialog"
    )
    ?.remove();


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "temporaryPasswordDialog";


  Object.assign(
    overlay.style,
    {

      position:
        "fixed",

      inset:
        "0",

      zIndex:
        "100000",

      display:
        "flex",

      alignItems:
        "center",

      justifyContent:
        "center",

      padding:
        "20px",

      background:
        "rgba(0,0,0,.45)"

    }
  );


  overlay.innerHTML = `

    <div
      style="
        width:min(470px,100%);
        padding:30px;
        border-radius:12px;
        background:#fff;
        box-shadow:0 20px 60px rgba(0,0,0,.25);
      ">


      <div
        style="
          color:#777;
          font-size:11px;
          margin-bottom:7px;
        ">

        パスワード再発行

      </div>


      <h2
        style="
          margin:0;
          font-size:20px;
        ">

        一時パスワードを発行しました

      </h2>


      <p
        style="
          margin:14px 0 20px;
          color:#666;
          font-size:12px;
          line-height:1.8;
        ">

        このパスワードは今回だけ表示されます。<br>
        コピーまたはメモして本人へ伝えてください。

      </p>


      <div
        style="
          display:flex;
          gap:8px;
        ">

        <input
          id="temporaryPasswordValue"
          type="text"
          readonly
          value="${escapeHtml(
            password
          )}"
          style="
            flex:1;
            min-width:0;
            height:46px;
            padding:0 12px;
            border:1px solid #d5d9de;
            border-radius:7px;
            background:#f7f8f9;
            font-family:monospace;
            font-size:16px;
          ">


        <button
          id="copyTemporaryPassword"
          type="button"
          style="
            height:46px;
            padding:0 15px;
            border:0;
            border-radius:7px;
            background:#20252b;
            color:#fff;
            cursor:pointer;
          ">

          コピー

        </button>

      </div>


      <div
        id="temporaryPasswordMessage"
        style="
          min-height:18px;
          margin-top:9px;
          color:#28713e;
          font-size:11px;
        ">
      </div>


      <button
        id="temporaryPasswordClose"
        type="button"
        style="
          width:100%;
          height:44px;
          margin-top:20px;
          border:1px solid #d5d9de;
          border-radius:7px;
          background:#fff;
          cursor:pointer;
        ">

        閉じる

      </button>

    </div>

  `;


  document.body.appendChild(
    overlay
  );


  const input =
    document.getElementById(
      "temporaryPasswordValue"
    );


  const copy =
    document.getElementById(
      "copyTemporaryPassword"
    );


  const copyMessage =
    document.getElementById(
      "temporaryPasswordMessage"
    );


  copy?.addEventListener(
    "click",
    async () => {

      try {

        await navigator.clipboard.writeText(
          password
        );


        copy.textContent =
          "コピーしました";


        copyMessage.textContent =
          "クリップボードにコピーしました。";

      }
      catch {

        input.focus();

        input.select();


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


  input.focus();

  input.select();

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


  createButton.disabled =
    true;


  createButton.textContent =
    "登録中...";


  setMessage(
    "生徒を登録しています。"
  );


  try {

    await callStudentFunction({

      action:
        "create_student",

      display_name:
        displayName,

      student_number:
        studentNumber ||
        null,

      email,

      grade:
        grade ||
        null,

      class_name:
        className ||
        null,

      password

    });


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
    "パスワード変更",
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

        student.must_change_password
          ? "必要"
          : "不要",

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
    `students-${
      new Date()
        .toISOString()
        .slice(
          0,
          10
        )
    }.csv`;


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

  createButton =
    document.getElementById(
      "create"
    );


  const showFormButton =
    document.getElementById(
      "showForm"
    );


  const cancelButton =
    document.getElementById(
      "cancel"
    );


  const logoutButton =
    document.getElementById(
      "logout"
    );


  const clearSearchButton =
    document.getElementById(
      "clearSearch"
    );


  const exportButton =
    document.getElementById(
      "exportCsv"
    );


  const required = [

    [
      formCard,
      "formCard"
    ],

    [
      message,
      "message"
    ],

    [
      studentsElement,
      "students"
    ],

    [
      searchInput,
      "studentSearch"
    ],

    [
      studentCount,
      "studentCount"
    ],

    [
      createButton,
      "create"
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
      logoutButton,
      "logout"
    ]

  ];


  const missing =
    required
      .filter(
        item =>
          !item[0]
      )
      .map(
        item =>
          item[1]
      );


  if (
    missing.length
  ) {

    throw new Error(
      `必要なHTML要素がありません: ${missing.join(", ")}`
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


  exportButton?.addEventListener(
    "click",
    exportStudentsCsv
  );


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key !==
        "Escape"
      ) {

        return;

      }


      document
        .getElementById(
          "temporaryPasswordDialog"
        )
        ?.remove();


      closeStudentDetail();

    }
  );

}


/* =========================================================
   Start
   ========================================================= */

async function start() {

  initializeDom();


  try {

    const admin =
      await withTimeout(
        requireAdmin()
      );


    if (!admin) {

      return;

    }


    await loadStudents();

  }
  catch (error) {

    console.error(
      "STUDENT ADMIN ERROR:",
      error
    );


    studentsElement.innerHTML = `

      <div class="list-row">

        <strong>
          生徒管理を読み込めませんでした。
        </strong>

        <br><br>

        <small>
          ${escapeHtml(
            error?.message ||
            "不明なエラー"
          )}
        </small>

      </div>

    `;

  }

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
    start,
    {
      once:
        true
    }
  );

}
else {

  start();

}
