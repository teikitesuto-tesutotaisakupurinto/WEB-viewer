import {
  supabase
} from "../assets/js/supabase.js";


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


/* =========================================================
   メンテナンス状態
   ========================================================= */

async function getMaintenance() {

  const {
    data,
    error
  } =
    await supabase
      .from(
        "maintenance_settings"
      )
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
      data?.message || ""
  };

}


/* =========================================================
   プロフィール
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
      .select(
        "id,display_name,role"
      )
      .eq(
        "id",
        userId
      )
      .maybeSingle();


  if (error) {

    throw new Error(
      "ユーザー情報を取得できませんでした。"
    );

  }


  if (!data) {

    throw new Error(
      "このアカウントは利用登録されていません。"
    );

  }


  return data;

}


/* =========================================================
   ログイン
   ========================================================= */

form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    if (
      button.disabled
    ) {

      return;

    }


    button.disabled =
      true;


    message.textContent =
      "";


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
       * Auth
       */

      const {
        data:
          authData,
        error:
          authError
      } =
        await supabase.auth
          .signInWithPassword({

            email,

            password

          });


      if (authError) {

        throw new Error(
          "メールアドレスまたはパスワードが正しくありません。"
        );

      }


      const user =
        authData?.user;


      if (!user) {

        throw new Error(
          "ログイン情報を取得できませんでした。"
        );

      }


      /*
       * Profile
       */

      const profile =
        await getProfile(
          user.id
        );


      /*
       * メンテナンス確認
       *
       * ログイン後にだけ行う
       */

      const maintenance =
        await getMaintenance();


      /*
       * 緊急復旧モードは
       * 現在の通常メンテナンス設定とは
       * 分離して扱う
       */

      const recovery =
        false;


      /*
       * ======================================
       * Admin
       * ======================================
       */

      if (
        profile.role ===
        "admin"
      ) {

        /*
         * 通常メンテナンス
         *
         * Adminは通常Admin画面へ。
         * 画面上にメンテナンス状態を表示する。
         */

        if (
          maintenance.enabled &&
          !recovery
        ) {

          window.location.replace(
            "../admin/?maintenance=1"
          );

          return;

        }


        /*
         * 緊急復旧
         */

        if (
          recovery
        ) {

          window.location.replace(
            "../admin/maintenance/"
          );

          return;

        }


        window.location.replace(
          "../admin/"
        );

        return;

      }


      /*
       * ======================================
       * Student
       * ======================================
       */

      if (
        profile.role ===
        "student"
      ) {

        /*
         * メンテナンス中は
         * My Booksへ入れない
         */

        if (
          maintenance.enabled
        ) {

          window.location.replace(
            "../student/?maintenance=1"
          );

          return;

        }


        window.location.replace(
          "../student/books/"
        );

        return;

      }


      /*
       * 権限不明
       */

      await supabase.auth.signOut({
        scope:
          "local"
      });


      throw new Error(
        "このアカウントには利用権限が設定されていません。"
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
