
import {
  supabase
} from "../assets/js/supabase.js";


/* =========================================================
   DOM
   ========================================================= */

const form =
  document.getElementById(
    "loginForm"
  );

const button =
  document.getElementById(
    "loginButton"
  );

const emailInput =
  document.getElementById(
    "email"
  );

const passwordInput =
  document.getElementById(
    "password"
  );

const message =
  document.getElementById(
    "message"
  );


/* =========================================================
   Message
   ========================================================= */

function setMessage(
  text
) {

  if (!message) {
    return;
  }


  message.textContent =
    text;

}


/* =========================================================
   Profile
   ========================================================= */

async function getProfile(
  userId
) {

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
        status,
        must_change_password
      `)
      .eq(
        "id",
        userId
      )
      .maybeSingle();


  if (error) {

    console.error(
      "PROFILE ERROR:",
      error
    );


    throw new Error(
      "ユーザー情報を取得できませんでした。"
    );

  }


  if (!data) {

    throw new Error(
      "このアカウントは登録されていません。"
    );

  }


  return data;

}


/* =========================================================
   Maintenance
   ========================================================= */

async function getMaintenance() {

  const {
    data,
    error
  } =
    await supabase
      .from("maintenance_settings")
      .select(
        "enabled,message"
      )
      .eq(
        "id",
        1
      )
      .maybeSingle();


  if (error) {

    throw new Error(
      "システム状態を確認できませんでした。"
    );

  }


  return {

    enabled:
      Boolean(
        data?.enabled
      ),

    message:
      data?.message ||
      ""

  };

}


/* =========================================================
   Suspended modal
   ========================================================= */

function showSuspendedModal() {

  document
    .getElementById(
      "accountSuspendedModal"
    )
    ?.remove();


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "accountSuspendedModal";


  overlay.className =
    "account-suspended-overlay";


  overlay.innerHTML = `

    <div
      class="account-suspended-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="accountSuspendedTitle">


      <div
        class="account-suspended-icon">

        !

      </div>


      <h2
        id="accountSuspendedTitle">

        アカウントが停止中です

      </h2>


      <p>

        アカウントが停止中です。<br>
        管理者に問い合わせてください。

      </p>


      <button
        id="accountSuspendedClose"
        type="button">

        閉じる

      </button>


    </div>

  `;


  document.body.appendChild(
    overlay
  );


  const close =
    document.getElementById(
      "accountSuspendedClose"
    );


  close?.addEventListener(
    "click",
    () => {

      overlay.remove();

      emailInput?.focus();

    }
  );


  /*
   * ESCで閉じる。
   */

  function onKeyDown(
    event
  ) {

    if (
      event.key !==
      "Escape"
    ) {

      return;

    }


    overlay.remove();

    document.removeEventListener(
      "keydown",
      onKeyDown
    );

    emailInput?.focus();

  }


  document.addEventListener(
    "keydown",
    onKeyDown
  );

}


/* =========================================================
   Redirect
   ========================================================= */

function redirectAfterLogin(
  profile,
  maintenance
) {

  /*
   * 一時パスワード後の強制変更。
   *
   * roleより先に確認する。
   */

  if (
    profile.must_change_password ===
    true
  ) {

    window.location.replace(
      "/student/password-reset/"
    );

    return;

  }


  /*
   * Admin
   */

  if (
    profile.role ===
    "admin"
  ) {

    window.location.replace(

      maintenance.enabled
        ? "/admin/?maintenance=1"
        : "/admin/"

    );

    return;

  }


  /*
   * Student
   */

  if (
    profile.role ===
    "student"
  ) {

    window.location.replace(

      maintenance.enabled
        ? "/student/?maintenance=1"
        : "/student/books/"

    );

    return;

  }


  throw new Error(
    "アカウントの権限を確認できません。"
  );

}


/* =========================================================
   Login
   ========================================================= */

async function login() {

  if (
    button.disabled
  ) {

    return;

  }


  const email =
    emailInput.value
      .trim()
      .toLowerCase();


  const password =
    passwordInput.value;


  if (!email) {

    setMessage(
      "メールアドレスを入力してください。"
    );


    emailInput.focus();

    return;

  }


  if (!password) {

    setMessage(
      "パスワードを入力してください。"
    );


    passwordInput.focus();

    return;

  }


  button.disabled =
    true;


  button.textContent =
    "ログイン中...";


  setMessage(
    ""
  );


  try {

    /*
     * Authログイン。
     */

    const {
      data,
      error
    } =
      await supabase.auth
        .signInWithPassword({

          email,

          password

        });


    if (
      error ||
      !data?.user
    ) {

      throw new Error(
        "メールアドレスまたはパスワードが正しくありません。"
      );

    }


    /*
     * usersを取得。
     */

    const profile =
      await getProfile(
        data.user.id
      );


    /*
     * 停止中なら、
     * セッションを破棄して
     * ログイン画面に中央モーダル。
     */

    if (
      profile.status ===
      "suspended"
    ) {

      await supabase.auth
        .signOut({
          scope:
            "local"
        });


      passwordInput.value =
        "";


      showSuspendedModal();


      return;

    }


    /*
     * メンテナンス状態。
     */

    const maintenance =
      await getMaintenance();


    /*
     * 通常遷移。
     */

    redirectAfterLogin(
      profile,
      maintenance
    );

  }
  catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );


    /*
     * DB確認などで失敗した場合、
     * ログインセッションを残さない。
     */

    try {

      await supabase.auth
        .signOut({
          scope:
            "local"
        });

    }
    catch {}


    setMessage(
      error?.message ||
      "ログインに失敗しました。"
    );

  }
  finally {

    button.disabled =
      false;


    button.textContent =
      "ログイン";

  }

}


/* =========================================================
   Existing session
   ========================================================= */

async function checkExistingSession() {

  try {

    const {
      data,
      error
    } =
      await supabase.auth
        .getSession();


    if (error) {

      return;

    }


    const session =
      data?.session;


    if (
      !session?.user?.id
    ) {

      return;

    }


    const profile =
      await getProfile(
        session.user.id
      );


    /*
     * 既存セッションでも
     * 停止状態を確認。
     */

    if (
      profile.status ===
      "suspended"
    ) {

      await supabase.auth
        .signOut({
          scope:
            "local"
        });


      showSuspendedModal();


      return;

    }


    const maintenance =
      await getMaintenance();


    redirectAfterLogin(
      profile,
      maintenance
    );

  }
  catch (error) {

    console.warn(
      "EXISTING SESSION ERROR:",
      error
    );

  }

}


/* =========================================================
   Events
   ========================================================= */

form?.addEventListener(
  "submit",
  event => {

    event.preventDefault();

    login();

  }
);


emailInput?.addEventListener(
  "keydown",
  event => {

    if (
      event.key ===
      "Enter"
    ) {

      event.preventDefault();

      passwordInput?.focus();

    }

  }
);


passwordInput?.addEventListener(
  "keydown",
  event => {

    if (
      event.key ===
      "Enter"
    ) {

      event.preventDefault();

      login();

    }

  }
);


/* =========================================================
   Boot
   ========================================================= */

checkExistingSession();
