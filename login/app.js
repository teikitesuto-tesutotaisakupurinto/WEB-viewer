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

      message.textContent =
        "ログインエラー: " +
        loginError.message;

      button.disabled = false;

      return;
    }


    const user =
      loginData.user;


    if (!user) {

      message.textContent =
        "ユーザーを取得できませんでした。";

      button.disabled = false;

      return;
    }


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


    message.style.color = "#222";

    message.innerHTML = `
      UID: ${user.id}<br>
      Profile ID: ${profile?.id || "なし"}<br>
      Role: ${profile?.role || "なし"}<br>
      Error: ${profileError?.message || "なし"}
    `;


    console.log("LOGIN USER:", user);
    console.log("PROFILE:", profile);
    console.log("PROFILE ERROR:", profileError);


    button.disabled = false;

  }
);
