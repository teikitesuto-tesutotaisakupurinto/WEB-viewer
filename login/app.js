
import {
  supabase
} from "../assets/js/supabase.js";


const form =
  document.getElementById("loginForm");

const button =
  document.getElementById("loginButton");

const message =
  document.getElementById("message");


async function getProfile(userId) {

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
      "このアカウントは登録されていません。"
    );
  }


  return data;
}


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
      Boolean(data?.enabled),

    message:
      data?.message || ""
  };
}


form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    button.disabled = true;

    message.textContent = "";


    try {

      const email =
        document
          .getElementById("email")
          .value
          .trim()
          .toLowerCase();


      const password =
        document
          .getElementById("password")
          .value;


      if (!email || !password) {
        throw new Error(
          "メールアドレスとパスワードを入力してください。"
        );
      }


      const {
        data,
        error
      } =
        await supabase.auth
          .signInWithPassword({
            email,
            password
          });


      if (error || !data?.user) {
        throw new Error(
          "メールアドレスまたはパスワードが正しくありません。"
        );
      }


      const profile =
        await getProfile(
          data.user.id
        );


      const maintenance =
        await getMaintenance();


      /*
       * Admin
       *
       * 通常メンテナンス中でも
       * Admin画面へ入れる
       */

      if (
        profile.role === "admin"
      ) {

        window.location.replace(
          maintenance.enabled
            ? "../admin/?maintenance=1"
            : "../admin/"
        );

        return;
      }


      /*
       * Student
       */

      if (
        profile.role === "student"
      ) {

        window.location.replace(
          maintenance.enabled
            ? "../student/?maintenance=1"
            : "../student/books/"
        );

        return;
      }


      await supabase.auth.signOut({
        scope: "local"
      });


      throw new Error(
        "このアカウントには利用権限がありません。"
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

      button.disabled = false;
    }

  }
);
