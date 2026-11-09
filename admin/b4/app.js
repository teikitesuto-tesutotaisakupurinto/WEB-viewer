import {
  requireAdmin
}
from "../../assets/js/auth.js";

import {
  makeCode,
  escapeHtml
}
from "../../assets/js/common.js";


const admin =
  await requireAdmin();

if (!admin) {
  throw new Error("Unauthorized");
}


document.getElementById(
  "preview"
).onclick = async () => {

  const book =
    document.getElementById(
      "book"
    ).value;

  const className =
    document.getElementById(
      "class"
    ).value;

  const name =
    document.getElementById(
      "name"
    ).value;

  const inputCode =
    document.getElementById(
      "code"
    ).value.trim();

  const code =
    inputCode ||
    makeCode();


  document.getElementById(
    "code"
  ).value = code;


  document.getElementById(
    "sheet"
  ).innerHTML = `

<div class="b4-sheet">

<h2>
電子教科書のご案内
</h2>

<div>
Book名：
${escapeHtml(book)}
</div>

<div>
クラス：
${escapeHtml(className)}

氏名：
${escapeHtml(name)}
</div>

<div
  id="qr"
  class="qr">
</div>

<div class="b4-code">
${escapeHtml(code)}
</div>

<div>
利用方法
</div>

<div>
QRコードを読み取り、ログインして利用してください。
</div>

<div class="b4-note">
※ 紛失の場合はこちらでは対応しかねますのでご注意ください。
</div>

</div>
`;


  const script =
    document.createElement(
      "script"
    );


  script.src =
    "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";


  script.onload = () => {

    new QRCode(
      document.getElementById(
        "qr"
      ),
      {
        text: code,
        width: 250,
        height: 250
      }
    );

  };


  document.head.appendChild(
    script
  );

};


document.getElementById(
  "print"
).onclick = () => {

  window.print();

};
