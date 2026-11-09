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
      data,
      error
    } =
      await supabase.auth
        .signInWithPassword({
          email,
          password
        });


    if (error) {

      message.textContent =
        "ログインできませんでした。";

      button.disabled = false;

      return;
    }


    if (!data.user) {

      message.textContent =
        "ログイン情報を取得できませんでした。";

      button.disabled = false;

      return;
    }


    const {
      data: profile,
      error: profileError
    } =
      await supabase.rpc(
        "get_current_profile"
      );


    if (
      profileError ||
      !profile
    ) {

      console.error(
        profileError
      );

      message.textContent =
        "ユーザー情報を取得できませんでした。";

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
