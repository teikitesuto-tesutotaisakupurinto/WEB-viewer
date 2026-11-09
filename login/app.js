import { supabase }
from "../assets/js/supabase.js";


const form =
  document.getElementById("loginForm");

const message =
  document.getElementById("message");

const button =
  document.getElementById("loginButton");


form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    message.textContent = "";

    button.disabled = true;


    const email =
      document.getElementById("email")
        .value
        .trim();

    const password =
      document.getElementById("password")
        .value;


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

      message.style.color = "#b00020";

      message.textContent =
        "ログインエラー: " +
        loginError.message;

      console.error(
        "LOGIN ERROR",
        loginError
      );

      button.disabled = false;

      return;
    }


    if (!loginData?.user) {

      message.style.color = "#b00020";

      message.textContent =
        "ログインユーザーを取得できませんでした。";

      button.disabled = false;

      return;
    }


    console.log(
      "LOGIN UID:",
      loginData.user.id
    );


    const {
      data: profile,
      error: profileError
    } =
      await supabase.rpc(
        "login_profile"
      );


    console.log(
      "PROFILE:",
      profile
    );

    console.log(
      "PROFILE ERROR:",
      profileError
    );


    if (profileError) {

      message.style.color = "#b00020";

      message.textContent =
        "Supabaseエラー: " +
        profileError.message;

      button.disabled = false;

      return;
    }


    if (!profile) {

      message.style.color = "#b00020";

      message.textContent =
        "usersに該当するユーザーがありません。";

      button.disabled = false;

      return;
    }


    console.log(
      "PROFILE RESULT:",
      profile
    );


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


    message.style.color = "#b00020";

    message.textContent =
      "不明な権限です: " +
      String(profile.role);

    button.disabled = false;

  }
);
