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
  escapeHtml,
  showError
}
from "../../assets/js/common.js";


const formCard =
  document.getElementById(
    "formCard"
  );

const message =
  document.getElementById(
    "message"
  );

const booksContainer =
  document.getElementById(
    "books"
  );


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


  document.getElementById(
    "showForm"
  ).onclick = () => {

    formCard.classList.remove(
      "hidden"
    );

    message.textContent =
      "";

  };


  document.getElementById(
    "cancel"
  ).onclick = () => {

    formCard.classList.add(
      "hidden"
    );

    message.textContent =
      "";

  };


  document.getElementById(
    "create"
  ).onclick =
    () => createBook(admin);


  await loadBooks();

}


async function loadBooks() {

  booksContainer.innerHTML =
    `
    <div class="book-empty">
      読み込み中です。
    </div>
    `;


  const {
    data,
    error
  } =
    await supabase
      .from("books")
      .select(`
        id,
        title,
        description,
        book_serial,
        file_type,
        enabled,
        created_at
      `)
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {
    throw error;
  }


  if (
    !data ||
    data.length === 0
  ) {

    booksContainer.innerHTML =
      `
      <div class="book-empty">
        登録されたBookはありません。
      </div>
      `;

    return;
  }


  booksContainer.innerHTML =
    data.map(
      book => `

<div class="book-admin-item">

<div class="book-admin-main">

<div class="book-admin-title">
${escapeHtml(
  book.title
)}
</div>

<div class="book-admin-description">
${escapeHtml(
  book.description || ""
)}
</div>

<div class="book-admin-serial">
${escapeHtml(
  book.book_serial || ""
)}
</div>

<div class="book-admin-type">
${escapeHtml(
  book.file_type || ""
)}
</div>

</div>

<div class="book-admin-status">

${
  book.enabled
    ? "公開"
    : "停止"
}

</div>

</div>

`
    ).join("");

}


async function createBook(
  admin
) {

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


  if (!title) {

    message.textContent =
      "Book名を入力してください。";

    return;

  }


  if (!files.length) {

    message.textContent =
      "教材ファイルを選択してください。";

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
    pdfFiles.length > 0 &&
    files.length !== 1
  ) {

    message.textContent =
      "PDFを登録する場合はPDFを1ファイルだけ選択してください。";

    return;

  }


  message.style.color =
    "#222";

  message.textContent =
    "登録しています。";


  const uploaded =
    [];


  try {

    let filePath = null;

    let fileType =
      extensions[0];


    /*
     * PDF
     */

    if (
      pdfFiles.length === 1
    ) {

      fileType =
        "pdf";


      filePath =
        "books/" +
        crypto.randomUUID() +
        ".pdf";


      const {
        error
      } =
        await supabase.storage
          .from("web-viewer")
          .upload(
            filePath,
            pdfFiles[0]
          );


      if (error) {
        throw error;
      }


      uploaded.push(
        filePath
      );

    }


    /*
     * Book本体
     */

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
            filePath,

          file_type:
            fileType,

          created_by:
            admin.id
        })
        .select()
        .single();


    if (bookError) {
      throw bookError;
    }


    /*
     * 画像ページ
     */

    if (
      pdfFiles.length === 0
    ) {

      const pageRows = [];


      for (
        let i = 0;
        i < files.length;
        i++
      ) {

        const file =
          files[i];


        const extension =
          extensions[i];


        const path =
          "books/" +
          crypto.randomUUID() +
          "." +
          extension;


        const {
          error
        } =
          await supabase.storage
            .from("web-viewer")
            .upload(
              path,
              file
            );


        if (error) {
          throw error;
        }


        uploaded.push(
          path
        );


        pageRows.push({
          book_id:
            book.id,

          page_number:
            i + 1,

          file_path:
            path,

          file_type:
            extension
        });

      }


      const {
        error:
          pageError
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


    message.textContent =
      "Bookを登録しました。";


    document.getElementById(
      "title"
    ).value =
      "";

    document.getElementById(
      "description"
    ).value =
      "";

    document.getElementById(
      "files"
    ).value =
      "";


    formCard.classList.add(
      "hidden"
    );


    await loadBooks();

  }
  catch (error) {

    console.error(
      "BOOK ERROR:",
      error
    );


    if (
      uploaded.length
    ) {

      await supabase.storage
        .from("web-viewer")
        .remove(
          uploaded
        );

    }


    message.style.color =
      "#b00020";

    message.textContent =
      "登録エラー: " +
      (
        error.message ||
        "Book登録に失敗しました。"
      );

  }

}


start()
  .catch(
    error => {

      console.error(
        "BOOK PAGE ERROR:",
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
