
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


function getSession() {

  return withTimeout(
    supabase.auth.getSession()
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

    const {
      data:
        sessionData,
      error:
        sessionError
    } =
      await getSession();


    if (sessionError) {

      throw new Error(
        `セッション取得エラー: ${
          sessionError.message
        }`
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
          error.message ||
          error.code ||
          "Unknown error"
        }`
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
   Render list
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
   * 重要。
   *
   * 一覧全体に1つだけclickを登録。
   * innerHTMLで一覧を更新しても、
   * このイベント自体は残る。
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


  /*
   * CSSに依存しない基本スタイル。
   */

  Object.assign(
    overlay.style,
    {

      position:
        "fixed",

      inset:
        "0",

      zIndex:
        "99999",

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
        "min(520px, 100vw)",

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
        '-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP","Yu Gothic",sans-serif'

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


  const heading =
    document.createElement(
      "div"
    );


  heading.innerHTML = `

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

      lineHeight:
        "1",

      cursor:
        "pointer"

    }
  );


  closeButton.addEventListener(
    "click",
    closeStudentDetail
  );


  header.appendChild(
    heading
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
        padding:11px 13px;
        border-radius:7px;
        background:#eef5ff;
        color:#315d87;
        font-size:12px;
        line-height:1.6;
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
        student,
        student.status ===
          "suspended"
          ? "active"
          : "suspended"
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


  /*
   * 背景部分クリックで閉じる。
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

  const overlay =
    document.getElementById(
      "studentDetailOverlay"
    );


  const panel =
    document.getElementById(
      "studentDetailPanel"
    );


  if (
    !overlay ||
    !panel
  ) {

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

      <div
        style="
          font-size:20px;
          font-weight:650;
        ">

        生徒情報を編集

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
          border:1px solid #20252b;
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
      .test(email)
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

    const {
      data:
        sessionData,
      error:
        sessionError
    } =
      await getSession();


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


    const result =
      parseResponse(
        text
      );


    if (
      !response.ok ||
      result.success !==
        true
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
    document.querySelector(
      suspend
        ? "#studentDetailPanel button"
        : "#studentDetailPanel button"
    );


  try {

    const {
      data:
        sessionData,
      error:
        sessionError
    } =
      await getSession();


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


    const result =
      parseResponse(
        text
      );


    if (
      !response.ok ||
      result.success !==
        true
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

}


/* =========================================================
   Password
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
      await getSession();


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


    const result =
      parseResponse(
        text
      );


    if (
      !response.ok ||
      result.success !==
        true
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
   Response
   ========================================================= */

function parseResponse(
  text
) {

  if (!text) {
    return {};
  }


  try {

    return JSON.parse(
      text
    );

  }
  catch {

    return {
      error:
        text
    };

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
      await getSession();


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


    const result =
      parseResponse(
        text
      );


    if (
      !response.ok ||
      result.success !==
        true
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
            error?.message ||
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
              "STUDENT ADMIN FATAL:",
              error
            );


            if (
              studentsElement
            ) {

              studentsElement.innerHTML = `
                <div class="list-row">

                  生徒管理を読み込めませんでした。

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


        if (
          studentsElement
        ) {

          studentsElement.innerHTML = `
            <div class="list-row">

              生徒管理を読み込めませんでした。

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
    );

}
