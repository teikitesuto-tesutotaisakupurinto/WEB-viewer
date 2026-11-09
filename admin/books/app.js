import {
  requireAdmin
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";

import {
  escapeHtml
}
from "../../assets/js/common.js";


const admin =
  await requireAdmin();

if (!admin) {
  throw new Error("Unauthorized");
}


const formCard =
  document.getElementById("formCard");

const message =
  document.getElementById("message");


document.getElementById(
  "showForm"
).onclick = () => {

  formCard.classList.remove(
    "hidden"
  );

};


document.getElementById(
  "cancel"
).onclick = () => {

  formCard.classList.add(
    "hidden"
  );

};


async function loadBooks() {

  const {
    data,
    error
  } =
    await supabase
      .from("books")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    console.error(
      "BOOK LIST ERROR:",
      error
    );

    document.getElementById(
      "books"
    ).textContent =
      "Bookを取得できませんでした。";

    return;
  }


  if (
    !data ||
    data.length === 0
  ) {

    document.getElementById(
      "books"
    ).innerHTML =
      "<p>登録されたBookはありません。</p>";

    return;
  }


  document.getElementById(
    "books"
  ).innerHTML =
    data.map(
      book => `

<div class="book-item">

<div>

<div class="book-title">
${escapeHtml(book.title)}
</div>

<div class="book-meta">
Bookシリアル:
${escapeHtml(book.book_serial)}
</div>

<div class="book-meta">
形式:
${escapeHtml(book.file_type || "")}
</div>

</div>

</div>

`
    ).join("");

}


document.getElementById(
  "create"
).onclick = async () => {

  message.textContent =
    "登録処理を開始しています。";

  message.style.color =
    "#222";


  const title =
    document.getElementById(
      "title"
    ).value.trim();


  const description =
    document.getElementById(
      "description"
    ).value.trim();


  const files =
    Array.from(
      document.getElementById(
        "files"
      ).files
    );


  if (
    !title ||
    files.length === 0
  ) {

    message.textContent =
      "Book名と教材ファイルを入力してください。";

    message.style.color =
      "#b00020";

    return;
  }


  const extensions =
    files.map(
      file =>
        file.name
          .split(".")
          .pop()
          .toLowerCase()
    );


  const allowed = [
    "pdf",
    "jpg",
    "jpeg",
    "png"
  ];


  if (
    extensions.some(
      extension =>
        !allowed.includes(
          extension
        )
    )
  ) {

    message.textContent =
      "PDF、JPG、JPEG、PNGのみ対応しています。";

    message.style.color =
      "#b00020";

    return;
  }


  const pdfFiles =
    files.filter(
      file =>
        file.name
          .toLowerCase()
          .endsWith(".pdf")
    );


  if (
    pdfFiles.length > 1 ||
    (
      pdfFiles.length === 1 &&
      files.length !== 1
    )
  ) {

    message.textContent =
      "PDFを登録する場合は1ファイルだけ選択してください。";

    message.style.color =
      "#b00020";

    return;
  }


  let bookPath = null;

  let bookType = null;

  const uploadedPaths = [];


  try {

    /*
     * PDF
     */

    if (
      pdfFiles.length === 1
    ) {

      const file =
        pdfFiles[0];


      bookType =
        "pdf";


      bookPath =
        "books/" +
        crypto.randomUUID() +
        ".pdf";


      message.textContent =
        "PDFをアップロードしています。";


      const {
        error: uploadError
      } =
        await supabase.storage
          .from("web-viewer")
          .upload(
            bookPath,
            file,
            {
              upsert: false
            }
          );


      if (uploadError) {

        throw new Error(
          "Storage upload: " +
          uploadError.message
        );

      }


      uploadedPaths.push(
        bookPath
      );

    }


    /*
     * 画像
     */

    else {

      bookType =
        extensions[0];

    }


    message.textContent =
      "Book情報を登録しています。";


    const {
      data: book,
      error: bookError
    } =
      await supabase
        .from("books")
        .insert({
          title,
          description,
          file_path:
            bookPath,
          file_type:
            bookType,
          created_by:
            admin.id
        })
        .select()
        .single();


    if (bookError) {

      throw new Error(
        "Books insert: " +
        bookError.message
      );

    }


    /*
     * 画像ページ
     */

    if (
      pdfFiles.length === 0
    ) {

      const pageRows = [];


      for (
        let index = 0;
        index < files.length;
        index++
      ) {

        const file =
          files[index];


        const extension =
          file.name
            .split(".")
            .pop()
            .toLowerCase();


        const path =
          "books/" +
          crypto.randomUUID() +
          "." +
          extension;


        message.textContent =
          `画像 ${index + 1} / ${files.length} をアップロードしています。`;


        const {
          error: uploadError
        } =
          await supabase.storage
            .from("web-viewer")
            .upload(
              path,
              file,
              {
                upsert: false
              }
            );


        if (uploadError) {

          throw new Error(
            "Image upload: " +
            uploadError.message
          );

        }


        uploadedPaths.push(
          path
        );


        pageRows.push({
          book_id:
            book.id,

          page_number:
            index + 1,

          file_path:
            path,

          file_type:
            extension
        });

      }


      message.textContent =
        "画像ページを登録しています。";


      const {
        error: pageError
      } =
        await supabase
          .from("book_pages")
          .insert(
            pageRows
          );


      if (pageError) {

        throw new Error(
          "Book pages insert: " +
          pageError.message
        );

      }

    }


    message.textContent =
      "Bookを登録しました。";

    message.style.color =
      "#222";


    document.getElementById(
      "title"
    ).value = "";

    document.getElementById(
      "description"
    ).value = "";

    document.getElementById(
      "files"
    ).value = "";


    formCard.classList.add(
      "hidden"
    );


    await loadBooks();

  }
  catch (error) {

    console.error(
      "BOOK REGISTRATION ERROR:",
      error
    );


    /*
     * 途中までアップロードした
     * ファイルを削除
     */

    if (
      uploadedPaths.length > 0
    ) {

      await supabase.storage
        .from("web-viewer")
        .remove(
          uploadedPaths
        );

    }


    message.style.color =
      "#b00020";


    message.textContent =
      "登録エラー: " +
      error.message;

  }

};


loadBooks();
