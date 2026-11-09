import {
  requireAdmin,
  logout
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";


const admin =
  await requireAdmin();


if (!admin) {
  throw new Error(
    "Unauthorized"
  );
}


document.getElementById(
  "logout"
).onclick =
  logout;


const enabledInput =
  document.getElementById(
    "maintenanceEnabled"
  );


const messageInput =
  document.getElementById(
    "maintenanceMessage"
  );


const result =
  document.getElementById(
    "message"
  );


/*
 * 現在の設定を取得
 */

async function loadSettings() {

  const {
    data,
    error
  } =
    await supabase
      .from(
        "maintenance_settings"
      )
      .select(
        "enabled,message"
      )
      .eq(
        "id",
        1
      )
      .single();


  if (error) {

    console.error(
      "MAINTENANCE LOAD ERROR:",
      error
    );


    result.textContent =
      "設定を取得できませんでした。";

    return;

  }


  enabledInput.checked =
    Boolean(
      data.enabled
    );


  messageInput.value =
    data.message || "";

}


/*
 * 保存
 */

document.getElementById(
  "save"
).onclick = async () => {

  const enabled =
    enabledInput.checked;


  const message =
    messageInput.value.trim();


  if (!message) {

    result.textContent =
      "メンテナンス表示文を入力してください。";

    return;

  }


  result.textContent =
    "保存しています。";


  const {
    error
  } =
    await supabase
      .from(
        "maintenance_settings"
      )
      .update({
        enabled,
        message,
        updated_at:
          new Date()
            .toISOString()
      })
      .eq(
        "id",
        1
      );


  if (error) {

    console.error(
      "MAINTENANCE SAVE ERROR:",
      error
    );


    result.textContent =
      "保存に失敗しました。";

    return;

  }


  result.textContent =
    "保存しました。";

};


await loadSettings();
