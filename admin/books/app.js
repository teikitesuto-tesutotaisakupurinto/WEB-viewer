
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
   Logout
   ========================================================= */

document.getElementById(
  "logout"
).onclick =
  event => {

    event.preventDefault();

    logout();

  };


/* =========================================================
   Form
   ========================================================= */

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


        const url =
          URL.createObjectURL(
            file
          );


        image.src =
          url;


        image.onload =
          () =>
            URL.revokeObjectURL(
              url
            );


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
   Clear
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
   Validate
   ========================================================= */

function classifyFiles(
  files
) {

  if (!files.length) {

    throw new Error(
      "教材ファイルを選択してください。"
    );

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


  const supported =
    files.length ===
    pdfFiles.length +
    imageFiles.length;


  if (!supported) {

    throw new Error(
      "PDF、JPG、JPEG、PNGのみ登録できます。"
    );

  }


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
  file
) {

  const extension =
    file.name
      .split(".")
      .pop()
      .toLowerCase();


  const path =
    `books/${crypto.randomUUID()}.${extension}`;


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
          file.type ||
          (
            extension === "pdf"
              ? "application/pdf"
              : `image/${extension === "jpg" ? "jpeg" : extension}`
          )
      }
    );


  if (error) {

    throw new Error(
      "教材ファイルのアップロードに失敗しました: " +
      error.message
    );

  }


  return path;

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


  let classified;


  try {

    classified =
      classifyFiles(
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


  let createdBookId =
    null;


  try {

    /*
     * ---------------------------------------
     * PDF
     * ---------------------------------------
     */

    if (
      classified.pdfFiles.length === 1
    ) {

      const file =
        classified.pdfFiles[0];


      message.textContent =
        "PDFをアップロードしています。";


      const path =
        await uploadFile(
          file
        );


      uploadedPaths.push(
        path
      );


      message.textContent =
        "Bookを登録しています。";


      /*
       * DBに存在する基本列だけを使用。
       * created_byなどを勝手に送らない。
       */

      const {
        data,
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
            "pdf"

        })
        .select(
          "id"
        )
        .single();


      if (error) {

        throw new Error(
          "Book登録に失敗しました: " +
          error.message
        );

      }


      createdBookId =
        data.id;

    }


    /*
     * ---------------------------------------
     * 画像Book
     * ---------------------------------------
     */

    else {

      message.textContent =
        "Bookを登録しています。";


      const {
        data,
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
            "images"

        })
        .select(
          "id"
        )
        .single();


      if (error) {

        throw new Error(
          "Book登録に失敗しました: " +
          error.message
        );

      }


      createdBookId =
        data.id;


      const pageRows =
        [];


      for (
        let i = 0;
        i <
        classified.imageFiles.length;
        i++
      ) {

        const file =
          classified.imageFiles[i];


        message.textContent =
          `画像 ${i + 1} / ${classified.imageFiles.length} をアップロードしています。`;


        const path =
          await uploadFile(
            file
          );


        uploadedPaths.push(
          path
        );


        const extension =
          file.name
            .split(".")
            .pop()
            .toLowerCase();


        pageRows.push({

          book_id:
            createdBookId,

          page_number:
            i + 1,

          file_path:
            path,

          file_type:
            extension

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

        throw new Error(
          "Bookページの登録に失敗しました: " +
          pageError.message
        );

      }

    }


    /*
     * 完了
     */

    message.textContent =
      "Bookを登録しました。";


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
     * Storageの途中ファイルを削除
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
          "STORAGE CLEANUP ERROR:",
          cleanupError
        );

      }

    }


    /*
     * DB側にBookだけ残った場合
     */

    if (
      createdBookId
    ) {

      try {

        await supabase
          .from("books")
          .delete()
          .eq(
            "id",
            createdBookId
          );

      }
      catch (
        cleanupError
      ) {

        console.warn(
          "BOOK CLEANUP ERROR:",
          cleanupError
        );

      }

    }


    /*
     * 今回は原因を隠さない。
     */

    message.textContent =
      error.message ||
      "Book登録に失敗しました。";

  }
  finally {

    createButton.disabled =
      false;

  }

}


/* =========================================================
   一覧
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
              String(
                book.file_type || ""
              ).toLowerCase() ===
              "images"
                ? "画像Book"
                : "PDF Book"
            }

          </div>

        </div>


        <div
          class="book-admin-status">

          ${
            book.enabled === false
              ? "停止"
              : "公開"
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
