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


const books =
  document.getElementById("books");

const formCard =
  document.getElementById("formCard");

const message =
  document.getElementById("message");


/* =========================
   UI
   ========================= */

document.getElementById(
  "logout"
).onclick = () => logout();


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

  message.textContent = "";

};


document.getElementById(
  "create"
).onclick = createBook;


/* =========================
   Book一覧
   ========================= */

async function loadBooks() {

  books.innerHTML = `
    <div class="book-empty">
      読み込んでいます。
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


  if (!data?.length) {

    books.innerHTML = `
      <div class="book-empty">
        登録されたBookはありません。
      </div>
    `;

    return;
  }


  books.innerHTML =
    data.map(
      book => `

      <article class="book-admin-item">

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

      </article>

      `
    ).join("");

}


/* =========================
   Book登録
   ========================= */

async function createBook() {

  const title =
    document.getElementById(
      "title"
    ).value.trim();


  const description =
    document.getElementById(
      "description"
    ).value.trim();


  const fileInput =
    document.getElementById(
      "files"
    );


  const files =
    Array.from(
      fileInput.files || []
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


  const pdf =
    files.filter(
      file =>
        /\.pdf$/i.test(
          file.name
        )
    );


  const images =
    files.filter(
      file =>
        /\.(jpg|jpeg|png)$/i.test(
          file.name
        )
    );


  if (
    pdf.length &&
    images.length
  ) {

    message.textContent =
      "PDFと画像を同時には登録できません。";

    return;
  }


  if (
    pdf.length > 1
  ) {

    message.textContent =
      "PDFは1ファイルだけ登録できます。";

    return;
  }


  const uploaded = [];


  try {

    message.textContent =
      "登録しています。";


    let filePath = null;

    let fileType =
      images.length
        ? "images"
        : "pdf";


    /*
     * PDF
     */

    if (pdf.length === 1) {

      filePath =
        `books/${crypto.randomUUID()}.pdf`;


      const {
        error
      } =
      await supabase.storage
        .from("web-viewer")
        .upload(
          filePath,
          pdf[0],
          {
            contentType:
              "application/pdf"
          }
        );


      if (error) {
        throw error;
      }


      uploaded.push(
        filePath
      );

    }


    /*
     * Book
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
          fileType
      })
      .select()
      .single();


    if (bookError) {
      throw bookError;
    }


    /*
     * 複数画像
     */

    if (images.length) {

      const rows = [];


      for (
        let i = 0;
        i < images.length;
        i++
      ) {

        const file =
          images[i];


        const ext =
          file.name
            .split(".")
            .pop()
            .toLowerCase();


        const path =
          `books/${crypto.randomUUID()}.${ext}`;


        message.textContent =
          `画像 ${i + 1} / ${images.length} を登録しています。`;


        const {
          error
        } =
        await supabase.storage
          .from("web-viewer")
          .upload(
            path,
            file,
            {
              contentType:
                file.type
            }
          );


        if (error) {
          throw error;
        }


        uploaded.push(path);


        rows.push({

          book_id:
            book.id,

          page_number:
            i + 1,

          file_path:
            path,

          file_type:
            ext

        });

      }


      const {
        error:
          pageError
      } =
      await supabase
        .from("book_pages")
        .insert(rows);


      if (pageError) {
        throw pageError;
      }

    }


    message.textContent =
      "Bookを登録しました。";


    document.getElementById(
      "title"
    ).value = "";


    document.getElementById(
      "description"
    ).value = "";


    fileInput.value = "";


    formCard.classList.add(
      "hidden"
    );


    await loadBooks();

  }
  catch (error) {

    console.error(
      error
    );


    message.textContent =
      "登録エラー: " +
      error.message;

  }

}


async function start() {

  const admin =
    await requireAdmin();

  if (!admin) {
    return;
  }


  await loadBooks();

}


start()
.catch(
  error => {

    console.error(
      error
    );


    books.innerHTML = `
      <div class="page-error">

        <h2>
          Bookを読み込めませんでした
        </h2>

        <p>
          データの取得に失敗しました。
        </p>

        <button
          class="primary-button"
          onclick="location.reload()">

          再読み込み

        </button>

      </div>
    `;

  }
);
