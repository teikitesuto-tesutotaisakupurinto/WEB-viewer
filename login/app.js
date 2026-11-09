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
        "メールアドレスまたはパスワードが正しくありません。";

      button.disabled = false;

      return;
    }


    const {
      data: userData,
      error: userError
    } =
      await supabase.auth
        .getUser();


    if (
      userError ||
      !userData.user
    ) {

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
        "get_my_profile"
      );


    if (
      profileError ||
      !profile ||
      profile.length === 0
    ) {

      console.error(
        profileError
      );

      message.textContent =
        "ユーザー情報が登録されていません。";

      button.disabled = false;

      return;
    }


    const user =
      profile[0];


    if (
      user.role === "admin"
    ) {

      location.replace(
        "../admin/"
      );

      return;
    }


    if (
      user.role === "student"
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
