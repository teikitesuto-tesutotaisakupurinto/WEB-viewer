import {
  supabase
}
from "./supabase.js";


export async function getUser() {

  const {
    data,
    error
  } =
    await supabase.auth.getUser();


  if (error) {

    console.error(
      "AUTH ERROR:",
      error
    );

    throw error;
  }


  return data?.user || null;
}


export async function getProfile() {

  const {
    data,
    error
  } =
    await supabase.rpc(
      "get_current_profile"
    );


  if (error) {

    console.error(
      "PROFILE ERROR:",
      error
    );

    throw error;
  }


  return data || null;
}


export async function requireAdmin() {

  const profile =
    await getProfile();


  if (
    !profile ||
    profile.role !== "admin"
  ) {

    location.replace(
      "/login/"
    );

    return null;
  }


  return profile;
}


export async function requireStudent() {

  const profile =
    await getProfile();


  if (
    !profile ||
    profile.role !== "student"
  ) {

    location.replace(
      "/login/"
    );

    return null;
  }


  return profile;
}


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
   * セッションが残っていても
   * ログイン画面へ戻す
   */

  location.replace(
    "/login/"
  );

}
