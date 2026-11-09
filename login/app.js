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
        .value.trim();

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

      console.error(loginError);

      message.textContent =
        "メールアドレスまたはパスワードが正しくありません。";

      button.disabled = false;

      return;
    }


    const user =
      loginData.user;


    if (!user) {

      message.textContent =
        "ログイン情報を取得できませんでした。";

      button.disabled = false;

      return;
    }


    console.log(
      "ログインUID:",
      user.id
    );


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
      "プロフィール:",
      profile
    );

    console.log(
      "プロフィール取得エラー:",
      profileError
    );


    if (profileError) {

      console.error(
        profileError
      );

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
