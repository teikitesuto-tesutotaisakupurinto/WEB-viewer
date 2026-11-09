
import {
  supabase
} from "./supabase.js";


const AUTH_TIMEOUT = 5000;


/*
 * タイムアウト付き処理
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
 * ログインユーザー取得
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


  if (
    !data?.user
  ) {

    throw new Error(
      "ログインしてください。"
    );

  }


  return data.user;

}


/*
 * プロフィール取得
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
        .maybeSingle()
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
 * Admin認証
 */

export async function requireAdmin() {

  const profile =
    await getProfile();


  if (
    profile.role !==
    "admin"
  ) {

    location.replace(
      "/login/"
    );

    return null;

  }


  return profile;

}


/*
 * Student認証
 */

export async function requireStudent() {

  const profile =
    await getProfile();


  if (
    profile.role !==
    "student"
  ) {

    location.replace(
      "/login/"
    );

    return null;

  }


  return profile;

}


/*
 * Supabase Authのローカルデータを
 * 可能な限り全部削除
 */

function clearAuthStorage() {

  /*
   * localStorage
   */

  try {

    const localKeys = [];


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


      /*
       * Supabase v2
       *
       * sb-xxxx-auth-token
       */

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

        localKeys.push(
          key
        );

      }


      /*
       * 古い形式
       */

      if (
        key ===
        "supabase.auth.token"
      ) {

        localKeys.push(
          key
        );

      }

    }


    localKeys.forEach(
      key => {

        try {

          localStorage.removeItem(
            key
          );

        }
        catch {}

      }
    );

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

    const sessionKeys = [];


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

        sessionKeys.push(
          key
        );

      }


      if (
        key ===
        "supabase.auth.token"
      ) {

        sessionKeys.push(
          key
        );

      }

    }


    sessionKeys.forEach(
      key => {

        try {

          sessionStorage.removeItem(
            key
          );

        }
        catch {}

      }
    );

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
 * 重要：
 * signOutが失敗しても
 * 絶対にログイン画面へ戻す
 */

export async function logout() {

  /*
   * 二重クリック防止
   */

  if (
    window.__loggingOut
  ) {

    return;

  }


  window.__loggingOut =
    true;


  /*
   * 先にボタンを無効化
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
   * Supabase側セッションを削除
   *
   * 失敗しても続行
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
   * ローカルセッションを削除
   */

  clearAuthStorage();


  /*
   * 最終的に必ずログイン画面へ
   */

  const loginUrl =
    new URL(
      "/login/",
      window.location.origin
    ).href;


  window.location.replace(
    loginUrl
  );

}
