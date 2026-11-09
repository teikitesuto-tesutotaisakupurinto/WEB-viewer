import {
  requireAdmin,
  logout
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";

import {
  showError
}
from "../../assets/js/common.js";


async function start() {

  const admin =
    await requireAdmin();

  if (!admin) {
    return;
  }


  document.getElementById(
    "logout"
  ).onclick =
    event => {

      event.preventDefault();

      logout();

    };


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

    if (
      enabled.checked
    ) {

      status.textContent =
        "現在：ON";

      status.classList.add(
        "on"
      );

    }
    else {

      status.textContent =
        "現在：OFF";

      status.classList.remove(
        "on"
      );

    }

  }


  enabled.onchange =
    updateStatus;


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


  document.getElementById(
    "save"
  ).onclick =
    async () => {

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
          "保存エラー: " +
          error.message;

      }

    };

}


start()
  .catch(
    error => {

      showError(
        error.message,
        document.querySelector(
          ".admin-content"
        )
      );

    }
  );
