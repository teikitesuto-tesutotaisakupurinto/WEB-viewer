
import {
  supabase
} from "../../assets/js/supabase.js";


/* =========================================================
   DOM
   ========================================================= */

const newPassword =
  document.getElementById(
    "newPassword"
  );

const confirmPassword =
  document.getElementById(
    "confirmPassword"
  );

const submitButton =
  document.getElementById(
    "submit"
  );

const message =
  document.getElementById(
    "message"
  );


/* =========================================================
   Message
   ========================================================= */

function setMessage(
  text,
  type = ""
) {

  message.textContent =
    text;


  message.className =
    `message ${type}`;

}


/* =========================================================
   Current student
   ========================================================= */

async function getCurrentStudent() {

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


  if (
    !session?.user?.id
  ) {

    throw new Error(
      "ログインしてください。"
    );

  }


  const {
    data:
      student,
    error:
      studentError
  } =
    await supabase
      .from("users")
      .select(`
        id,
        role,
        status,
        must_change_password
      `)
      .eq(
        "id",
        session.user.id
      )
      .maybeSingle();


  if (studentError) {

    throw studentError;

  }


  if (
    !student ||
    student.role !==
      "student"
  ) {

    throw new Error(
      "生徒アカウントを確認できません。"
    );

  }


  /*
   * 停止中ならここでも拒否。
   *
   * 停止モーダル自体は
   * 共通ログイン画面で表示する。
   */

  if (
    student.status ===
    "suspended"
  ) {

    await supabase.auth
      .signOut({
        scope:
          "local"
      });


    throw new Error(
      "アカウントが停止中です。管理者に問い合わせてください。"
    );

  }


  return {

    session,

    student

  };

}


/* =========================================================
   Password validation
   ========================================================= */

function validatePassword(
  password,
  confirmation
) {

  if (
    password.length <
    8
  ) {

    return "パスワードは8文字以上にしてください。";

  }


  if (
    password.length >
    128
  ) {

    return "パスワードは128文字以内にしてください。";

  }


  if (
    password !==
    confirmation
  ) {

    return "パスワードが一致していません。";

  }


  return "";

}


/* =========================================================
   Change password
   ========================================================= */

async function changePassword() {

  if (
    submitButton.disabled
  ) {

    return;

  }


  const password =
    newPassword.value;


  const confirmation =
    confirmPassword.value;


  const validation =
    validatePassword(
      password,
      confirmation
    );


  if (validation) {

    setMessage(
      validation,
      "error"
    );

    return;

  }


  submitButton.disabled =
    true;


  submitButton.textContent =
    "変更しています...";


  setMessage(
    ""
  );


  try {

    const {
      student
    } =
      await getCurrentStudent();


    /*
     * Supabase Authのパスワード変更。
     */

    const {
      error:
        passwordError
    } =
      await supabase.auth
        .updateUser({

          password

        });


    if (passwordError) {

      throw new Error(
        passwordError.message ||
        "パスワードを変更できませんでした。"
      );

    }


    /*
     * Auth変更成功後に
     * must_change_passwordを解除。
     */

    const {
      error:
        flagError
    } =
      await supabase
        .from("users")
        .update({

          must_change_password:
            false,

          updated_at:
            new Date()
              .toISOString()

        })
        .eq(
          "id",
          student.id
        )
        .eq(
          "role",
          "student"
        );


    if (flagError) {

      throw new Error(
        "パスワード変更状態を更新できませんでした。"
      );

    }


    newPassword.value =
      "";

    confirmPassword.value =
      "";


    setMessage(
      "パスワードを変更しました。移動しています。",
      "success"
    );


    /*
     * returnがあれば元の場所へ。
     */

    const params =
      new URLSearchParams(
        window.location.search
      );


    const returnUrl =
      params.get(
        "return"
      );


    const book =
      params.get(
        "book"
      );


    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          700
        )
    );


    if (
      returnUrl
    ) {

      /*
       * 外部URLへの遷移を防ぐ。
       */

      if (
        returnUrl.startsWith(
          "/"
        )
      ) {

        window.location.replace(
          returnUrl
        );

        return;

      }

    }


    if (
      book
    ) {

      window.location.replace(

        `/student/viewer/?book=${
          encodeURIComponent(
            book
          )
        }`

      );

      return;

    }


    window.location.replace(
      "/student/books/"
    );

  }
  catch (error) {

    console.error(
      "PASSWORD CHANGE ERROR:",
      error
    );


    setMessage(
      error?.message ||
      "パスワードを変更できませんでした。",
      "error"
    );

  }
  finally {

    submitButton.disabled =
      false;

    submitButton.textContent =
      "パスワードを変更する";

  }

}


/* =========================================================
   Events
   ========================================================= */

submitButton?.addEventListener(
  "click",
  changePassword
);


[
  newPassword,
  confirmPassword
]
  .forEach(
    input => {

      input?.addEventListener(
        "keydown",
        event => {

          if (
            event.key ===
            "Enter"
          ) {

            event.preventDefault();

            changePassword();

          }

        }
      );

    }
  );


/* =========================================================
   Initial guard
   ========================================================= */

(async () => {

  try {

    const {
      student
    } =
      await getCurrentStudent();


    /*
     * 変更不要なユーザーが
     * 直接このURLを開いた場合は戻す。
     */

    if (
      !student.must_change_password
    ) {

      const params =
        new URLSearchParams(
          window.location.search
        );


      const returnUrl =
        params.get(
          "return"
        );


      const book =
        params.get(
          "book"
        );


      if (
        returnUrl &&
        returnUrl.startsWith(
          "/"
        )
      ) {

        window.location.replace(
          returnUrl
        );

        return;

      }


      if (
        book
      ) {

        window.location.replace(

          `/student/viewer/?book=${
            encodeURIComponent(
              book
            )
          }`

        );

        return;

      }


      window.location.replace(
        "/student/books/"
      );

    }

  }
  catch (error) {

    setMessage(
      error?.message ||
      "ログイン状態を確認できません。",
      "error"
    );

  }

})();
