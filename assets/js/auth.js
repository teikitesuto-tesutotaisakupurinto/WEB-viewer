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
      "AUTH USER ERROR:",
      error
    );

    return null;
  }


  return data?.user || null;
}


export async function getProfile() {

  const user =
    await getUser();


  if (!user) {

    console.error(
      "AUTH USER NOT FOUND"
    );

    return null;
  }


  const {
    data,
    error
  } =
    await supabase.rpc(
      "get_current_profile"
    );


  if (error) {

    console.error(
      "PROFILE RPC ERROR:",
      error
    );

    return null;
  }


  if (!data) {

    console.error(
      "PROFILE NOT FOUND:",
      user.id
    );

    return null;
  }


  return data;
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

  await supabase.auth.signOut();

  location.replace(
    "/login/"
  );
}
