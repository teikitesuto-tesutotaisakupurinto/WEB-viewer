import {
  requireAdmin
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";


const admin =
  await requireAdmin();

if (!admin) {
  throw new Error("Unauthorized");
}


const {
  data,
  error
} =
  await supabase
    .from("system_settings")
    .select("*")
    .eq(
      "id",
      true
    )
    .single();


if (
  !error &&
  data
) {

  document.getElementById(
    "maintenance"
  ).checked =
    data.maintenance;

  document.getElementById(
    "message"
  ).value =
    data.maintenance_message;

}


document.getElementById(
  "save"
).onclick = async () => {

  const maintenance =
    document.getElementById(
      "maintenance"
    ).checked;

  const message =
    document.getElementById(
      "message"
    ).value;


  const {
    error
  } =
    await supabase
      .from("system_settings")
      .update({
        maintenance,
        maintenance_message:
          message,
        updated_at:
          new Date().toISOString()
      })
      .eq(
        "id",
        true
      );


  if (error) {

    console.error(error);

    document.getElementById(
      "result"
    ).textContent =
      "保存に失敗しました。";

    return;
  }


  document.getElementById(
    "result"
  ).textContent =
    "保存しました。";

};
