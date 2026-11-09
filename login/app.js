
import {
  supabase
}
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
 * ログインフォーム確認
 */

if (!form) {

  throw new Error(
    "loginFormが見つかりません。"
  );

}


form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    button.disabled =
      true;


    message.textContent =
      "";


    /*
     * 入力値
     */

    const email =
      document
        .getElementById(
          "email"
        )
        .value
        .trim()
        .toLowerCase();


    const password =
      document
        .getElementById(
          "password"
        )
        .value;


    if (
      !email ||
      !password
    ) {

      message.textContent =
        "メールアドレスとパスワードを入力してください。";

      button.disabled =
        false;

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
        "メールアドレスまたはパスワードが正しくありません。";


      button.disabled =
        false;

      return;

    }


    /*
     * Authユーザー確認
     */

    const user =
      loginData?.user;


    if (!user) {

      message.textContent =
        "ログインユーザーを取得できませんでした。";


      button.disabled =
        false;

      return;

    }


    console.log(
      "LOGIN UID:",
      user.id
    );


    /*
     * usersプロフィール取得
     *
     * クラス・学籍番号は使用しない
     */

    const {
      data: profile,
      error: profileError
    } =
      await supabase.rpc(
        "get_current_profile"
      );


    console.log(
      "PROFILE:",
      profile
    );


    console.log(
      "PROFILE ERROR:",
      profileError
    );


    /*
     * RPCエラー
     */

    if (profileError) {

      message.textContent =
        "プロフィール取得エラー: " +
        profileError.message;


      button.disabled =
        false;

      return;

    }


    /*
     * usersに登録されていない
     */

    if (!profile) {

      message.textContent =
        "ユーザー情報が登録されていません。";


      button.disabled =
        false;

      return;

    }


    /*
     * Admin
     */

    if (
      profile.role ===
      "admin"
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
      profile.role ===
      "student"
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


    button.disabled =
      false;

  }
);
