
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


form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    button.disabled = true;

    message.textContent = "";


    try {

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

        throw new Error(
          "メールアドレスとパスワードを入力してください。"
        );

      }


      /*
       * Authログイン
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


      if (error) {
        throw new Error(
          "メールアドレスまたはパスワードが正しくありません。"
        );
      }


      if (!data?.user) {

        throw new Error(
          "ログインユーザーを取得できませんでした。"
        );

      }


      /*
       * usersを直接取得
       */

      const {
        data: profile,
        error: profileError
      } =
        await supabase
          .from("users")
          .select(
            "id,display_name,role"
          )
          .eq(
            "id",
            data.user.id
          )
          .maybeSingle();


      if (profileError) {

        throw new Error(
          "ユーザー情報取得エラー: " +
          profileError.message
        );

      }


      if (!profile) {

        throw new Error(
          "このログインアカウントはusersに登録されていません。"
        );

      }


      /*
       * Admin
       *
       * メンテナンス中でも入れる
       */

      if (
        profile.role ===
        "admin"
      ) {

        window.location.replace(
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

        window.location.replace(
          "../student/"
        );

        return;

      }


      throw new Error(
        "ユーザー権限が設定されていません。"
      );

    }
    catch (error) {

      console.error(
        "LOGIN ERROR:",
        error
      );


      message.textContent =
        error.message ||
        "ログインに失敗しました。";


      button.disabled =
        false;

    }

  }
);
