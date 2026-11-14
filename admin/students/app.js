
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

async function getAccessToken() {

  const {
    data,
    error
  } =
    await withTimeout(
      supabase.auth.getSession()
    );


  if (error) {

    throw new Error(
      "ログイン状態を確認できませんでした。"
    );

  }


  const token =
    data?.session?.access_token;


  if (!token) {

    throw new Error(
      "管理者のログインセッションがありません。"
    );

  }


  return token;

}


/* =========================================================
   Edge Function
   ========================================================= */

/*
 * 重要:
 *
 * fetch("https://.../functions/v1/...")
 * は使わない。
 *
 * supabase.functions.invoke()を使うことで
 * Supabaseクライアントが認証ヘッダーを
 * 付けてくれる。
 */

async function callStudentFunction(
  payload
) {

  /*
   * セッションがない場合は
   * invokeする前に明示的にエラー。
   */

  await getAccessToken();


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
      "FUNCTION INVOKE ERROR:",
      error
    );


    throw new Error(
      "サーバーに接続できませんでした。Edge Functionのデプロイ状態を確認してください。"
    );

  }


  const {
    data,
    error
  } =
    result;


  if (error) {

    console.error(
      "FUNCTION ERROR:",
      error
    );


    /*
     * FunctionsHttpErrorの場合、
     * response bodyを取得できる場合がある。
     */

    let serverMessage =
      "";


    try {

      const context =
        error.context;


      if (
        context &&
        typeof context.json ===
          "function"
      ) {

        const body =
          await context.json();


        serverMessage =
          body?.error ||
          body?.message ||
          "";

      }

    }
    catch {}


    throw new Error(

      serverMessage ||
      error.message ||
      "サーバー処理に失敗しました。"

    );

  }


  if (
    !data
  ) {

    throw new Error(
      "サーバーから応答がありませんでした。"
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

  if (!studentsElement) {

    throw new Error(
      "生徒一覧表示領域が見つかりません。"
    );

  }


  studentsElement.setAttribute(
    "aria-busy",
    "true"
  );


  studentsElement.innerHTML = `

    <div class="list-row">

      生徒を読み込んでいます。

    </div>

  `;


  try {

    /*
     * 管理者セッション確認。
     */

    await getAccessToken();


    /*
     * usersはRLSで管理者だけ取得可能。
     */

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
        error.message ||
        "生徒一覧を取得できませんでした。"
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
            "不明なエラーが発生しました。"
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

  if (!studentsElement) {

    return;

  }


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


              <div
                class="student-row-status">

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
   * イベント委譲。
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


      event.preventDefault();


      event.stopPropagation();


      const id =
        button.getAttribute(
          "data-student-detail"
        );


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


  panel.id =
    "studentDetailPanel";


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

      maxWidth:
        "100vw",

      overflowY:
        "auto",

      background:
        "#fff",

      color:
        "#222",

      boxShadow:
        "-12px 0 35px rgba(0,0,0,.15)",

      fontFamily:
        '-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP","Yu Gothic",Meiryo,sans-serif'

    }
  );


  /* -------------------------------------------------------
     Header
     ------------------------------------------------------- */

  const header =
    document.createElement(
      "header"
    );


  Object.assign(
    header.style,
    {

      display:
        "flex",

      alignItems:
        "flex-start",

      justifyContent:
        "space-between",

      gap:
        "20px",

      padding:
        "28px",

      borderBottom:
        "1px solid #e5e7eb"

    }
  );


  header.innerHTML = `

    <div>

      <div
        style="
          color:#888;
          font-size:11px;
          margin-bottom:7px;
        ">

        生徒詳細

      </div>


      <div
        style="
          font-size:21px;
          font-weight:650;
        ">

        ${escapeHtml(
          student.display_name ||
          "名前未設定"
        )}

      </div>

    </div>

  `;


  const closeButton =
    document.createElement(
      "button"
    );


  closeButton.type =
    "button";


  closeButton.textContent =
    "×";


  closeButton.setAttribute(
    "aria-label",
    "閉じる"
  );


  Object.assign(
    closeButton.style,
    {

      width:
        "36px",

      height:
        "36px",

      flexShrink:
        "0",

      border:
        "1px solid #ddd",

      borderRadius:
        "7px",

      background:
        "#fff",

      color:
        "#555",

      fontSize:
        "22px",

      cursor:
        "pointer"

    }
  );


  closeButton.addEventListener(
    "click",
    closeStudentDetail
  );


  header.appendChild(
    closeButton
  );


  /* -------------------------------------------------------
     Body
     ------------------------------------------------------- */

  const body =
    document.createElement(
      "div"
    );


  Object.assign(
    body.style,
    {

      padding:
        "28px"

    }
  );


  body.innerHTML = `

    <section
      style="
        margin-bottom:30px;
      ">

      <h3
        style="
          margin:0 0 14px;
          color:#555;
          font-size:13px;
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

    </section>


    <section>

      <h3
        style="
          margin:0 0 14px;
          color:#555;
          font-size:13px;
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

        ${
          student.suspended_at
            ? detailRow(
                "停止日時",
                formatDate(
                  student.suspended_at
                )
              )
            : ""
        }

      </div>

    </section>


    <div
      id="studentDetailMessage"
      style="
        display:none;
        margin-top:20px;
        padding:12px 14px;
        border-radius:7px;
        background:#eef5ff;
        color:#315d87;
        font-size:12px;
        line-height:1.7;
      ">
    </div>

  `;


  /* -------------------------------------------------------
     Footer
     ------------------------------------------------------- */

  const footer =
    document.createElement(
      "footer"
    );


  Object.assign(
    footer.style,
    {

      display:
        "flex",

      flexWrap:
        "wrap",

      gap:
        "9px",

      padding:
        "20px 28px",

      borderTop:
        "1px solid #e5e7eb",

      background:
        "#fff"

    }
  );


  const editButton =
    createActionButton(
      "編集"
    );


  const passwordButton =
    createActionButton(
      "パスワード再設定"
    );


  const statusButton =
    createActionButton(

      student.status ===
        "suspended"
        ? "停止解除"
        : "アカウント停止",

      student.status !==
        "suspended"

    );


  editButton.addEventListener(
    "click",
    () =>
      openStudentEdit(
        student
      )
  );


  passwordButton.addEventListener(
    "click",
    () =>
      resetStudentPassword(
        student
      )
  );


  statusButton.addEventListener(
    "click",
    () =>
      changeStudentStatus(
        student
      )
  );


  footer.appendChild(
    editButton
  );


  footer.appendChild(
    passwordButton
  );


  footer.appendChild(
    statusButton
  );


  panel.appendChild(
    header
  );


  panel.appendChild(
    body
  );


  panel.appendChild(
    footer
  );


  overlay.appendChild(
    panel
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


  document.body.appendChild(
    overlay
  );


  document.body.style.overflow =
    "hidden";

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


function createActionButton(
  text,
  danger = false
) {

  const button =
    document.createElement(
      "button"
    );


  button.type =
    "button";


  button.textContent =
    text;


  Object.assign(
    button.style,
    {

      minHeight:
        "40px",

      padding:
        "0 16px",

      borderRadius:
        "7px",

      border:
        danger
          ? "1px solid #c73535"
          : "1px solid #d7dbe0",

      background:
        danger
          ? "#c73535"
          : "#fff",

      color:
        danger
          ? "#fff"
          : "#444",

      cursor:
        "pointer",

      fontSize:
        "13px",

      fontWeight:
        "600"

    }
  );


  return button;

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


  element.style.display =
    "block";


  element.style.background =
    error
      ? "#f9eded"
      : "#eef5ff";


  element.style.color =
    error
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
    document.getElementById(
      "studentDetailPanel"
    );


  if (!panel) {

    return;

  }


  panel.innerHTML = `

    <header
      style="
        display:flex;
        align-items:center;
        justify-content:space-between;
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

          生徒情報編集

        </div>


        <div
          style="
            font-size:21px;
            font-weight:650;
          ">

          ${escapeHtml(
            student.display_name ||
            "名前未設定"
          )}

        </div>

      </div>


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

      ${editInput(
        "氏名",
        "editDisplayName",
        student.display_name
      )}


      ${editInput(
        "生徒番号",
        "editStudentNumber",
        student.student_number
      )}


      ${editInput(
        "メールアドレス",
        "editEmail",
        student.email,
        "email"
      )}


      ${editInput(
        "学年",
        "editGrade",
        student.grade
      )}


      ${editInput(
        "クラス",
        "editClassName",
        student.class_name
      )}


      <div
        id="studentEditMessage"
        style="
          display:none;
          margin-top:15px;
          color:#9d3030;
          font-size:12px;
          line-height:1.7;
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
        style="
          min-height:40px;
          padding:0 16px;
          border:1px solid #d7dbe0;
          border-radius:7px;
          background:#fff;
          cursor:pointer;
        ">

        キャンセル

      </button>


      <button
        id="studentEditSave"
        type="button"
        style="
          min-height:40px;
          padding:0 16px;
          border:0;
          border-radius:7px;
          background:#20252b;
          color:#fff;
          cursor:pointer;
        ">

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


function editInput(
  label,
  id,
  value,
  type = "text"
) {

  return `

    <label
      style="
        display:block;
        margin-bottom:19px;
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
          color:#222;
          font:inherit;
        ">

    </label>

  `;

}


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
      "UPDATE STUDENT ERROR:",
      error
    );


    errorElement.textContent =
      error.message ||
      "生徒情報の更新に失敗しました。";


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


  const action =
    suspended
      ? "unsuspend_student"
      : "suspend_student";


  const question =
    suspended

      ? `${student.display_name || "この生徒"}の停止を解除しますか？`

      : `${student.display_name || "この生徒"}のアカウントを停止しますか？`;


  if (
    !window.confirm(
      question
    )
  ) {

    return;

  }


  try {

    await callStudentFunction({

      action,

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

      `${student.display_name || "この生徒"}のパスワードを再発行しますか？\n\n新しい一時パスワードをシステムが自動生成します。\n発行後はこの画面で一度だけ表示されます。`

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


    const password =
      result.temporary_password;


    if (!password) {

      throw new Error(
        "一時パスワードを取得できませんでした。"
      );

    }


    showTemporaryPassword(
      password
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
   Temporary password
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
          color:#222;
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
        コピーまたはメモして本人へ伝えてください。<br>
        次回ログイン時に新しいパスワードへ変更します。

      </p>


      <div
        style="
          display:flex;
          gap:8px;
          align-items:center;
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
            color:#111;
            font-family:monospace;
            font-size:16px;
            letter-spacing:.04em;
          ">


        <button
          id="copyTemporaryPassword"
          type="button"
          style="
            height:46px;
            padding:0 15px;
            border:1px solid #20252b;
            border-radius:7px;
            background:#20252b;
            color:#fff;
            cursor:pointer;
            white-space:nowrap;
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
          color:#333;
          cursor:pointer;
          font:inherit;
        ">

        閉じる

      </button>

    </div>

  `;


  document.body.appendChild(
    overlay
  );


  const passwordInput =
    document.getElementById(
      "temporaryPasswordValue"
    );


  const copyButton =
    document.getElementById(
      "copyTemporaryPassword"
    );


  const copyMessage =
    document.getElementById(
      "temporaryPasswordMessage"
    );


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

        passwordInput?.focus();

        passwordInput?.select();


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


  /*
   * 自動選択。
   */

  passwordInput?.focus();

  passwordInput?.select();

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
        error?.message ||
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


  const missing = [];


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

  ]
    .forEach(
      pair => {

        if (!pair[0]) {

          missing.push(
            pair[1]
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


  /*
   * Escape
   */

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key !==
        "Escape"
      ) {

        return;

      }


      const passwordDialog =
        document.getElementById(
          "temporaryPasswordDialog"
        );


      if (
        passwordDialog
      ) {

        passwordDialog.remove();

        return;

      }


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
      "STUDENT ADMIN START ERROR:",
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
            "不明なエラーが発生しました。"
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
