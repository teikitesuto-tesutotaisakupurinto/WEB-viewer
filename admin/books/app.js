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
  escapeHtml
}
from "../../assets/js/common.js";


const formCard =
  document.getElementById("formCard");

const message =
  document.getElementById("message");

const booksContainer =
  document.getElementById("books");


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
      Bookを読み込んでいます。
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

    throw new Error(
      "Book取得エラー: " +
      error.message
    );

  }


  if (!data?.length) {

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
            ${escapeHtml(book.title)}
          </div>

          <div class="book-admin-description">
            ${escapeHtml(
              book.description || ""
            )}
          </div>

          <div class="book-admin-serial">
            Bookシリアル：
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


async function createBook(admin) {

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


  if (!title || !files.length) {

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
      ext =>
        !allowed.includes(ext)
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
    pdfFiles.length &&
    files.length !== 1
  ) {

    message.textContent =
      "PDFは1ファイルだけ選択してください。";

    return;

  }


  try {

    message.textContent =
      "登録しています。";


    let filePath = null;

    let fileType =
      extensions[0];


    if (
      pdfFiles.length === 1
    ) {

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


      fileType =
        "pdf";

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


    if (
      pdfFiles.length === 0
    ) {

      const rows = [];


      for (
        let i = 0;
        i < files.length;
        i++
      ) {

        const path =
          "books/" +
          crypto.randomUUID() +
          "." +
          extensions[i];


        const {
          error
        } =
          await supabase.storage
            .from("web-viewer")
            .upload(
              path,
              files[i]
            );


        if (error) {
          throw error;
        }


        rows.push({
          book_id:
            book.id,

          page_number:
            i + 1,

          file_path:
            path,

          file_type:
            extensions[i]
        });

      }


      const {
        error
      } =
        await supabase
          .from("book_pages")
          .insert(rows);


      if (error) {
        throw error;
      }

    }


    message.textContent =
      "Bookを登録しました。";


    formCard.classList.add(
      "hidden"
    );


    document.getElementById(
      "title"
    ).value = "";

    document.getElementById(
      "description"
    ).value = "";

    document.getElementById(
      "files"
    ).value = "";


    await loadBooks();

  }
  catch (error) {

    message.textContent =
      "登録エラー: " +
      error.message;

  }

}


start()
  .catch(
    error => {

      console.error(error);

      booksContainer.innerHTML =
        `
        <div class="page-error">

          <h2>
            Bookを読み込めませんでした
          </h2>

          <p>
            ${escapeHtml(
              error.message
            )}
          </p>

          <button
            onclick="location.reload()">
            再読み込み
          </button>

        </div>
        `;

    }
  );
