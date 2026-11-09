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


form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    message.textContent = "";

    button.disabled = true;


    const email =
      document.getElementById(
        "email"
      ).value.trim();


    const password =
      document.getElementById(
        "password"
      ).value;


    const {
      data: login,
      error: loginError
    } =
      await supabase.auth
        .signInWithPassword({
          email,
          password
        });


    if (loginError) {

      console.error(
        loginError
      );

      message.textContent =
        "ログインできませんでした。";

      button.disabled = false;

      return;
    }


    if (!login.user) {

      message.textContent =
        "ログインユーザーを取得できませんでした。";

      button.disabled = false;

      return;
    }


    console.log(
      "UID:",
      login.user.id
    );


    const {
      data: profile,
      error: profileError
    } =
      await supabase.rpc(
        "login_profile"
      );


    console.log(
      "Profile:",
      profile
    );

    console.log(
      "Profile error:",
      profileError
    );


    if (profileError) {

      message.textContent =
        "ユーザー情報の取得に失敗しました。";

      button.disabled = false;

      return;
    }


    if (!profile) {

      message.textContent =
        "ユーザー情報が登録されていません。";

      button.disabled = false;

      return;
    }


    if (
      profile.role === "admin"
    ) {

      location.replace(
        "../admin/"
      );

      return;
    }


    if (
      profile.role === "student"
    ) {

      location.replace(
        "../student/"
      );

      return;
    }


    message.textContent =
      "ユーザー権限が設定されていません。";

    button.disabled = false;

  }
);
