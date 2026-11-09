import {
  requireAdmin,
  logout
}
from "../assets/js/auth.js";

import {
  showError
}
from "../assets/js/common.js";


try {

  const admin =
    await requireAdmin();


  if (!admin) {
    throw new Error(
      "管理者として認証されていません。"
    );
  }


  document.getElementById(
    "logout"
  ).onclick =
    logout;


}
catch (error) {

  console.error(
    "ADMIN ERROR:",
    error
  );


  const main =
    document.querySelector(
      ".admin-content"
    );


  showError(
    error.message,
    main
  );

}
