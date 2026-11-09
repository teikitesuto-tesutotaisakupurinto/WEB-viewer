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
      error
    } =
      await supabase.auth
        .signInWithPassword({
          email,
          password
        });


    if (error) {

      message.textContent =
        "メールアドレスまたはパスワードが正しくありません。";

      button.disabled = false;

      return;
    }


    const {
      data: userData
    } =
      await supabase.auth.getUser();


    const user =
      userData.user;


    const {
      data: profile
    } =
      await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();


    if (!profile) {

      await supabase.auth.signOut();

      message.textContent =
        "ユーザー情報が登録されていません。";

      button.disabled = false;

      return;
    }


    if (profile.role === "admin") {

      location.replace("../admin/");

      return;
    }


    location.replace("../student/");

  }
);
