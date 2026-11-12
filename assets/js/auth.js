
import {
  supabase
} from "./supabase.js";


const AUTH_TIMEOUT = 8000;


/* =========================================================
   共通
   ========================================================= */

function timeout(
  promise,
  message = "処理がタイムアウトしました。"
) {

  return Promise.race([

    promise,

    new Promise(
      (_, reject) => {

        setTimeout(
          () => reject(
            new Error(message)
          ),
          AUTH_TIMEOUT
        );

      }
    )

  ]);

}


/* =========================================================
   ログインユーザー
   ========================================================= */

export async function getUser() {

  const {
    data,
    error
  } =
    await timeout(
      supabase.auth.getUser(),
      "ログイン情報を取得できませんでした。"
    );


  if (error) {
    throw error;
  }


  return data?.user || null;

}


/* =========================================================
   Profile
   ========================================================= */

export async function getProfile() {

  const user =
    await getUser();


  if (!user) {
    return null;
  }


  const {
    data,
    error
  } =
    await timeout(

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

      "ユーザー情報を取得できませんでした。"

    );


  if (error) {
    throw error;
  }


  return data || null;

}


/* =========================================================
   Admin
   ========================================================= */

export async function requireAdmin() {

  const user =
    await getUser();


  if (!user) {

    location.replace(
      "/errors/?type=login"
    );

    return null;

  }


  const profile =
    await getProfile();


  if (
    !profile ||
    profile.role !== "admin"
  ) {

    location.replace(
      "/errors/?type=403"
    );

    return null;

  }


  return profile;

}


/* =========================================================
   Student
   ========================================================= */

export async function requireStudent() {

  const user =
    await getUser();


  if (!user) {

    location.replace(
      "/errors/?type=login"
    );

    return null;

  }


  const profile =
    await getProfile();


  if (
    !profile ||
    profile.role !== "student"
  ) {

    location.replace(
      "/errors/?type=403"
    );

    return null;

  }


  return profile;

}


/* =========================================================
   Book利用権限
   ========================================================= */

export async function requireBookAccess(
  bookId
) {

  const student =
    await requireStudent();


  if (!student) {
    return null;
  }


  if (!bookId) {

    location.replace(
      "/errors/?type=404"
    );

    return null;

  }


  const {
    data,
    error
  } =
    await timeout(

      supabase
        .from("licenses")
        .select(
          "id"
        )
        .eq(
          "book_id",
          bookId
        )
        .eq(
          "student_id",
          student.id
        )
        .eq(
          "status",
          "used"
        )
        .maybeSingle(),

      "教材の利用権限を確認できませんでした。"

    );


  if (error) {
    throw error;
  }


  if (!data) {

    location.replace(
      "/errors/?type=book-forbidden"
    );

    return null;

  }


  return student;

}


/* =========================================================
   ログアウト
   ========================================================= */

function clearAuthStorage() {

  const storageList = [
    localStorage,
    sessionStorage
  ];


  for (
    const storage of storageList
  ) {

    try {

      const keys = [];


      for (
        let i = 0;
        i < storage.length;
        i++
      ) {

        const key =
          storage.key(i);


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

          keys.push(key);

        }


        if (
          key ===
          "supabase.auth.token"
        ) {

          keys.push(key);

        }

      }


      keys.forEach(
        key => {

          try {
            storage.removeItem(key);
          }
          catch {}

        }
      );

    }
    catch {}

  }

}


export async function logout() {

  if (
    window.__webViewerLoggingOut
  ) {

    return;

  }


  window.__webViewerLoggingOut =
    true;


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


  try {

    await Promise.race([

      supabase.auth.signOut({
        scope: "local"
      }),

      new Promise(
        resolve =>
          setTimeout(
            resolve,
            3000
          )
      )

    ]);

  }
  catch (
    error
  ) {

    console.warn(
      "SIGNOUT:",
      error
    );

  }


  clearAuthStorage();


  location.replace(
    new URL(
      "/login/",
      location.origin
    ).href
  );

}


/* =========================================================
   Logoutボタン自動接続
   ========================================================= */

export function bindLogout() {

  document
    .querySelectorAll(
      "#logout"
    )
    .forEach(
      button => {

        if (
          button.dataset.bound
        ) {

          return;

        }


        button.dataset.bound =
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


if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    bindLogout,
    {
      once: true
    }
  );

}
else {

  bindLogout();

}
