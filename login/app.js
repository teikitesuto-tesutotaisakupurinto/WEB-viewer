import { supabase }
from "../assets/js/supabase.js";


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


/*
 * app.js読み込み確認
 */

console.log(
  "WEB-viewer login/app.js loaded"
);


/*
 * ログインフォーム
 */

form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    message.textContent = "";

    message.style.color =
      "#222";


    button.disabled = true;


    /*
     * 入力値
     */

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


    /*
     * ログインエラー
     */

    if (loginError) {

      console.error(
        "Login error:",
        loginError
      );


      message.style.color =
        "#b00020";


      message.textContent =
        "ログインできませんでした。";


      button.disabled = false;

      return;
    }


    /*
     * ユーザー確認
     */

    const user =
      loginData?.user;


    if (!user) {

      message.style.color =
        "#b00020";


      message.textContent =
        "ログインユーザーを取得できませんでした。";


      button.disabled = false;

      return;
    }


    console.log(
      "Logged in UID:",
      user.id
    );


    /*
     * usersテーブルからプロフィール取得
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


    /*
     * プロフィール取得エラー
     */

    if (profileError) {

      console.error(
        "Profile error:",
        profileError
      );


      message.style.color =
        "#b00020";


      message.textContent =
        "ユーザー情報の取得に失敗しました。";


      button.disabled = false;

      return;
    }


    /*
     * usersに存在しない
     */

    if (!profile) {

      console.error(
        "Profile not found:",
        user.id
      );


      message.style.color =
        "#b00020";


      message.textContent =
        "ユーザー情報が登録されていません。";


      button.disabled = false;

      return;
    }


    console.log(
      "Profile:",
      profile
    );


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

    message.style.color =
      "#b00020";


    message.textContent =
      "ユーザー権限が設定されていません。";


    button.disabled = false;

  }
);
