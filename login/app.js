import { supabase }
from "../assets/js/supabase.js";


const VERSION =
  "20261109-02";


console.log(
  "WEB-viewer login loaded:",
  VERSION
);


const form =
  document.getElementById(
    "loginForm"
  );

const message =
  document.getElementById(
    "message"
  );

const button =
  document.getElementById(
    "loginButton"
  );

const version =
  document.getElementById(
    "version"
  );


version.textContent =
  "WEB-viewer";


/*
 * ログイン
 */

form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    message.textContent = "";

    message.style.color =
      "#b00020";

    button.disabled = true;


    const email =
      document
        .getElementById("email")
        .value
        .trim();


    const password =
      document
        .getElementById("password")
        .value;


    if (
      !email ||
      !password
    ) {

      message.textContent =
        "メールアドレスとパスワードを入力してください。";

      button.disabled = false;

      return;
    }


    /*
     * Supabase Auth
     */

    const {
      data: loginData,
      error: loginError
    } =
      await supabase.auth
        .signInWithPassword({
          email,
          password
        });


    if (loginError) {

      console.error(
        "LOGIN ERROR:",
        loginError
      );


      message.textContent =
        "ログインできませんでした。";


      button.disabled = false;

      return;
    }


    const user =
      loginData?.user;


    if (!user) {

      console.error(
        "USER NOT FOUND"
      );


      message.textContent =
        "ログインユーザーを取得できませんでした。";


      button.disabled = false;

      return;
    }


    console.log(
      "LOGIN UID:",
      user.id
    );


    /*
     * users取得
     */

    const {
      data: profile,
      error: profileError
    } =
      await supabase
        .from("users")
        .select(
          "id, display_name, role"
        )
        .eq(
          "id",
          user.id
        )
        .maybeSingle();


    console.log(
      "PROFILE:",
      profile
    );


    console.log(
      "PROFILE ERROR:",
      profileError
    );


    /*
     * users取得エラー
     */

    if (profileError) {

      message.textContent =
        "Supabaseエラー: " +
        profileError.message;


      button.disabled = false;

      return;
    }


    /*
     * usersに存在しない
     */

    if (!profile) {

      message.textContent =
        "ユーザー情報が登録されていません。";


      button.disabled = false;

      return;
    }


    /*
     * Admin
     */

    if (
      profile.role === "admin"
    ) {

      location.replace(
        "../admin/"
      );

      return;
    }


    /*
     * Student
     */

    if (
      profile.role === "student"
    ) {

      location.replace(
        "../student/"
      );

      return;
    }


    /*
     * 不明な権限
     */

    message.textContent =
      "ユーザー権限が設定されていません。";


    button.disabled = false;

  }
);
