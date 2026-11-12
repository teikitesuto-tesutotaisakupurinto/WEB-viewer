const params =
  new URLSearchParams(
    location.search
  );


const type =
  params.get("type") ||
  "404";


const config = {

  "404": {

    code:
      "404",

    title:
      "ページが見つかりません",

    message:
      "指定されたページは存在しないか、移動された可能性があります。",

    home:
      "/login/"

  },


  "403": {

    code:
      "403",

    title:
      "アクセスできません",

    message:
      "このページを利用する権限がありません。",

    home:
      "/login/"

  },


  "login": {

    code:
      "LOGIN",

    title:
      "ログインが必要です",

    message:
      "このページを利用するにはログインしてください。",

    home:
      "/login/"

  },


  "book-forbidden": {

    code:
      "403",

    title:
      "教材を閲覧できません",

    message:
      "この教材を閲覧する権限がありません。",

    home:
      "/student/books/"

  },


  "system": {

    code:
      "ERROR",

    title:
      "一時的な問題が発生しました",

    message:
      "時間をおいてもう一度お試しください。",

    home:
      "/login/"

  }

};


const current =
  config[type] ||
  config["404"];


document.getElementById(
  "errorCode"
).textContent =
  current.code;


document.getElementById(
  "errorTitle"
).textContent =
  current.title;


document.getElementById(
  "errorMessage"
).textContent =
  current.message;


document.getElementById(
  "home"
).onclick =
  () => {

    location.replace(
      current.home
    );

  };


document.getElementById(
  "back"
).onclick =
  () => {

    if (
      history.length > 1
    ) {

      history.back();

    }
    else {

      location.replace(
        current.home
      );

    }

  };
