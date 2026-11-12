import {
  requireAdmin,
  logout
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";


document.getElementById(
  "logout"
).onclick =
  () => logout();


const enabled =
  document.getElementById(
    "maintenanceEnabled"
  );


const message =
  document.getElementById(
    "maintenanceMessage"
  );


const status =
  document.getElementById(
    "status"
  );


const result =
  document.getElementById(
    "result"
  );


function updateStatus() {

  const on =
    enabled.checked;


  status.textContent =
    on
      ? "現在：ON"
      : "現在：OFF";


  status.classList.toggle(
    "on",
    on
  );

}


enabled.onchange =
  updateStatus;


document.getElementById(
  "save"
).onclick =
  saveMaintenance;


async function loadMaintenance() {

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
    .maybeSingle();


  if (error) {
    throw error;
  }


  if (!data) {

    throw new Error(
      "メンテナンス設定がありません。"
    );

  }


  enabled.checked =
    Boolean(
      data.enabled
    );


  message.value =
    data.message || "";


  updateStatus();

}


async function saveMaintenance() {

  const button =
    document.getElementById(
      "save"
    );


  button.disabled =
    true;


  result.textContent =
    "保存しています。";


  try {

    const {
      error
    } =
    await supabase
      .from(
        "maintenance_settings"
      )
      .update({

        enabled:
          enabled.checked,

        message:
          message.value.trim(),

        updated_at:
          new Date()
            .toISOString()

      })
      .eq(
        "id",
        1
      );


    if (error) {
      throw error;
    }


    result.textContent =
      "保存しました。";


    updateStatus();

  }
  catch (error) {

    result.textContent =
      "保存できませんでした。";

    console.error(
      error
    );

  }
  finally {

    button.disabled =
      false;

  }

}


async function start() {

  const admin =
    await requireAdmin();

  if (!admin) {
    return;
  }


  await loadMaintenance();

}


start()
.catch(
  error => {

    document.querySelector(
      ".admin-content"
    ).innerHTML += `
      <div class="page-error">

        <h2>
          システム設定を読み込めませんでした
        </h2>

        <p>
          設定情報を取得できませんでした。
        </p>

      </div>
    `;

  }
);
