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
  document.getElementById(
    "formCard"
  );

const booksContainer =
  document.getElementById(
    "books"
  );

const message =
  document.getElementById(
    "message"
  );

const fileInput =
  document.getElementById(
    "files"
  );

const filePreview =
  document.getElementById(
    "filePreview"
  );

const createButton =
  document.getElementById(
    "create"
  );


/* =========================================================
   UI
   ========================================================= */

document.getElementById(
  "logout"
).onclick =
  event => {

    event.preventDefault();

    logout();

  };


document.getElementById(
  "showForm"
).onclick =
  () => {

    formCard.classList.remove(
      "hidden"
    );

    message.textContent =
      "";

  };


document.getElementById(
  "cancel"
).onclick =
  () => {

    formCard.classList.add(
      "hidden"
    );

    clearForm();

  };


fileInput.addEventListener(
  "change",
  previewFiles
);


/* =========================================================
   Preview
   ========================================================= */

function previewFiles() {

  filePreview.innerHTML =
    "";

  const files =
    Array.from(
      fileInput.files || []
    );


  files.forEach(
    (
      file,
      index
    ) => {

      const item =
        document.createElement(
          "div"
        );


      item.className =
        "file-preview-item";


      const number =
        document.createElement(
          "div"
        );


      number.className =
        "file-preview-number";


      number.textContent =
        String(
          index + 1
        );


      item.appendChild(
        number
      );


      if (
        file.type.startsWith(
          "image/"
        )
      ) {

        const image =
          document.createElement(
            "img"
          );


        image.src =
          URL.createObjectURL(
            file
          );


        image.onload =
          () => {

            URL.revokeObjectURL(
              image.src
            );

          };


        item.appendChild(
          image
        );

      }
      else {

        const pdf =
          document.createElement(
            "div"
          );


        pdf.className =
          "file-preview-pdf";


        pdf.textContent =
          "PDF";


        item.appendChild(
          pdf
        );

      }


      filePreview.appendChild(
        item
      );

    }
  );

}


/* =========================================================
   Form clear
   ========================================================= */

function clearForm() {

  document.getElementById(
    "title"
  ).value =
    "";

  document.getElementById(
    "description"
  ).value =
    "";

  fileInput.value =
    "";

  filePreview.innerHTML =
    "";

  message.textContent =
    "";

}


/* =========================================================
   Validation
   ========================================================= */

function validateFiles(
  files
) {

  const allowed = [
    "application/pdf",
    "image/jpeg",
    "image/png"
  ];


  if (!files.length) {

    throw new Error(
      "教材ファイルを選択してください。"
    );

  }


  for (
    const file of files
  ) {

    const ext =
      file.name
        .split(".")
        .pop()
        .toLowerCase();


    const valid =
      allowed.includes(
        file.type
      )
      ||
      [
        "pdf",
        "jpg",
        "jpeg",
        "png"
      ].includes(
        ext
      );


    if (!valid) {

      throw new Error(
        "PDF、JPG、JPEG、PNGのみ対応しています。"
      );

    }

  }


  const pdfFiles =
    files.filter(
      file =>
        /\.pdf$/i.test(
          file.name
        )
    );


  const imageFiles =
    files.filter(
      file =>
        /\.(jpg|jpeg|png)$/i.test(
          file.name
        )
    );


  if (
    pdfFiles.length &&
    imageFiles.length
  ) {

    throw new Error(
      "PDFと画像は同時に登録できません。"
    );

  }


  if (
    pdfFiles.length > 1
  ) {

    throw new Error(
      "PDFは1ファイルだけ登録できます。"
    );

  }


  return {
    pdfFiles,
    imageFiles
  };

}


/* =========================================================
   Upload
   ========================================================= */

async function uploadFile(
  file,
  path
) {

  const {
    error
  } =
  await supabase.storage
    .from("web-viewer")
    .upload(
      path,
      file,
      {
        upsert:
          false,

        contentType:
          file.type
      }
    );


  if (error) {
    throw error;
  }

}


/* =========================================================
   Book登録
   ========================================================= */

async function createBook() {

  const admin =
    await requireAdmin();


  if (!admin) {
    return;
  }


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
      fileInput.files || []
    );


  if (!title) {

    message.textContent =
      "Book名を入力してください。";

    return;

  }


  let fileInfo;


  try {

    fileInfo =
      validateFiles(
        files
      );

  }
  catch (error) {

    message.textContent =
      error.message;

    return;

  }


  createButton.disabled =
    true;


  const uploadedPaths =
    [];


  try {

    /*
     * PDF
     */

    if (
      fileInfo.pdfFiles.length === 1
    ) {

      const file =
        fileInfo.pdfFiles[0];


      const path =
        `books/${crypto.randomUUID()}.pdf`;


      message.textContent =
        "PDFをアップロードしています。";


      await uploadFile(
        file,
        path
      );


      uploadedPaths.push(
        path
      );


      message.textContent =
        "Book情報を登録しています。";


      const {
        data: book,
        error
      } =
      await supabase
        .from("books")
        .insert({

          title,

          description,

          file_path:
            path,

          file_type:
            "pdf",

          created_by:
            admin.id

        })
        .select(
          "id"
        )
        .single();


      if (error) {
        throw error;
      }


      /*
       * PDF Bookには
       * book_pagesを作らない。
       * Viewer側でPDF.jsを使う。
       */

      message.textContent =
        "Bookを登録しました。";

    }


    /*
     * 複数画像
     */

    else {

      message.textContent =
        "Book情報を登録しています。";


      const {
        data: book,
        error
      } =
      await supabase
        .from("books")
        .insert({

          title,

          description,

          file_path:
            null,

          file_type:
            "images",

          created_by:
            admin.id

        })
        .select(
          "id"
        )
        .single();


      if (error) {
        throw error;
      }


      const pageRows =
        [];


      for (
        let i = 0;
        i < fileInfo.imageFiles.length;
        i++
      ) {

        const file =
          fileInfo.imageFiles[i];


        const ext =
          file.name
            .split(".")
            .pop()
            .toLowerCase();


        const path =
          `books/${crypto.randomUUID()}.${ext}`;


        message.textContent =
          `画像 ${i + 1} / ${fileInfo.imageFiles.length} をアップロードしています。`;


        await uploadFile(
          file,
          path
        );


        uploadedPaths.push(
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
            ext

        });

      }


      message.textContent =
        "ページ情報を登録しています。";


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


      message.textContent =
        "Bookを登録しました。";

    }


    clearForm();


    formCard.classList.add(
      "hidden"
    );


    await loadBooks();

  }
  catch (error) {

    console.error(
      "BOOK CREATE ERROR:",
      error
    );


    /*
     * Storageだけ掃除する。
     */

    if (
      uploadedPaths.length
    ) {

      try {

        await supabase.storage
          .from("web-viewer")
          .remove(
            uploadedPaths
          );

      }
      catch (
        cleanupError
      ) {

        console.warn(
          cleanupError
        );

      }

    }


    message.textContent =
      "登録できませんでした。";

  }
  finally {

    createButton.disabled =
      false;

  }

}


/* =========================================================
   Book一覧
   ========================================================= */

async function loadBooks() {

  booksContainer.innerHTML =
    `
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
      file_type,
      enabled,
      created_at
    `)
    .order(
      "created_at",
      {
        ascending:
          false
      }
    );


  if (error) {
    throw error;
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

      <article
        class="book-admin-item">

        <div
          class="book-admin-main">

          <div
            class="book-admin-title">

            ${escapeHtml(
              book.title
            )}

          </div>

          <div
            class="book-admin-description">

            ${escapeHtml(
              book.description || ""
            )}

          </div>

          <div
            class="book-admin-type">

            ${
              book.file_type === "images"
                ? "画像Book"
                : "PDF Book"
            }

          </div>

        </div>

        <div
          class="book-admin-status">

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


/* =========================================================
   Start
   ========================================================= */

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
      "BOOK PAGE ERROR:",
      error
    );


    booksContainer.innerHTML =
      `

      <div class="page-error">

        <h2>
          Bookを読み込めませんでした
        </h2>

        <p>
          データを取得できませんでした。
        </p>

        <button
          type="button"
          class="primary-button"
          onclick="location.reload()">

          再読み込み

        </button>

      </div>

      `;

  }
);
