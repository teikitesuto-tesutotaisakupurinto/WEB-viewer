import {
  supabase
}
from "./supabase.js";


const AUTH_TIMEOUT = 8000;


/*
 * タイムアウト
 */

function withTimeout(
  promise,
  message
) {

  return Promise.race([

    promise,

    new Promise(
      (_, reject) => {

        setTimeout(
          () => {

            reject(
              new Error(
                message
              )
            );

          },
          AUTH_TIMEOUT
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
      supabase.auth.getUser(),
      "ログイン情報の取得がタイムアウトしました。"
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

      "ユーザー情報の取得がタイムアウトしました。"

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

    location.replace(
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

    location.replace(
      "/login/"
    );

    return null;

  }


  return profile;

}


/*
 * ログアウト
 *
 * Student / Admin 共通
 */

export async function logout() {

  /*
   * Supabase側のセッションを削除
   */

  try {

    await supabase.auth.signOut({
      scope: "local"
    });

  }
  catch (error) {

    console.error(
      "SUPABASE SIGNOUT ERROR:",
      error
    );

  }


  /*
   * Supabase AuthのローカルStorageを削除
   *
   * sb-xxxxxxxx-auth-token
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


      if (
        key &&
        key.startsWith("sb-") &&
        key.endsWith(
          "-auth-token"
        )
      ) {

        keys.push(key);

      }

    }


    keys.forEach(
      key => {

        localStorage.removeItem(
          key
        );

      }
    );

  }
  catch (error) {

    console.error(
      "LOCAL STORAGE CLEAR ERROR:",
      error
    );

  }


  /*
   * SessionStorageにも残っている場合に備える
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


      if (
        key &&
        key.startsWith("sb-") &&
        key.endsWith(
          "-auth-token"
        )
      ) {

        keys.push(key);

      }

    }


    keys.forEach(
      key => {

        sessionStorage.removeItem(
          key
        );

      }
    );

  }
  catch (error) {

    console.error(
      "SESSION STORAGE CLEAR ERROR:",
      error
    );

  }


  /*
   * ログイン画面へ
   *
   * 絶対パスではなく、
   * 現在のサイトから確実に作る
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
