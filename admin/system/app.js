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
    logout;


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


  /*
   * ON/OFF表示
   */

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


  enabled.addEventListener(
    "change",
    updateStatus
  );


  /*
   * 現在の設定取得
   */

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

    throw new Error(
      "メンテナンス設定を取得できませんでした: " +
      error.message
    );

  }


  if (!data) {

    throw new Error(
      "メンテナンス設定が登録されていません。"
    );

  }


  enabled.checked =
    Boolean(
      data.enabled
    );


  message.value =
    data.message || "";


  updateStatus();


  /*
   * 保存
   */

  document.getElementById(
    "save"
  ).onclick =
    async () => {

      const saveButton =
        document.getElementById(
          "save"
        );


      saveButton.disabled =
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

        console.error(
          "MAINTENANCE SAVE ERROR:",
          error
        );


        result.textContent =
          "保存エラー: " +
          error.message;

      }
      finally {

        saveButton.disabled =
          false;

      }

    };

}


start()
  .catch(
    error => {

      console.error(
        "SYSTEM PAGE ERROR:",
        error
      );


      showError(
        error.message,
        document.querySelector(
          ".admin-content"
        )
      );

    }
  );
