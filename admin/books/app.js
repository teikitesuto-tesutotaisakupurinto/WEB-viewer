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

    console.error(error);

    document.getElementById(
      "books"
    ).textContent =
      "Bookを取得できませんでした。";

    return;
  }


  if (!data || data.length === 0) {

    document.getElementById(
      "books"
    ).innerHTML =
      `<p>登録されたBookはありません。</p>`;

    return;
  }


  document.getElementById(
    "books"
  ).innerHTML =
    data.map(book => `

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

<div>

<button
  class="secondary-button"
  data-id="${book.id}">
詳細
</button>

</div>

</div>

`).join("");


  document
    .querySelectorAll(
      "[data-id]"
    )
    .forEach(button => {

      button.onclick = () => {

        const book =
          data.find(
            item =>
              item.id ===
              button.dataset.id
          );

        if (!book) {
          return;
        }


        alert(
          "Book名: " +
          book.title +
          "\nBookシリアル: " +
          book.book_serial
        );

      };

    });

}


document.getElementById(
  "create"
).onclick = async () => {

  message.textContent = "";

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

    return;
  }


  message.textContent =
    "登録しています。";


  let bookPath = null;

  let bookType = null;

  const uploadedPaths = [];


  try {

    if (
      pdfFiles.length === 1
    ) {

      const file =
        pdfFiles[0];

      bookType = "pdf";

      bookPath =
        "books/" +
        crypto.randomUUID() +
        ".pdf";


      const upload =
        await supabase.storage
          .from("web-viewer")
          .upload(
            bookPath,
            file
          );


      if (upload.error) {
        throw upload.error;
      }


      uploadedPaths.push(
        bookPath
      );

    }
    else {

      bookType =
        extensions[0];

    }


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
      throw bookError;
    }


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


        const upload =
          await supabase.storage
            .from("web-viewer")
            .upload(
              path,
              file
            );


        if (upload.error) {
          throw upload.error;
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


      const {
        error: pageError
      } =
        await supabase
          .from("book_pages")
          .insert(
            pageRows
          );


      if (pageError) {
        throw pageError;
      }

    }


    document.getElementById(
      "title"
    ).value = "";

    document.getElementById(
      "description"
    ).value = "";

    document.getElementById(
      "files"
    ).value = "";


    message.textContent =
      "Bookを登録しました。";


    formCard.classList.add(
      "hidden"
    );


    await loadBooks();


  }
  catch (error) {

    console.error(
      "Book registration error:",
      error
    );


    if (
      uploadedPaths.length > 0
    ) {

      await supabase.storage
        .from("web-viewer")
        .remove(
          uploadedPaths
        );

    }


    message.textContent =
      "Book登録に失敗しました。";

  }

};


loadBooks();
