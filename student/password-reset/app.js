
import {
  supabase
} from "../../assets/js/supabase.js";


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


function setMessage(
  text,
  type = ""
) {

  message.textContent =
    text;

  message.className =
    `message ${type}`;

}


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


  if (!session?.user?.id) {

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


  if (
    student.status ===
    "suspended"
  ) {

    await supabase.auth.signOut();

    throw new Error(
      "アカウントが停止中です。"
    );

  }


  return {
    session,
    student
  };

}


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
    password !==
    confirmation
  ) {

    setMessage(
      "パスワードが一致していません。",
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
      session,
      student
    } =
      await getCurrentStudent();


    /*
     * Authのパスワードを変更。
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
      throw passwordError;
    }


    /*
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

      throw flagError;

    }


    /*
     * 完了。
     */

    newPassword.value =
      "";

    confirmPassword.value =
      "";


    setMessage(
      "パスワードを変更しました。教材画面へ移動します。",
      "success"
    );


    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          900
        )
    );


    /*
     * bookがある場合は元の教材へ戻す。
     */

    const params =
      new URLSearchParams(
        window.location.search
      );


    const book =
      params.get(
        "book"
      );


    if (book) {

      window.location.replace(
        `/student/viewer/?book=${encodeURIComponent(
          book
        )}`
      );

    }
    else {

      window.location.replace(
        "/student/"
      );

    }

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


submitButton.addEventListener(
  "click",
  changePassword
);


[
  newPassword,
  confirmPassword
]
  .forEach(
    input => {

      input.addEventListener(
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


/*
 * 初期確認。
 */

(async () => {

  try {

    const {
      student
    } =
      await getCurrentStudent();


    if (
      !student.must_change_password
    ) {

      const params =
        new URLSearchParams(
          window.location.search
        );


      const book =
        params.get(
          "book"
        );


      if (book) {

        window.location.replace(
          `/student/viewer/?book=${encodeURIComponent(
            book
          )}`
        );

      }

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
