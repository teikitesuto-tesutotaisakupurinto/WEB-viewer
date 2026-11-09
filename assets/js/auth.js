
import {
  supabase
} from "./supabase.js";


const AUTH_TIMEOUT = 5000;


/*
 * タイムアウト
 */

function withTimeout(
  promise,
  timeout = AUTH_TIMEOUT
) {

  return Promise.race([

    promise,

    new Promise(
      (_, reject) => {

        setTimeout(
          () => {

            reject(
              new Error(
                "処理がタイムアウトしました。"
              )
            );

          },
          timeout
        );

      }
    )

  ]);

}


/*
 * 現在のユーザー
 */

export async function getUser() {

  const {
    data,
    error
  } =
    await withTimeout(
      supabase.auth.getUser()
    );


  if (error) {
    throw error;
  }


  if (!data?.user) {

    throw new Error(
      "ログインしてください。"
    );

  }


  return data.user;

}


/*
 * usersプロフィール
 */

export async function getProfile() {

  const user =
    await getUser();


  const {
    data,
    error
  } =
    await withTimeout(

      supabase
        .from("users")
        .select(
          "id,display_name,role"
        )
        .eq(
          "id",
          user.id
        )
        .maybeSingle(),

      AUTH_TIMEOUT

    );


  if (error) {
    throw error;
  }


  if (!data) {

    throw new Error(
      "ユーザー情報が登録されていません。"
    );

  }


  return data;

}


/*
 * Admin
 */

export async function requireAdmin() {

  const profile =
    await getProfile();


  if (
    profile.role !==
    "admin"
  ) {

    window.location.replace(
      "/login/"
    );

    return null;

  }


  return profile;

}


/*
 * Student
 */

export async function requireStudent() {

  const profile =
    await getProfile();


  if (
    profile.role !==
    "student"
  ) {

    window.location.replace(
      "/login/"
    );

    return null;

  }


  return profile;

}


/*
 * Auth Storage削除
 */

function clearAuthStorage() {

  /*
   * localStorage
   */

  try {

    const keys = [];


    for (
      let i = 0;
      i < localStorage.length;
      i++
    ) {

      const key =
        localStorage.key(i);


      if (!key) {
        continue;
      }


      if (
        key.startsWith("sb-")
        &&
        (
          key.includes(
            "auth-token"
          )
          ||
          key.includes(
            "auth"
          )
        )
      ) {

        keys.push(
          key
        );

      }


      if (
        key ===
        "supabase.auth.token"
      ) {

        keys.push(
          key
        );

      }

    }


    for (
      const key of keys
    ) {

      try {

        localStorage.removeItem(
          key
        );

      }
      catch {}

    }

  }
  catch (
    error
  ) {

    console.error(
      "LOCAL STORAGE ERROR:",
      error
    );

  }


  /*
   * sessionStorage
   */

  try {

    const keys = [];


    for (
      let i = 0;
      i < sessionStorage.length;
      i++
    ) {

      const key =
        sessionStorage.key(i);


      if (!key) {
        continue;
      }


      if (
        key.startsWith("sb-")
        &&
        (
          key.includes(
            "auth-token"
          )
          ||
          key.includes(
            "auth"
          )
        )
      ) {

        keys.push(
          key
        );

      }


      if (
        key ===
        "supabase.auth.token"
      ) {

        keys.push(
          key
        );

      }

    }


    for (
      const key of keys
    ) {

      try {

        sessionStorage.removeItem(
          key
        );

      }
      catch {}

    }

  }
  catch (
    error
  ) {

    console.error(
      "SESSION STORAGE ERROR:",
      error
    );

  }

}


/*
 * ログアウト
 *
 * Supabaseが失敗しても
 * 必ずログイン画面へ戻す。
 */

export async function logout() {

  if (
    window.__webViewerLoggingOut
  ) {

    return;

  }


  window.__webViewerLoggingOut =
    true;


  /*
   * ボタンを全部無効化
   */

  document
    .querySelectorAll(
      "#logout"
    )
    .forEach(
      button => {

        button.disabled =
          true;

        button.textContent =
          "ログアウト中...";

      }
    );


  /*
   * Supabaseセッション削除
   */

  try {

    await withTimeout(
      supabase.auth.signOut({
        scope: "local"
      }),
      3000
    );

  }
  catch (
    error
  ) {

    console.warn(
      "SIGN OUT ERROR:",
      error
    );

  }


  /*
   * ブラウザ側セッション削除
   */

  clearAuthStorage();


  /*
   * 必ずログイン画面へ
   */

  window.location.replace(
    new URL(
      "/login/",
      window.location.origin
    ).href
  );

}


/*
 * 全画面の #logout を自動接続
 *
 * Admin
 * Student
 * 資料
 * B4
 * システム
 * メンテナンス画面
 */

function bindLogoutButtons() {

  document
    .querySelectorAll(
      "#logout"
    )
    .forEach(
      button => {

        if (
          button.dataset.logoutBound ===
          "true"
        ) {

          return;

        }


        button.dataset.logoutBound =
          "true";


        button.addEventListener(
          "click",
          event => {

            event.preventDefault();

            logout();

          }
        );

      }
    );

}


/*
 * DOM読み込み時
 */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    bindLogoutButtons,
    {
      once: true
    }
  );

}
else {

  bindLogoutButtons();

}
