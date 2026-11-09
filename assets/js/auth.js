import {
  supabase
}
from "./supabase.js";


const REQUEST_TIMEOUT =
  10000;


function timeoutPromise(
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
          REQUEST_TIMEOUT
        );

      }
    )

  ]);

}


/*
 * 現在ログイン中のUser
 */

export async function getUser() {

  const result =
    await timeoutPromise(
      supabase.auth.getUser(),
      "Supabaseへの接続がタイムアウトしました。"
    );


  if (
    result.error
  ) {

    console.error(
      "AUTH ERROR:",
      result.error
    );

    throw result.error;

  }


  if (
    !result.data?.user
  ) {

    throw new Error(
      "ログイン情報がありません。"
    );

  }


  return result.data.user;

}


/*
 * usersプロフィール
 */

export async function getProfile() {

  const result =
    await timeoutPromise(
      supabase.rpc(
        "get_current_profile"
      ),
      "ユーザー情報の取得がタイムアウトしました。"
    );


  if (
    result.error
  ) {

    console.error(
      "PROFILE ERROR:",
      result.error
    );

    throw result.error;

  }


  if (
    !result.data
  ) {

    throw new Error(
      "usersにユーザー情報がありません。"
    );

  }


  return result.data;

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
 */

export async function logout() {

  try {

    await supabase.auth.signOut();

  }
  catch (
    error
  ) {

    console.error(
      "LOGOUT ERROR:",
      error
    );

  }


  /*
   * ローカルに残っている
   * Supabaseセッションも削除
   */

  try {

    localStorage.removeItem(
      "supabase.auth.token"
    );

  }
  catch {}


  location.replace(
    "/login/"
  );

}
