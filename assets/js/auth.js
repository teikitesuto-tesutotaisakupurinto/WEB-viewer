
import {
  supabase
}
from "./supabase.js";


const TIMEOUT = 8000;


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
          TIMEOUT
        );

      }
    )

  ]);

}


/*
 * 現在のログインユーザー
 */

export async function getUser() {

  const result =
    await withTimeout(
      supabase.auth.getUser(),
      "ログイン情報の取得がタイムアウトしました。"
    );


  if (result.error) {
    throw result.error;
  }


  if (!result.data?.user) {

    throw new Error(
      "ログインしてください。"
    );

  }


  return result.data.user;

}


/*
 * プロフィール
 */

export async function getProfile() {

  const user =
    await getUser();


  /*
   * RPCが固まる場合に備えて
   * 直接usersを取得
   */

  const result =
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


  if (result.error) {

    throw result.error;

  }


  if (!result.data) {

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
  catch (error) {

    console.error(
      "LOGOUT ERROR:",
      error
    );

  }


  /*
   * 強制的にログイン画面へ
   */

  window.location.replace(
    "/login/"
  );

}
